import { worstSeverity } from "@/lib/utils";

const UNSCANNED_MS = 45 * 24 * 60 * 60 * 1000;

export interface TrustScore {
  score: number;       // 0–100
  grade: string;       // "Excellent" | "Good" | "Fair" | "Poor"
  color: string;       // hex color
  gradeColor: string;  // tailwind text class
}

type ScoredCompany = {
  software: Array<{
    versions: Array<{
      releasedAt: Date | string | null;
      cveCache: Array<{ severity: string }>;
    }>;
  }>;
  badges: Array<unknown>;
};

/**
 * Compute a 0–100 trust score for a company.
 * Returns null if the company has published no software (nothing to score).
 *
 * Formula:
 *  1. Score each package based on its latest version's worst CVE severity.
 *  2. +10 bonus per package if older versions had CVEs but latest is now clean.
 *  3. Average across all packages.
 *  4. +5 per approved compliance badge, capped at +15.
 *  5. Clamp 0–100, round.
 */
export function computeTrustScore(company: ScoredCompany): TrustScore | null {
  const packages = company.software.filter(p => p.versions.length > 0);
  if (packages.length === 0) return null;

  let total = 0;

  for (const pkg of packages) {
    // Versions are sorted newest-first (orderBy: createdAt desc in query)
    const latest = pkg.versions[0];
    const latestCves = latest.cveCache;
    const hasCves = latestCves.length > 0;

    const isUnscanned =
      !hasCves &&
      latest.releasedAt !== null &&
      Date.now() - new Date(latest.releasedAt).getTime() < UNSCANNED_MS;

    let pkgScore: number;
    if (hasCves) {
      const worst = worstSeverity(latestCves.map(c => c.severity));
      if (worst === "CRITICAL") pkgScore = 5;
      else if (worst === "HIGH")     pkgScore = 30;
      else if (worst === "MEDIUM")   pkgScore = 60;
      else                           pkgScore = 80; // LOW
    } else if (isUnscanned) {
      pkgScore = 70; // recently released, not yet scanned — uncertain
    } else {
      pkgScore = 100; // confirmed clean
    }

    // Remediation bonus: older versions had CVEs but latest is now clean
    if (!hasCves && !isUnscanned) {
      const olderHadCves = pkg.versions.slice(1).some(v => v.cveCache.length > 0);
      if (olderHadCves) pkgScore = Math.min(100, pkgScore + 10);
    }

    total += pkgScore;
  }

  const baseScore = total / packages.length;
  const badgeBonus = Math.min(15, company.badges.length * 5);
  const score = Math.round(Math.min(100, baseScore + badgeBonus));

  return { score, ...gradeFor(score) };
}

function gradeFor(score: number): { grade: string; color: string; gradeColor: string } {
  if (score >= 85) return { grade: "Excellent", color: "#16a34a", gradeColor: "text-green-600" };
  if (score >= 65) return { grade: "Good",      color: "#65a30d", gradeColor: "text-lime-600" };
  if (score >= 45) return { grade: "Fair",      color: "#ca8a04", gradeColor: "text-amber-600" };
  return               { grade: "Poor",      color: "#dc2626", gradeColor: "text-red-600" };
}
