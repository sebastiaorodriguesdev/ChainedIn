from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_score(cls, score: float) -> "Severity":
        if score >= 9.0:
            return cls.CRITICAL
        elif score >= 7.0:
            return cls.HIGH
        elif score >= 4.0:
            return cls.MEDIUM
        elif score > 0:
            return cls.LOW
        return cls.UNKNOWN

    @classmethod
    def from_string(cls, s: str) -> "Severity":
        try:
            return cls(s.upper())
        except ValueError:
            return cls.UNKNOWN

    def order(self) -> int:
        """Lower = more severe (for sorting)."""
        return {
            Severity.CRITICAL: 0,
            Severity.HIGH: 1,
            Severity.MEDIUM: 2,
            Severity.LOW: 3,
            Severity.UNKNOWN: 4,
        }[self]

    def color(self) -> str:
        return {
            Severity.CRITICAL: "bold red",
            Severity.HIGH: "red",
            Severity.MEDIUM: "yellow",
            Severity.LOW: "cyan",
            Severity.UNKNOWN: "dim",
        }[self]


@dataclass
class Dependency:
    name: str
    version: str
    ecosystem: str
    source_file: str
    pinned: bool = True  # False when version is a range, not an exact pin

    @property
    def key(self) -> str:
        return f"{self.ecosystem}:{self.name}@{self.version}"


@dataclass
class Advisory:
    id: str
    aliases: list[str] = field(default_factory=list)
    summary: str = ""
    severity: Severity = Severity.UNKNOWN
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    fixed_versions: list[str] = field(default_factory=list)
    has_exploit: bool = False
    exploit_count: int = 0
    references: list[str] = field(default_factory=list)
    published: Optional[str] = None
    modified: Optional[str] = None

    @property
    def cve_ids(self) -> list[str]:
        return [a for a in self.aliases if a.startswith("CVE-")]

    @property
    def primary_id(self) -> str:
        """Prefer CVE ID; fall back to OSV/GHSA ID."""
        cves = self.cve_ids
        return cves[0] if cves else self.id

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "aliases": self.aliases,
            "summary": self.summary,
            "severity": self.severity.value,
            "cvss_score": self.cvss_score,
            "cvss_vector": self.cvss_vector,
            "fixed_versions": self.fixed_versions,
            "has_exploit": self.has_exploit,
            "exploit_count": self.exploit_count,
            "references": self.references,
            "published": self.published,
            "modified": self.modified,
        }


@dataclass
class Finding:
    dependency: Dependency
    advisories: list[Advisory]

    @property
    def highest_severity(self) -> Severity:
        if not self.advisories:
            return Severity.UNKNOWN
        return min(self.advisories, key=lambda a: a.severity.order()).severity

    @property
    def vuln_count(self) -> int:
        return len(self.advisories)

    def to_dict(self) -> dict:
        return {
            "dependency": {
                "name": self.dependency.name,
                "version": self.dependency.version,
                "ecosystem": self.dependency.ecosystem,
                "source_file": self.dependency.source_file,
                "pinned": self.dependency.pinned,
            },
            "advisories": [a.to_dict() for a in self.advisories],
        }


@dataclass
class ScanResult:
    target: str
    findings: list[Finding]
    total_deps: int
    ecosystems: list[str]
    scan_duration: float
    unpinned_deps: list[Dependency] = field(default_factory=list)

    @property
    def vulnerable_deps(self) -> int:
        return len(self.findings)

    @property
    def total_advisories(self) -> int:
        return sum(f.vuln_count for f in self.findings)

    def findings_by_severity(self) -> dict[Severity, list[Finding]]:
        result: dict[Severity, list[Finding]] = {s: [] for s in Severity}
        for finding in self.findings:
            result[finding.highest_severity].append(finding)
        # Sort within each severity bucket by dep name
        for bucket in result.values():
            bucket.sort(key=lambda f: f.dependency.name)
        return result

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "summary": {
                "total_deps": self.total_deps,
                "vulnerable_deps": self.vulnerable_deps,
                "total_advisories": self.total_advisories,
                "ecosystems": self.ecosystems,
                "scan_duration_seconds": round(self.scan_duration, 2),
                "unpinned_deps": len(self.unpinned_deps),
            },
            "findings": [f.to_dict() for f in self.findings],
        }
