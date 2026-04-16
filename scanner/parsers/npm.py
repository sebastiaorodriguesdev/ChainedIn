from __future__ import annotations

import json
import re
from pathlib import Path

from .base import BaseParser
from ..models import Dependency


class PackageLockParser(BaseParser):
    """Parses package-lock.json (npm lockfile versions 1, 2, and 3)."""

    FILENAMES = ["package-lock.json"]
    ECOSYSTEM = "npm"

    def parse(self, path: Path) -> list[Dependency]:
        data = json.loads(path.read_text(encoding="utf-8"))
        version = data.get("lockfileVersion", 1)

        if version >= 2 and "packages" in data:
            return self._parse_v2(data, path)
        return self._parse_v1(data, path)

    # ------------------------------------------------------------------
    # v2/v3: flat "packages" map keyed by "node_modules/..." paths
    # ------------------------------------------------------------------
    def _parse_v2(self, data: dict, path: Path) -> list[Dependency]:
        deps: list[Dependency] = []
        for pkg_path, pkg_info in data["packages"].items():
            if not pkg_path:  # root package entry has empty key
                continue
            ver = pkg_info.get("version", "")
            if not ver:
                continue
            name = self._name_from_path(pkg_path)
            if name:
                deps.append(Dependency(name=name, version=ver,
                                       ecosystem=self.ECOSYSTEM, source_file=str(path)))
        return deps

    @staticmethod
    def _name_from_path(pkg_path: str) -> str:
        # "node_modules/lodash"          -> "lodash"
        # "node_modules/@scope/pkg"      -> "@scope/pkg"
        # "a/node_modules/@scope/pkg"    -> "@scope/pkg"
        parts = pkg_path.split("node_modules/")
        return parts[-1] if len(parts) >= 2 else ""

    # ------------------------------------------------------------------
    # v1: nested "dependencies" tree
    # ------------------------------------------------------------------
    def _parse_v1(self, data: dict, path: Path) -> list[Dependency]:
        deps: list[Dependency] = []
        self._walk_v1(data.get("dependencies", {}), path, deps)
        return deps

    def _walk_v1(self, node: dict, path: Path, acc: list[Dependency]) -> None:
        for name, info in node.items():
            ver = info.get("version", "")
            if ver:
                acc.append(Dependency(name=name, version=ver,
                                      ecosystem=self.ECOSYSTEM, source_file=str(path)))
            self._walk_v1(info.get("dependencies", {}), path, acc)


class YarnLockParser(BaseParser):
    """Parses yarn.lock (classic v1 and berry v2 formats)."""

    FILENAMES = ["yarn.lock"]
    ECOSYSTEM = "npm"

    def parse(self, path: Path) -> list[Dependency]:
        content = path.read_text(encoding="utf-8")
        # Detect yarn berry (__metadata block)
        if "__metadata:" in content:
            return self._parse_berry(content, path)
        return self._parse_classic(content, path)

    # ------------------------------------------------------------------
    # Classic (v1) format
    # ------------------------------------------------------------------
    def _parse_classic(self, content: str, path: Path) -> list[Dependency]:
        deps: list[Dependency] = []
        # Split on blank lines to get individual entry blocks
        blocks = re.split(r"\n{2,}", content.strip())
        for block in blocks:
            block = block.strip()
            if not block or block.startswith("#"):
                continue
            ver_match = re.search(r'^\s+version\s+"([^"]+)"', block, re.MULTILINE)
            if not ver_match:
                continue
            version = ver_match.group(1)

            # First non-blank line is the specifier header, e.g.:
            #   "lodash@^4.17.20, lodash@^4.17.21":
            # or (unquoted):
            #   lodash@^4.17.20:
            header = block.split("\n")[0].strip().rstrip(":")
            # Take first specifier (comma-separated)
            first = header.split(",")[0].strip().strip('"')
            name = self._name_from_specifier(first)
            if name and version:
                deps.append(Dependency(name=name, version=version,
                                       ecosystem=self.ECOSYSTEM, source_file=str(path)))
        return deps

    @staticmethod
    def _name_from_specifier(spec: str) -> str:
        """
        "lodash@^4.17.20"   -> "lodash"
        "@scope/pkg@^1.0.0" -> "@scope/pkg"
        """
        if spec.startswith("@"):
            # Scoped package — skip the leading @ then find the next @
            rest = spec[1:]
            idx = rest.find("@")
            return "@" + rest[:idx] if idx != -1 else "@" + rest
        idx = spec.find("@")
        return spec[:idx] if idx != -1 else spec

    # ------------------------------------------------------------------
    # Berry (v2+) format — YAML-like with __metadata block
    # ------------------------------------------------------------------
    def _parse_berry(self, content: str, path: Path) -> list[Dependency]:
        deps: list[Dependency] = []
        # Pattern: '"name@npm:x.y.z":' followed by indented 'version: x.y.z'
        pattern = re.compile(
            r'^"([^"@]+)@(?:npm:)?([^"]+)":\s*\n(?:(?:[ \t]+[^\n]*\n)*?)'
            r'[ \t]+version:\s+(\S+)',
            re.MULTILINE,
        )
        for m in pattern.finditer(content):
            name = m.group(1)
            version = m.group(3)
            deps.append(Dependency(name=name, version=version,
                                   ecosystem=self.ECOSYSTEM, source_file=str(path)))
        return deps


class PackageJsonParser(BaseParser):
    """
    Parses package.json.  Only used when no lockfile is present because
    version specifiers are often ranges rather than exact pins.
    """

    FILENAMES = ["package.json"]
    ECOSYSTEM = "npm"

    _RANGE_CHARS = re.compile(r"^[\^~>=<*|]|x\b|\|\|")
    _SKIP_PREFIXES = ("http", "git", "file:", "workspace:", "link:", "portal:")

    def parse(self, path: Path) -> list[Dependency]:
        data = json.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []
        for section in ("dependencies", "devDependencies",
                        "peerDependencies", "optionalDependencies"):
            for name, spec in data.get(section, {}).items():
                dep = self._make_dep(name, spec, path)
                if dep:
                    deps.append(dep)
        return deps

    def _make_dep(self, name: str, spec: str, path: Path) -> Dependency | None:
        spec = spec.strip()
        if not spec or any(spec.startswith(p) for p in self._SKIP_PREFIXES):
            return None
        pinned = not bool(self._RANGE_CHARS.match(spec))
        # Strip leading range chars to get the best-guess version
        version = re.sub(r"^[\^~>=<!]+", "", spec).split(" ")[0].strip()
        if not version or not re.match(r"\d", version):
            return None
        return Dependency(name=name, version=version,
                          ecosystem=self.ECOSYSTEM, source_file=str(path),
                          pinned=pinned)
