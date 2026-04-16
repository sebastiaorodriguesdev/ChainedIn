"""
OSV (Open Source Vulnerabilities) API client.

Flow:
  1. POST /v1/querybatch  — send all (name, version, ecosystem) tuples at once;
                            returns only vuln IDs + modified timestamps per query.
  2. GET  /v1/vulns/{id}  — fetch full OSV records for each unique vuln ID,
                            done concurrently to stay fast.

Docs: https://google.github.io/osv.dev/api/
"""
from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests

from ..models import Advisory, Dependency, Severity

_BATCH_URL = "https://api.osv.dev/v1/querybatch"
_VULN_URL = "https://api.osv.dev/v1/vulns/{}"
_CHUNK = 1000       # OSV hard limit per querybatch request
_MAX_WORKERS = 20   # concurrent GET /v1/vulns fetches
_TIMEOUT = 30       # seconds


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def query(deps: list[Dependency]) -> dict[str, list[Advisory]]:
    """
    Look up all *deps* against OSV.

    Returns a mapping from ``Dependency.key`` → list of Advisory objects.
    """
    if not deps:
        return {}

    # Step 1: batch query for IDs
    dep_to_ids: dict[str, list[str]] = _batch_query_ids(deps)

    # Step 2: collect unique IDs that actually have results
    unique_ids: set[str] = {vid for ids in dep_to_ids.values() for vid in ids}
    if not unique_ids:
        return {}

    # Step 3: fetch full records in parallel
    vuln_records: dict[str, dict] = _fetch_vulns(unique_ids)

    # Step 4: assemble Advisory objects per dep, then deduplicate by CVE
    result: dict[str, list[Advisory]] = {}
    for dep in deps:
        ids = dep_to_ids.get(dep.key, [])
        advisories = [_osv_to_advisory(vuln_records[vid], dep)
                      for vid in ids if vid in vuln_records]
        if advisories:
            result[dep.key] = _deduplicate(advisories)

    return result


def _deduplicate(advisories: list[Advisory]) -> list[Advisory]:
    """
    Collapse advisories that share a CVE alias into a single entry,
    keeping the one with the most complete data (highest CVSS score,
    most references, most fixed versions).
    """
    # Group by canonical CVE ID; advisories with no CVE keep their OSV ID
    groups: dict[str, list[Advisory]] = {}
    for adv in advisories:
        key = adv.cve_ids[0] if adv.cve_ids else adv.id
        groups.setdefault(key, []).append(adv)

    merged: list[Advisory] = []
    for group in groups.values():
        if len(group) == 1:
            merged.append(group[0])
            continue
        # Pick the entry with the best CVSS score as the base
        base = max(group, key=lambda a: a.cvss_score or 0.0)
        # Union all aliases, references, and fixed versions
        all_aliases: list[str] = list(dict.fromkeys(
            alias for a in group for alias in a.aliases
        ))
        all_refs: list[str] = list(dict.fromkeys(
            ref for a in group for ref in a.references if ref
        ))
        all_fixed: list[str] = list(dict.fromkeys(
            fv for a in group for fv in a.fixed_versions
        ))
        base.aliases = all_aliases
        base.references = all_refs
        base.fixed_versions = all_fixed
        merged.append(base)

    return merged


# ---------------------------------------------------------------------------
# Step 1 — batch query
# ---------------------------------------------------------------------------

