"""
Report rendering for ChainedIn scan results.

Supports:
  - Terminal (rich tables + coloured severity groups)
  - JSON
  - SARIF 2.1.0  (for GitHub Code Scanning / CI integration)
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich import box
from rich.text import Text

from .models import Advisory, Finding, ScanResult, Severity

console = Console()

# Severity order for display (most severe first)
_SEVERITY_ORDER = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM,
                   Severity.LOW, Severity.UNKNOWN]

_SEVERITY_ICONS = {
    Severity.CRITICAL: "[!!]",
    Severity.HIGH: "[!]",
    Severity.MEDIUM: "[~]",
    Severity.LOW: "[i]",
    Severity.UNKNOWN: "[?]",
}


# ---------------------------------------------------------------------------
# Terminal (rich)
# ---------------------------------------------------------------------------

def print_terminal(result: ScanResult, min_severity: Severity = Severity.LOW,
                   vulners_enabled: bool = False) -> None:
    """Render the scan result to the terminal using rich."""
    _print_header(result, vulners_enabled=vulners_enabled)

    by_sev = result.findings_by_severity()
    printed_any = False

    for sev in _SEVERITY_ORDER:
        if sev.order() > min_severity.order():
            continue
        findings = by_sev.get(sev, [])
        if not findings:
            continue
        printed_any = True
        _print_severity_group(sev, findings)

    if not printed_any:
        console.print("\n[bold green]No vulnerabilities found at or above the selected severity.[/bold green]\n")

    _print_footer(result, min_severity)


def _print_header(result: ScanResult, vulners_enabled: bool = False) -> None:
    eco_str = ", ".join(result.ecosystems) if result.ecosystems else "none detected"
    vulners_line = (
        "[bold]Exploit enrichment:[/bold] [green]ON[/green]  [dim](Vulners API)[/dim]"
        if vulners_enabled
        else "[bold]Exploit enrichment:[/bold] [dim]OFF[/dim]  [dim](pass --vulners-key to enable)[/dim]"
    )
    console.print()
    console.print(Panel(
        f"[bold]Target:[/bold] {result.target}\n"
        f"[bold]Ecosystems:[/bold] {eco_str}\n"
        f"[bold]Dependencies scanned:[/bold] {result.total_deps}  "
        f"[dim]({len(result.unpinned_deps)} unpinned - skipped)[/dim]\n"
        f"{vulners_line}\n"
        f"[bold]Scan time:[/bold] {result.scan_duration:.1f}s",
        title="[bold cyan]ChainedIn — Dependency Security Scan[/bold cyan]",
        border_style="cyan",
    ))


def _print_severity_group(sev: Severity, findings: list[Finding]) -> None:
    color = sev.color()
    icon = _SEVERITY_ICONS[sev]
    count = sum(f.vuln_count for f in findings)
    header = Text(f"\n{icon} {sev.value}  ({len(findings)} package{'s' if len(findings) != 1 else ''}, "
                  f"{count} advisor{'ies' if count != 1 else 'y'})")
    header.stylize(f"bold {color}")
    console.print(header)
    console.print("-" * 76, style="dim")

    for finding in findings:
        _print_finding(finding)


def _print_finding(finding: Finding) -> None:
    dep = finding.dependency
    sev = finding.highest_severity
    color = sev.color()

    # Header line: package name + version + ecosystem
    console.print(
        f"  [{color}]{dep.name}[/{color}] [dim]{dep.version}[/dim] "
        f"([italic]{dep.ecosystem}[/italic])  [dim]{Path(dep.source_file).name}[/dim]"
    )

    for adv in sorted(finding.advisories, key=lambda a: a.severity.order()):
        _print_advisory(adv)

    console.print()


def _print_advisory(adv: Advisory) -> None:
    sev_color = adv.severity.color()
    score_str = f"CVSS {adv.cvss_score:.1f}" if adv.cvss_score is not None else "no score"

    # Advisory ID + score
    id_text = f"    [{sev_color}]{adv.primary_id}[/{sev_color}]"
    console.print(f"{id_text}  [dim]{score_str}[/dim]")

    # Summary
    if adv.summary:
        console.print(f"    [italic]{adv.summary[:120]}[/italic]")

    # Fix
    if adv.fixed_versions:
        fix = ", ".join(adv.fixed_versions[:3])
        console.print(f"    [green]Fix:[/green] upgrade to {fix}")
    else:
        console.print("    [yellow]No fix available[/yellow]")

    # Exploit badge
    if adv.has_exploit:
        exploit_str = f"exploit available ({adv.exploit_count} known)" if adv.exploit_count else "exploit available"
        console.print(f"    [bold red][EXPLOIT] {exploit_str}[/bold red]")

    # Primary reference
    refs = [r for r in adv.references if r]
    if refs:
        console.print(f"    [dim]{refs[0]}[/dim]")


def _print_footer(result: ScanResult, min_severity: Severity) -> None:
    by_sev = result.findings_by_severity()

    table = Table(box=box.SIMPLE, show_header=True, header_style="bold")
    table.add_column("Severity", style="bold")
    table.add_column("Packages", justify="right")
    table.add_column("Advisories", justify="right")

    total_pkgs = 0
    total_advs = 0
    for sev in _SEVERITY_ORDER:
        findings = by_sev.get(sev, [])
        if not findings:
            continue
        pkg_count = len(findings)
        adv_count = sum(f.vuln_count for f in findings)
        total_pkgs += pkg_count
        total_advs += adv_count
        table.add_row(
            Text(sev.value, style=sev.color()),
            str(pkg_count),
            str(adv_count),
        )

    table.add_section()
    table.add_row("[bold]TOTAL[/bold]", str(total_pkgs), str(total_advs))

    if result.unpinned_deps:
        console.print(
            f"\n[yellow]⚠ {len(result.unpinned_deps)} unpinned dependencies were skipped "
            f"(version ranges cannot be precisely matched to CVEs).[/yellow]"
        )

    console.print("\n[bold]Summary[/bold]")
    console.print(table)
    console.print()


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

def to_json(result: ScanResult, indent: int = 2) -> str:
    return json.dumps(result.to_dict(), indent=indent, default=str)


# ---------------------------------------------------------------------------
# SARIF 2.1.0
# ---------------------------------------------------------------------------

def to_sarif(result: ScanResult) -> str:
    """
    Emit SARIF 2.1.0 for GitHub Code Scanning upload or other SARIF consumers.
    """
    rules: list[dict] = []
    sarif_results: list[dict] = []
    seen_rules: set[str] = set()

    for finding in result.findings:
        for adv in finding.advisories:
            rule_id = adv.id
            if rule_id not in seen_rules:
                seen_rules.add(rule_id)
                rules.append(_sarif_rule(adv))
            sarif_results.append(_sarif_result(finding, adv))

    sarif = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "ChainedIn",
                        "version": "0.1.0",
                        "informationUri": "https://github.com/your-org/ChainedIn",
                        "rules": rules,
                    }
                },
                "results": sarif_results,
                "originalUriBaseIds": {
                    "SRCROOT": {"uri": f"file:///{result.target}/"}
                },
            }
        ],
    }
    return json.dumps(sarif, indent=2)


def _sarif_rule(adv: Advisory) -> dict:
    level = {
        Severity.CRITICAL: "error",
        Severity.HIGH: "error",
        Severity.MEDIUM: "warning",
        Severity.LOW: "note",
        Severity.UNKNOWN: "none",
    }[adv.severity]

    properties: dict = {"tags": ["security", "supply-chain"]}
    if adv.cvss_score is not None:
        properties["cvss_score"] = adv.cvss_score
    if adv.has_exploit:
        properties["exploit_available"] = True

    return {
        "id": adv.id,
        "name": adv.primary_id,
        "shortDescription": {"text": adv.summary or adv.id},
        "fullDescription": {"text": adv.summary or adv.id},
        "defaultConfiguration": {"level": level},
        "helpUri": adv.references[0] if adv.references else f"https://osv.dev/vulnerability/{adv.id}",
        "properties": properties,
    }


def _sarif_result(finding: Finding, adv: Advisory) -> dict:
    dep = finding.dependency
    rel_path = dep.source_file  # best effort; ideally relative to root

    fix_text = ""
    if adv.fixed_versions:
        fix_text = f" Fix: upgrade to {', '.join(adv.fixed_versions[:3])}."
    exploit_text = " ⚡ Public exploit available." if adv.has_exploit else ""

    return {
        "ruleId": adv.id,
        "level": {
            Severity.CRITICAL: "error",
            Severity.HIGH: "error",
            Severity.MEDIUM: "warning",
            Severity.LOW: "note",
            Severity.UNKNOWN: "none",
        }[adv.severity],
        "message": {
            "text": (
                f"{dep.name} {dep.version} ({dep.ecosystem}) is affected by "
                f"{adv.primary_id}: {adv.summary}{fix_text}{exploit_text}"
            )
        },
        "locations": [
            {
                "physicalLocation": {
                    "artifactLocation": {"uri": rel_path, "uriBaseId": "SRCROOT"},
                    "region": {"startLine": 1},
                }
            }
        ],
    }
