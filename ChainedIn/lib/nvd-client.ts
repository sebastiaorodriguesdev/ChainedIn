const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const API_KEY = process.env.NVD_API_KEY;
// With key: 50 req/30s → 600ms delay. Without: 5 req/30s → 6100ms delay.
const DELAY_MS = API_KEY ? 700 : 6200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NvdCve {
  cveId: string;
  description: string;
  cvssScore: number | null;
  severity: string;
  publishedAt: Date;
  modifiedAt: Date;
}

function mapSeverity(metrics: Record<string, unknown>): {
  severity: string;
  score: number | null;
} {
  const v31 = (metrics?.cvssMetricV31 as Array<{ cvssData: { baseScore: number; baseSeverity: string } }> | undefined)?.[0];
  const v30 = (metrics?.cvssMetricV30 as Array<{ cvssData: { baseScore: number; baseSeverity: string } }> | undefined)?.[0];
  const v2 = (metrics?.cvssMetricV2 as Array<{ cvssData: { baseScore: number }; baseSeverity?: string }> | undefined)?.[0];

  if (v31) {
    const score = v31.cvssData.baseScore;
    const sev = v31.cvssData.baseSeverity?.toUpperCase();
    return { score, severity: sev || scoreToSeverity(score) };
  }
  if (v30) {
    const score = v30.cvssData.baseScore;
    const sev = v30.cvssData.baseSeverity?.toUpperCase();
    return { score, severity: sev || scoreToSeverity(score) };
  }
  if (v2) {
    const score = v2.cvssData.baseScore;
    const sev = (v2.baseSeverity as string | undefined)?.toUpperCase();
    return { score, severity: sev || scoreToSeverity(score) };
  }
  return { score: null, severity: "NONE" };
}

function scoreToSeverity(score: number): string {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

export async function fetchCvesForPackage(
  packageName: string,
  version: string
): Promise<NvdCve[]> {
  await sleep(DELAY_MS);

  const keyword = `${packageName} ${version}`.trim();
  const url = new URL(NVD_BASE);
  url.searchParams.set("keywordSearch", keyword);
  url.searchParams.set("resultsPerPage", "50");

  const headers: Record<string, string> = {};
  if (API_KEY) headers["apiKey"] = API_KEY;

  const res = await fetch(url.toString(), { headers, next: { revalidate: 0 } });

  if (res.status === 403) {
    throw new Error("NVD rate limit exceeded. Try again later.");
  }
  if (!res.ok) {
    throw new Error(`NVD API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    vulnerabilities: Array<{
      cve: {
        id: string;
        published: string;
        lastModified: string;
        descriptions: Array<{ lang: string; value: string }>;
        metrics: Record<string, unknown>;
      };
    }>;
  };

  return (data.vulnerabilities ?? []).map(({ cve }) => {
    const { severity, score } = mapSeverity(cve.metrics);
    const desc = cve.descriptions.find((d) => d.lang === "en")?.value ?? "";
    return {
      cveId: cve.id,
      description: desc,
      cvssScore: score,
      severity,
      publishedAt: new Date(cve.published),
      modifiedAt: new Date(cve.lastModified),
    };
  });
}