def _batch_query_ids(deps: list[Dependency]) -> dict[str, list[str]]:
    """Return {dep.key: [vuln_id, ...]} from the querybatch endpoint."""
    result: dict[str, list[str]] = {}
    # Process in chunks to respect the per-request limit
    for i in range(0, len(deps), _CHUNK):
        chunk = deps[i: i + _CHUNK]
        queries = [_dep_to_query(d) for d in chunk]
        try:
            resp = requests.post(
                _BATCH_URL,
                json={"queries": queries},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            continue

        for dep, res in zip(chunk, data.get("results", [])):
            ids = [v["id"] for v in res.get("vulns", []) if "id" in v]
            if ids:
                result[dep.key] = ids

    return result


def _dep_to_query(dep: Dependency) -> dict:
    return {
        "version": dep.version,
        "package": {"name": dep.name, "ecosystem": dep.ecosystem},
    }


# ---------------------------------------------------------------------------
# Step 2 — fetch full records
# ---------------------------------------------------------------------------

def _fetch_vulns(ids: set[str]) -> dict[str, dict]:
    """Fetch full OSV records concurrently. Returns {id: record}."""
    records: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        futures = {pool.submit(_fetch_one, vid): vid for vid in ids}
        for future in as_completed(futures):
            vid = futures[future]
            record = future.result()
            if record:
                records[vid] = record
    return records


def _fetch_one(vid: str) -> Optional[dict]:
    try:
        resp = requests.get(_VULN_URL.format(vid), timeout=_TIMEOUT)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Step 3 — convert OSV record → Advisory
# ---------------------------------------------------------------------------

def _osv_to_advisory(record: dict, dep: Dependency) -> Advisory:
    severity, cvss_score, cvss_vector = _extract_severity(record)
    fixed_versions = _extract_fixed_versions(record, dep)

    return Advisory(
        id=record.get("id", ""),
        aliases=record.get("aliases", []),
        summary=record.get("summary", record.get("details", ""))[:300],
        severity=severity,
        cvss_score=cvss_score,
        cvss_vector=cvss_vector,
        fixed_versions=fixed_versions,
        references=[r.get("url", "") for r in record.get("references", []) if r.get("url")],
        published=record.get("published"),
        modified=record.get("modified"),
    )


def _extract_severity(record: dict) -> tuple[Severity, Optional[float], Optional[str]]:
    """
    OSV severity field contains CVSS vectors.
    Also check database_specific for pre-computed scores.
    """
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None

    # Try CVSS vector from the severity array
    for entry in record.get("severity", []):
        score_str = entry.get("score", "")
        if score_str.startswith("CVSS:"):
            cvss_vector = score_str
            cvss_score = _parse_cvss_vector(score_str)
            break

    # Fallback: database_specific (GitHub Advisory format)
    db_specific = record.get("database_specific", {})
    if cvss_score is None:
        raw = db_specific.get("cvss", {})
        if isinstance(raw, dict):
            cvss_score = _safe_float(raw.get("score"))
        elif isinstance(raw, (int, float)):
            cvss_score = float(raw)

    # Severity string (GitHub / OSS-Fuzz)
    severity_str = db_specific.get("severity", "")
    if cvss_score is not None:
        severity = Severity.from_score(cvss_score)
    elif severity_str:
        severity = Severity.from_string(severity_str)
    else:
        severity = Severity.UNKNOWN

    return severity, cvss_score, cvss_vector


def _parse_cvss_vector(vector: str) -> Optional[float]:
    """Use the cvss library to compute a base score from a CVSS v3 vector."""
    try:
        from cvss import CVSS3
        c = CVSS3(vector)
        return float(c.base_score)
    except Exception:
        pass
    # Fallback: try extracting a score suffix some databases append
    m = re.search(r"/(\d+\.\d+)$", vector)
    return float(m.group(1)) if m else None


def _extract_fixed_versions(record: dict, dep: Dependency) -> list[str]:
    """
    Walk the affected[].ranges[].events[] tree and collect all "fixed" versions
    that apply to the same ecosystem/package as the dependency being scanned.
    """
    fixed: list[str] = []
    for affected in record.get("affected", []):
        pkg = affected.get("package", {})
        if pkg.get("ecosystem", "").lower() != dep.ecosystem.lower():
            continue
        for rng in affected.get("ranges", []):
            for event in rng.get("events", []):
                if "fixed" in event:
                    fixed.append(event["fixed"])
    return list(dict.fromkeys(fixed))  # deduplicate, preserve order


def _safe_float(val) -> Optional[float]:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
