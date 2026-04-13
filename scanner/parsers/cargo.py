from __future__ import annotations

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


class CargoLockParser(BaseParser):
    """Parses Cargo.lock (TOML, v1-v4)."""

    FILENAMES = ["Cargo.lock"]
    ECOSYSTEM = "crates.io"

    def parse(self, path: Path) -> list[Dependency]:
        if tomllib is None:
            return []
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []
        for pkg in data.get("package", []):
            name = pkg.get("name", "")
            version = pkg.get("version", "")
            if name and version:
                deps.append(Dependency(name=name, version=version,
                                       ecosystem=self.ECOSYSTEM, source_file=str(path)))
        return deps


class CargoTomlParser(BaseParser):
    """
    Parses Cargo.toml [dependencies] and [dev-dependencies].
    Version ranges are flagged as unpinned.
    """

    FILENAMES = ["Cargo.toml"]
    ECOSYSTEM = "crates.io"

    _VER_RE = re.compile(r"[0-9][A-Za-z0-9.\-]*")

    def parse(self, path: Path) -> list[Dependency]:
        if tomllib is None:
            return []
        data = tomllib.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []

        for section in ("dependencies", "dev-dependencies", "build-dependencies"):
            for name, val in data.get(section, {}).items():
                dep = self._make(name, val, path)
                if dep:
                    deps.append(dep)

        return deps

    def _make(self, name: str, val, path: Path) -> Dependency | None:
        if isinstance(val, str):
            version_spec = val
        elif isinstance(val, dict):
            version_spec = val.get("version", "")
            if not version_spec:
                return None
        else:
            return None

        # Cargo uses "^1.2.3" by default (caret requirement)
        pinned = not bool(re.match(r"[\^~>=<*]", version_spec.strip()))
        ver_m = self._VER_RE.search(version_spec)
        if not ver_m:
            return None
        version = ver_m.group(0)
        return Dependency(name=name, version=version,
                          ecosystem=self.ECOSYSTEM, source_file=str(path),
                          pinned=pinned)
