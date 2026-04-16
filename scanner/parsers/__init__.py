from pathlib import Path
from typing import Iterator

from ..models import Dependency
from .base import BaseParser
from .npm import PackageLockParser, YarnLockParser, PackageJsonParser
from .python import RequirementsTxtParser, PoetryLockParser, PipfileLockParser, PyprojectTomlParser
from .go import GoModParser
from .cargo import CargoLockParser, CargoTomlParser
from .maven import PomXmlParser
from .composer import ComposerLockParser

# Ordered so lockfiles (exact pins) are preferred over manifests (ranges)
_PARSERS: list[BaseParser] = [
    PackageLockParser(),
    YarnLockParser(),
    PoetryLockParser(),
    PipfileLockParser(),
    CargoLockParser(),
    ComposerLockParser(),
    # Manifests last — these often have version ranges
    RequirementsTxtParser(),
    PyprojectTomlParser(),
    CargoTomlParser(),
    PackageJsonParser(),
    GoModParser(),
    PomXmlParser(),
]

# Files we recognize — used to skip files we can't parse
_KNOWN_FILES: set[str] = {
    name for p in _PARSERS for name in p.FILENAMES
}


def iter_manifest_files(root: Path) -> Iterator[Path]:
    """Yield manifest/lockfile paths inside *root*, skipping common noise dirs."""
    skip_dirs = {
        "node_modules", ".git", ".hg", ".svn",
        "__pycache__", ".venv", "venv", "env",
        "dist", "build", ".tox", ".mypy_cache",
        "target",  # Rust/Java build output
        "vendor",  # Go vendor dir
    }
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        if path.name in _KNOWN_FILES:
            yield path


def parse_directory(root: Path) -> tuple[list[Dependency], list[Dependency]]:
    """
    Walk *root* and parse all recognised manifest/lockfile files.

    Returns:
        pinned   — dependencies with exact version pins (suitable for CVE lookup)
        unpinned — dependencies with version ranges (skipped during CVE lookup)
    """
    pinned: list[Dependency] = []
    unpinned: list[Dependency] = []
    seen: set[str] = set()  # deduplicate by (ecosystem, name, version)

    for manifest_path in iter_manifest_files(root):
        for parser in _PARSERS:
            if not parser.can_parse(manifest_path):
                continue
            try:
                deps = parser.parse(manifest_path)
            except Exception:
                # Silently skip malformed files; the CLI will warn
                continue
            for dep in deps:
                key = dep.key
                if key in seen:
                    continue
                seen.add(key)
                if dep.pinned:
                    pinned.append(dep)
                else:
                    unpinned.append(dep)

    return pinned, unpinned
