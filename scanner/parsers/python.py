from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from .base import BaseParser
from ..models import Dependency

if sys.version_info >= (3, 11):
    import tomllib
else:
    try:
        import tomllib
    except ImportError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ImportError:
            tomllib = None  # type: ignore[assignment]


class RequirementsTxtParser(BaseParser):
    """
    Parses requirements.txt (and requirements/*.txt, requirements-*.txt).
    Handles exact pins (==) as well as ranges.
    """

    FILENAMES = ["requirements.txt", "requirements-dev.txt",
                 "requirements-test.txt", "dev-requirements.txt",
                 "test-requirements.txt"]
    ECOSYSTEM = "PyPI"

    # Matches "package==1.2.3" and "package[extra]==1.2.3"
    _EXACT_RE = re.compile(
        r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?==([A-Za-z0-9_.\-+]+)", re.MULTILINE
    )
    # Matches any version spec: >=, <=, ~=, !=, >
    _RANGE_RE = re.compile(
        r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?([><!~]=?|==)([A-Za-z0-9_.\-+*]+)",
        re.MULTILINE,
    )

    def parse(self, path: Path) -> list[Dependency]:
        text = path.read_text(encoding="utf-8")
        deps: list[Dependency] = []

        for line in text.splitlines():
            line = line.strip()
            # Skip comments, blank lines, flags, VCS deps
            if not line or line.startswith(("#", "-r", "-c", "-e", "--", "git+", "http")):
                continue
            # Strip inline comments
            line = line.split(" #")[0].strip()

            exact = self._EXACT_RE.match(line)
            if exact:
                deps.append(Dependency(name=self._normalize(exact.group(1)),
                                       version=exact.group(2),
                                       ecosystem=self.ECOSYSTEM,
                                       source_file=str(path),
                                       pinned=True))
                continue

            # Range or bare package — record as unpinned
            range_m = self._RANGE_RE.match(line)
            if range_m:
                deps.append(Dependency(name=self._normalize(range_m.group(1)),
                                       version=range_m.group(3),
                                       ecosystem=self.ECOSYSTEM,
                                       source_file=str(path),
                                       pinned=False))

        return deps

    @staticmethod
    def _normalize(name: str) -> str:
        """PEP 503 normalize: lower-case, collapse separators to '-'."""
        return re.sub(r"[-_.]+", "-", name).lower()


class PoetryLockParser(BaseParser):
    """Parses poetry.lock (TOML)."""

    FILENAMES = ["poetry.lock"]
    ECOSYSTEM = "PyPI"

    def parse(self, path: Path) -> list[Dependency]:
        if tomllib is None:
            return []
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []
        for pkg in data.get("package", []):
            name = pkg.get("name", "")
            version = pkg.get("version", "")
            if name and version:
                deps.append(Dependency(name=name.lower(), version=version,
                                       ecosystem=self.ECOSYSTEM, source_file=str(path)))
        return deps


class PipfileLockParser(BaseParser):
    """Parses Pipfile.lock (JSON)."""

    FILENAMES = ["Pipfile.lock"]
    ECOSYSTEM = "PyPI"

    def parse(self, path: Path) -> list[Dependency]:
        data = json.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []
        for section in ("default", "develop"):
            for name, info in data.get(section, {}).items():
                ver_spec = info.get("version", "")
                # Pipfile.lock stores "==1.2.3"
                version = ver_spec.lstrip("=").strip()
                if version:
                    deps.append(Dependency(name=name.lower(), version=version,
                                           ecosystem=self.ECOSYSTEM,
                                           source_file=str(path)))
        return deps


class PyprojectTomlParser(BaseParser):
    """
    Parses pyproject.toml — supports PEP 621 [project.dependencies]
    and Poetry [tool.poetry.dependencies].
    Version ranges are flagged as unpinned.
    """

    FILENAMES = ["pyproject.toml"]
    ECOSYSTEM = "PyPI"

    _EXACT_RE = re.compile(r"^==([A-Za-z0-9_.\-+]+)$")
    _VERSION_RE = re.compile(r"[0-9][A-Za-z0-9_.\-+]*")

    def parse(self, path: Path) -> list[Dependency]:
        if tomllib is None:
            return []
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []

        # PEP 621
        for spec in data.get("project", {}).get("dependencies", []):
            dep = self._from_pep_spec(spec, path)
            if dep:
                deps.append(dep)

        # Poetry
        for name, val in data.get("tool", {}).get("poetry", {}).get("dependencies", {}).items():
            if name in ("python",):
                continue
            dep = self._from_poetry_spec(name, val, path)
            if dep:
                deps.append(dep)

        return deps

    def _from_pep_spec(self, spec: str, path: Path) -> Dependency | None:
        """Parse a PEP 508 dependency string like 'requests==2.28.0'."""
        # Strip extras, env markers
        spec = re.split(r";|#", spec)[0].strip()
        m = re.match(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?\s*(.*)", spec)
        if not m:
            return None
        name = m.group(1)
        constraint = m.group(2).strip()
        if not constraint:
            return None
        exact = self._EXACT_RE.match(constraint)
        if exact:
            return Dependency(name=name.lower(), version=exact.group(1),
                              ecosystem=self.ECOSYSTEM, source_file=str(path), pinned=True)
        ver_m = self._VERSION_RE.search(constraint)
        if ver_m:
            return Dependency(name=name.lower(), version=ver_m.group(0),
                              ecosystem=self.ECOSYSTEM, source_file=str(path), pinned=False)
        return None

    def _from_poetry_spec(self, name: str, val, path: Path) -> Dependency | None:
        if isinstance(val, str):
            ver = val.lstrip("^~>=<! ").split(",")[0].strip()
            pinned = not bool(re.match(r"[^0-9]", val.strip()))
            if ver and re.match(r"\d", ver):
                return Dependency(name=name.lower(), version=ver,
                                  ecosystem=self.ECOSYSTEM, source_file=str(path),
                                  pinned=pinned)
        elif isinstance(val, dict):
            ver = str(val.get("version", "")).lstrip("^~>=<! ").split(",")[0].strip()
            if ver and re.match(r"\d", ver):
                return Dependency(name=name.lower(), version=ver,
                                  ecosystem=self.ECOSYSTEM, source_file=str(path),
                                  pinned=False)
        return None
