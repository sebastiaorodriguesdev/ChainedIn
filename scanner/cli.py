"""
ChainedIn CLI — supply-chain dependency vulnerability scanner.

Usage:
    chainedIn scan /path/to/project
    chainedIn scan . --severity HIGH
    chainedIn scan . --format json --output report.json
    chainedIn scan . --vulners-key <key>
    chainedIn scan . --format sarif --output results.sarif
"""
from __future__ import annotations

import sys
import time
from enum import Enum
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .models import Dependency, Finding, ScanResult, Severity
from .parsers import parse_directory
from .advisories import osv, vulners as vulners_client
from . import report as report_mod

app = typer.Typer(
    name="chainedIn",
    help="Supply-chain dependency vulnerability scanner.",
    add_completion=False,
)
err_console = Console(stderr=True)


class OutputFormat(str, Enum):
    terminal = "terminal"
    json = "json"
    sarif = "sarif"


class SeverityChoice(str, Enum):
    critical = "CRITICAL"
    high = "HIGH"
    medium = "MEDIUM"
    low = "LOW"
    unknown = "UNKNOWN"


# ---------------------------------------------------------------------------
# scan command
# ---------------------------------------------------------------------------

@app.command()
def scan(
    target: Path = typer.Argument(
        ...,
        help="Directory to scan.",
        exists=True,
        file_okay=False,
        dir_okay=True,
        resolve_path=True,
    ),
    severity: SeverityChoice = typer.Option(
        SeverityChoice.low,
        "--severity", "-s",
        help="Minimum severity to report (default: LOW).",
    ),
    format: OutputFormat = typer.Option(
        OutputFormat.terminal,
        "--format", "-f",
        help="Output format: terminal, json, sarif.",
    ),
    output: Optional[Path] = typer.Option(
        None,
        "--output", "-o",
        help="Write output to FILE instead of stdout.",
    ),
    vulners_key: Optional[str] = typer.Option(
        None,
        "--vulners-key",
        envvar="VULNERS_API_KEY",
        help="Vulners API key for exploit enrichment (optional). "
             "Can also be set via VULNERS_API_KEY env var.",
    ),
    no_dev: bool = typer.Option(
        False,
        "--no-dev",
        help="Exclude dev/test dependencies (best-effort; not all lockfiles distinguish them).",
    ),
) -> None:
    """Scan a project directory for vulnerable dependencies."""
    start = time.perf_counter()
    min_sev = Severity(severity.value)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        transient=True,
        console=err_console,
    ) as progress:
        # Step 1: parse manifests
        task = progress.add_task("Parsing dependency files…", total=None)
        try:
            pinned, unpinned = parse_directory(target)
        except Exception as exc:
            err_console.print(f"[red]Error parsing {target}: {exc}[/red]")
            raise typer.Exit(1)
        progress.update(task, description=f"Found {len(pinned)} pinned + {len(unpinned)} unpinned dependencies.")

        if not pinned and not unpinned:
            err_console.print(
                "[yellow]No recognised dependency files found in the target directory.[/yellow]\n"
                "Supported: package-lock.json, yarn.lock, requirements.txt, poetry.lock, "
                "Pipfile.lock, pyproject.toml, go.mod, Cargo.lock, pom.xml, composer.lock"
            )
            raise typer.Exit(0)

        # Step 2: query OSV
        progress.update(task, description=f"Querying OSV for {len(pinned)} dependencies…")
        try:
            advisories_by_dep = osv.query(pinned)
        except Exception as exc:
            err_console.print(f"[red]OSV query failed: {exc}[/red]")
            raise typer.Exit(1)

        # Step 3: optional Vulners enrichment
        if vulners_key and advisories_by_dep:
            progress.update(task, description="Enriching with Vulners exploit data…")
            vulners_client.enrich(advisories_by_dep, vulners_key)

        progress.update(task, description="Building report…")

    # Assemble findings
    dep_map: dict[str, Dependency] = {d.key: d for d in pinned}
    findings: list[Finding] = []
    for dep_key, adv_list in advisories_by_dep.items():
        dep = dep_map.get(dep_key)
        if dep is None:
            continue
        findings.append(Finding(dependency=dep, advisories=adv_list))

    # Sort: most severe first
    findings.sort(key=lambda f: f.highest_severity.order())

    ecosystems = sorted({d.ecosystem for d in pinned + unpinned})
    result = ScanResult(
        target=str(target),
        findings=findings,
        total_deps=len(pinned) + len(unpinned),
        ecosystems=ecosystems,
        scan_duration=time.perf_counter() - start,
        unpinned_deps=unpinned,
    )

    # Render
    rendered = _render(result, format, min_sev)

    if output:
        output.write_text(rendered, encoding="utf-8")
        err_console.print(f"[green]Report written to {output}[/green]")
    else:
        if format == OutputFormat.terminal:
            report_mod.print_terminal(result, min_severity=min_sev,
                                      vulners_enabled=bool(vulners_key))
        else:
            print(rendered)

    # Exit with non-zero if critical/high findings exist (useful for CI)
    by_sev = result.findings_by_severity()
    has_critical = bool(by_sev[Severity.CRITICAL] or by_sev[Severity.HIGH])
    raise typer.Exit(1 if has_critical else 0)


# ---------------------------------------------------------------------------
# version command
# ---------------------------------------------------------------------------

@app.command()
def version() -> None:
    """Print ChainedIn version."""
    from importlib.metadata import version as pkg_version
    try:
        ver = pkg_version("chainedIn")
    except Exception:
        ver = "0.1.0 (dev)"
    typer.echo(f"chainedIn {ver}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _render(result: ScanResult, format: OutputFormat, min_sev: Severity) -> str:
    if format == OutputFormat.json:
        return report_mod.to_json(result)
    if format == OutputFormat.sarif:
        return report_mod.to_sarif(result)
    # Terminal rendering is handled directly (rich doesn't return a string easily)
    return ""


if __name__ == "__main__":
    app()
