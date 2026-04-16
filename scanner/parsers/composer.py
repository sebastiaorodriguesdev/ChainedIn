from __future__ import annotations

import json
import re
from pathlib import Path

from .base import BaseParser
from ..models import Dependency


class ComposerLockParser(BaseParser):
    """Parses composer.lock (PHP/Packagist)."""

    FILENAMES = ["composer.lock"]
    ECOSYSTEM = "Packagist"

    def parse(self, path: Path) -> list[Dependency]:
        data = json.loads(path.read_text(encoding="utf-8"))
        deps: list[Dependency] = []
        for section in ("packages", "packages-dev"):
            for pkg in data.get(section, []):
                name = pkg.get("name", "")
                version = pkg.get("version", "").lstrip("v")
                if name and version:
                    deps.append(Dependency(name=name, version=version,
                                           ecosystem=self.ECOSYSTEM,
                                           source_file=str(path)))
        return deps
