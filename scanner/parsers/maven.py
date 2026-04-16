from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from .base import BaseParser
from ..models import Dependency


class PomXmlParser(BaseParser):
    """
    Parses Maven pom.xml.

    OSV Maven ecosystem uses "groupId:artifactId" as the package name,
    e.g. "org.springframework:spring-core".
    """

    FILENAMES = ["pom.xml"]
    ECOSYSTEM = "Maven"

    _NS = {"m": "http://maven.apache.org/POM/4.0.0"}

    def parse(self, path: Path) -> list[Dependency]:
        try:
            tree = ET.parse(path)
        except ET.ParseError:
            return []
        root = tree.getroot()
        deps: list[Dependency] = []

        # Collect property variables for version resolution
        props: dict[str, str] = {}
        for p in root.findall(".//m:properties/*", self._NS):
            tag = p.tag.split("}")[-1]  # strip namespace
            if p.text:
                props[tag] = p.text.strip()
        # Also no-namespace properties
        for p in root.findall(".//properties/*"):
            tag = p.tag
            if p.text:
                props[tag] = p.text.strip()

        for dep_el in root.findall(".//m:dependency", self._NS):
            dep = self._parse_dep(dep_el, props, path, ns="m")
            if dep:
                deps.append(dep)
        # Fallback: no-namespace pom.xml
        if not deps:
            for dep_el in root.findall(".//dependency"):
                dep = self._parse_dep(dep_el, props, path, ns=None)
                if dep:
                    deps.append(dep)
        return deps

    def _parse_dep(self, el: ET.Element, props: dict, path: Path, ns: str | None) -> Dependency | None:
        def find(tag: str) -> str:
            prefix = f"{{{self._NS['m']}}}" if ns == "m" else ""
            node = el.find(f"{prefix}{tag}")
            return (node.text or "").strip() if node is not None else ""

        group = find("groupId")
        artifact = find("artifactId")
        version = find("version")
        scope = find("scope")

        # Skip test/provided/system scopes
        if scope in ("test", "system"):
            return None
        if not group or not artifact:
            return None

        # Resolve ${property.name} placeholders
        version = self._resolve(version, props)

        # Version range in Maven: [1.0,2.0) — treat as unpinned
        pinned = bool(version) and not version.startswith(("[", "("))
        if not version:
            return None

        package_name = f"{group}:{artifact}"
        return Dependency(name=package_name, version=version,
                          ecosystem=self.ECOSYSTEM, source_file=str(path),
                          pinned=pinned)

    @staticmethod
    def _resolve(version: str, props: dict[str, str]) -> str:
        """Replace ${key} placeholders with property values."""
        import re
        def replace(m: re.Match) -> str:
            return props.get(m.group(1), m.group(0))
        return re.sub(r"\$\{([^}]+)\}", replace, version)
