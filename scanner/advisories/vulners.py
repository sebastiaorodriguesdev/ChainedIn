"""
Vulners API enrichment layer.

Vulners provides:
  - Exploit availability & count (public PoCs, Metasploit modules, etc.)
  - Additional CVSS data
  - Bulletproof references

This module enriches Advisory objects returned by the OSV client.
An API key is required (free tier available at vulners.com).

Docs:  https://vulners.com/docs/api_reference/api/
PyPI:  pip install vulners
"""
from __future__ import annotations

import logging
from typing import Optional

from ..models import Advisory

logger = logging.getLogger(__name__)


def enrich(advisories_by_dep: dict[str, list[Advisory]], api_key: str) -> None:
    """
    Mutates *advisories_by_dep* in-place, adding exploit data from Vulners
    for every advisory that has a CVE alias.

    Args:
        advisories_by_dep: Output of ``osv.query()``.
        api_key:           Vulners API key.
    """
    try:
        import vulners  # type: ignore
    except ImportError:
        logger.warning(
            "vulners package not installed. Run: pip install vulners\n"
            "Skipping exploit enrichment."
        )
        return

    try:
        api = vulners.VulnersApi(api_key=api_key)
    except Exception as exc:
        logger.warning("Could not initialise Vulners API: %s", exc)
        return

    # Collect all unique CVE IDs across all findings
    cve_to_advisories: dict[str, list[Advisory]] = {}
    for adv_list in advisories_by_dep.values():
        for adv in adv_list:
            for cve in adv.cve_ids:
                cve_to_advisories.setdefault(cve, []).append(adv)

    if not cve_to_advisories:
        return

    logger.debug("Enriching %d unique CVEs via Vulners", len(cve_to_advisories))

    for cve_id, adv_list in cve_to_advisories.items():
        record = _fetch_cve(api, cve_id)
        if not record:
            continue

        has_exploit, exploit_count = _parse_exploits(record)
        for adv in adv_list:
            adv.has_exploit = has_exploit
            adv.exploit_count = exploit_count


def _fetch_cve(api, cve_id: str) -> Optional[dict]:
    """Fetch a single CVE document from Vulners. Returns raw dict or None."""
    try:
        result = api.document(cve_id)
        # vulners returns None or raises on miss
        return result if isinstance(result, dict) else None
    except Exception as exc:
        logger.debug("Vulners lookup failed for %s: %s", cve_id, exc)
        return None


def _parse_exploits(record: dict) -> tuple[bool, int]:
    """
    Extract exploit metadata from a Vulners CVE document.

    Vulners embeds an 'exploit' list (or similar key) in the returned record.
    The exact key may vary across API versions; we probe known locations.
    """
    exploit_list: list = (
        record.get("exploit", [])
        or record.get("exploits", [])
        or record.get("_source", {}).get("exploit", [])
        or []
    )
    count = len(exploit_list)
    return count > 0, count
