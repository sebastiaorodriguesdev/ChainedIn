from __future__ import annotations

import re
from pathlib import Path

from .base import BaseParser
from ..models import Dependency


class GoModParser(BaseParser):
    """
    Parses go.mod.

    OSV uses the "Go" ecosystem and full module paths as package names,
    e.g. "github.com/gorilla/mux".
    """

    FILENAMES = ["go.mod"]
    ECOSYSTEM = "Go"

    # Individual require: require github.com/pkg/errors v0.9.1
    _SINGLE_RE = re.compile(r"^\s*require\s+(\S+)\s+(v[\w.\-+]+)", re.MULTILINE)
    # Block require entries (inside require ( ... ))
    _BLOCK_ENTRY_RE = re.compile(r"^\s+(\S+)\s+(v[\w.\-+]+)", re.MULTILINE)

    def parse(self, path: Path) -> list[Dependency]:
        text = path.read_text(encoding="utf-8")
        deps: list[Dependency] = []

        # Find all require blocks and inline requires
        # Strip replace and exclude directives first to avoid false matches
        text = re.sub(r"replace\s+[^\n]+", "", text)
        text = re.sub(r"exclude\s+[^\n]+", "", text)

        # Block form: require ( ... )
        for block in re.findall(r"require\s*\((.*?)\)", text, re.DOTALL):
            for m in self._BLOCK_ENTRY_RE.finditer(block):
                module, version = m.group(1), m.group(2)
                if not module.startswith("//"):
                    deps.append(self._make(module, version, path))

        # Single-line form
        for m in self._SINGLE_RE.finditer(text):
            deps.append(self._make(m.group(1), m.group(2), path))

        return deps

    def _make(self, module: str, version: str, path: Path) -> Dependency:
        # Strip build metadata (+incompatible, etc.) from version for OSV lookup
        clean_version = re.sub(r"\+.*$", "", version)
        return Dependency(name=module, version=clean_version,
                          ecosystem=self.ECOSYSTEM, source_file=str(path))
