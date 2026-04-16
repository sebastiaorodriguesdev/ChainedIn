import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// ─── Types mirroring scanner JSON output ──────────────────────────────────────

interface DepJson {
  name: string;
  version: string;
  ecosystem: string;
  source_file: string;
  pinned: boolean;
}

interface AdvisoryJson {
  id: string;
  aliases?: string[];
  severity: string;
  summary: string;
  cvss_score: number | null;
  fixed_versions: string[];
  has_exploit: boolean;
  published?: string;
  modified?: string;
}

interface FindingJson {
  dependency: DepJson;
  advisories: AdvisoryJson[];
}

interface ScanBody {
  target?: string;
  project_name?: string;
  summary?: {
    total_deps?: number;
    vulnerable_deps?: number;
    total_advisories?: number;
    ecosystems?: string[];
    scan_duration_seconds?: number;
  };
  findings?: FindingJson[];
  all_dependencies?: DepJson[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveRiskLevel(findings: FindingJson[]): string {
  for (const level of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    if (findings.some((f) => f.advisories.some((a) => a.severity === level))) return level;
  }
  return "CLEAN";
}

function gridPosition(i: number, cols = 6, hGap = 200, vGap = 120, offsetX = 80, offsetY = 80) {
  return {
    positionX: offsetX + (i % cols) * hGap,
    positionY: offsetY + Math.floor(i / cols) * vGap,
  };
}

/** Resolve user from session cookie OR Bearer API key. */
async function resolveUser(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const key = auth.slice(7).trim();
    const user = await prisma.user.findUnique({ where: { apiKey: key } });
    if (!user) return { userId: null, error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
    return { userId: user.id, error: null };
  }
  const { session, error } = await requireSession();
  if (error) return { userId: null, error };
  return { userId: session!.user.id, error: null };
}

/**
 * Upsert community Software + SoftwareVersion records for every dependency,
 * then populate CveCache from the findings' advisories.
 *
 * All writes go through $executeRaw / $queryRaw so the stale generated Prisma
 * client (which still enforces non-null ownerId) is bypassed entirely.
 * Reads use the ORM since they don't touch the changed column.
 *
 * Returns a Map<"ecosystem:name_lower@version", softwareVersionId>.
 */
async function upsertPublicPackages(
  uniqueDeps: DepJson[],
  findings: FindingJson[]
): Promise<Map<string, string>> {
  const swKey  = (ecosystem: string, name: string) => `${ecosystem}:${name.toLowerCase()}`;
  const depKey = (d: { ecosystem: string; name: string; version: string }) =>
    `${swKey(d.ecosystem, d.name)}@${d.version}`;
  const newId  = () => randomBytes(12).toString("hex");
  const now    = () => new Date().toISOString();

  // ── 1. Resolve existing Software rows by (name, ecosystem) ──────────────────
  const existingSoftware = await prisma.software.findMany({
    where: { OR: uniqueDeps.map((d) => ({ name: d.name, ecosystem: d.ecosystem })) },
    select: { id: true, name: true, ecosystem: true },
  });

  // "ecosystem:name_lower" → softwareId
  const softwareMap = new Map<string, string>(
    existingSoftware.map((s) => [swKey(s.ecosystem, s.name), s.id])
  );

  // ── 2. INSERT community Software for missing (name, ecosystem) pairs ─────────
  const missingDeps = uniqueDeps.filter((d) => !softwareMap.has(swKey(d.ecosystem, d.name)));

  if (missingDeps.length > 0) {
    const candidateSlugs = missingDeps.map((d) => slugify(`${d.ecosystem}-${d.name}`));
    const takenSlugs = new Set(
      (await prisma.software.findMany({
        where: { slug: { in: candidateSlugs } },
        select: { slug: true },
      })).map((s) => s.slug)
    );

    for (const d of missingDeps) {
      let slug = slugify(`${d.ecosystem}-${d.name}`);
      let n = 2;
      while (takenSlugs.has(slug)) { slug = `${slugify(`${d.ecosystem}-${d.name}`)}-${n++}`; }
      takenSlugs.add(slug);

      const id = newId();
      // INSERT OR IGNORE skips silently if the slug unique index fires concurrently.
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "Software"
          (id, "ownerId", name, slug, ecosystem, "createdAt", "updatedAt")
        VALUES
          (${id}, NULL, ${d.name}, ${slug}, ${d.ecosystem}, ${now()}, ${now()})
      `;
      softwareMap.set(swKey(d.ecosystem, d.name), id);
    }
  }

  // ── 3. Resolve existing SoftwareVersion rows ─────────────────────────────────
  const softwareIds = Array.from(new Set(softwareMap.values()));

  // Fetch all versions for these software IDs in one query.
  const existingVersions = softwareIds.length > 0
    ? await prisma.softwareVersion.findMany({
        where: { softwareId: { in: softwareIds } },
        select: { id: true, softwareId: true, version: true },
      })
    : [];

  // softwareId:version → svId
  const svByIdVersion = new Map<string, string>(
    existingVersions.map((sv) => [`${sv.softwareId}:${sv.version}`, sv.id])
  );

  // depKey → svId  (for deps that already exist)
  const versionMap = new Map<string, string>();
  for (const d of uniqueDeps) {
    const swId = softwareMap.get(swKey(d.ecosystem, d.name));
    if (!swId) continue;
    const svId = svByIdVersion.get(`${swId}:${d.version}`);
    if (svId) versionMap.set(depKey(d), svId);
  }

  // ── 4. INSERT OR IGNORE missing SoftwareVersions ────────────────────────────
  const missingVersionDeps = uniqueDeps.filter((d) => !versionMap.has(depKey(d)));

  for (const d of missingVersionDeps) {
    const swId = softwareMap.get(swKey(d.ecosystem, d.name));
    if (!swId) continue;
    const id = newId();
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO "SoftwareVersion" (id, "softwareId", version, "createdAt")
      VALUES (${id}, ${swId}, ${d.version}, ${now()})
    `;
    versionMap.set(depKey(d), id);
  }

  // Re-fetch to pick up any IDs that were already there (INSERT OR IGNORE no-ops)
  // — only needed when two concurrent scans race to insert the same version.
  if (missingVersionDeps.length > 0) {
    const refreshed = await prisma.softwareVersion.findMany({
      where: { softwareId: { in: softwareIds } },
      select: { id: true, softwareId: true, version: true },
    });
    for (const sv of refreshed) {
      const d = uniqueDeps.find(
        (x) => softwareMap.get(swKey(x.ecosystem, x.name)) === sv.softwareId && x.version === sv.version
      );
      if (d) versionMap.set(depKey(d), sv.id);
    }
  }

  // ── 5. INSERT OR IGNORE CveCache rows from scanner advisories ────────────────
  for (const finding of findings) {
    const svId = versionMap.get(depKey(finding.dependency));
    if (!svId) continue;

    for (const adv of finding.advisories) {
      const cveId      = adv.aliases?.find((a) => a.startsWith("CVE-")) ?? adv.id;
      const severity   = adv.severity ?? "UNKNOWN";
      const cvssScore  = adv.cvss_score ?? null;
      const description = (adv.summary || cveId).slice(0, 1000);
      const publishedAt = adv.published ? new Date(adv.published).toISOString() : now();
      const modifiedAt  = adv.modified  ? new Date(adv.modified).toISOString()  : now();

      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "CveCache"
          (id, "softwareVersionId", "cveId", severity, "cvssScore", description,
           "publishedAt", "modifiedAt", "cachedAt")
        VALUES
          (${newId()}, ${svId}, ${cveId}, ${severity}, ${cvssScore},
           ${description}, ${publishedAt}, ${modifiedAt}, ${now()})
      `;
    }
  }

  return versionMap;
}

// ─── GET /api/scans ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId, error } = await resolveUser(req);
  if (error) return error;

  const reports = await prisma.$queryRaw<
    Array<{
      id: string;
      projectName: string;
      scannedAt: Date;
      totalDeps: number;
      vulnerableDeps: number;
      totalAdvisories: number;
      ecosystems: string;
      riskLevel: string;
      scanDurationSecs: number;
      stackId: string | null;
    }>
  >`
    SELECT id, "projectName", "scannedAt", "totalDeps", "vulnerableDeps",
           "totalAdvisories", ecosystems, "riskLevel", "scanDurationSecs", "stackId"
    FROM   "ScanReport"
    WHERE  "userId" = ${userId!}
    ORDER  BY "scannedAt" DESC
  `;

  return NextResponse.json(reports);
}

// ─── POST /api/scans ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId, error } = await resolveUser(req);
  if (error) return error;

  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { target, summary, findings = [], all_dependencies = [], project_name } = body;
  if (!summary) return NextResponse.json({ error: "Missing required field: summary" }, { status: 400 });

  const projectName = project_name ?? target ?? "Unnamed project";
  const riskLevel = deriveRiskLevel(findings);

  // Full dep list (all_dependencies available since scanner v0.2+; fallback to findings only)
  const depsForStack = Array.from(
    new Map(
      (all_dependencies.length > 0 ? all_dependencies : findings.map((f) => f.dependency)).map(
        (d) => [`${d.ecosystem}:${d.name}@${d.version}`, d]
      )
    ).values()
  );

  // ── 1. Upsert public packages + populate CVE cache ───────────────────────────
  //    Done OUTSIDE the main transaction so large dep lists don't time out.
  const versionMap = await upsertPublicPackages(depsForStack, findings);

  // ── 2. Create scan report + private stack in one transaction ─────────────────
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.scanReport.create({
      data: {
        userId: userId!,
        projectName,
        totalDeps: summary.total_deps ?? 0,
        vulnerableDeps: summary.vulnerable_deps ?? 0,
        totalAdvisories: summary.total_advisories ?? 0,
        ecosystems: JSON.stringify(summary.ecosystems ?? []),
        scanDurationSecs: summary.scan_duration_seconds ?? 0,
        riskLevel,
        findingsJson: JSON.stringify(findings),
      },
    });

    const stack = await tx.stack.create({
      data: {
        userId: userId!,
        name: projectName,
        description: `Auto-generated from security scan — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
      },
    });

    // All deps now have a SoftwareVersion in the DB — nodes are always linked.
    if (depsForStack.length > 0) {
      await tx.stackNode.createMany({
        data: depsForStack.map((dep, i) => {
          const key = `${dep.ecosystem}:${dep.name.toLowerCase()}@${dep.version}`;
          const svId = versionMap.get(key) ?? null;
          const pos = gridPosition(i);
          return {
            stackId: stack.id,
            softwareVersionId: svId,
            freeformName: svId ? null : dep.name,
            freeformVersion: svId ? null : dep.version,
            freeformEcosystem: svId ? null : dep.ecosystem,
            positionX: pos.positionX,
            positionY: pos.positionY,
          };
        }),
      });
    }

    await tx.$executeRaw`UPDATE "ScanReport" SET "stackId" = ${stack.id} WHERE "id" = ${report.id}`;

    return { reportId: report.id, stackId: stack.id };
  });

  return NextResponse.json(
    { id: result.reportId, stackId: result.stackId, riskLevel },
    { status: 201 }
  );
}
