import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const ecosystem = searchParams.get("ecosystem") ?? "";
  const withVersions = searchParams.get("withVersions") === "1";

  // Raw SQL — stale Prisma client rejects NULL ownerId during ORM deserialization.
  type SoftwareRow = {
    id: string; ownerId: string | null; name: string; slug: string;
    description: string | null; ecosystem: string; repoUrl: string | null;
    createdAt: string; updatedAt: string;
  };

  let rows: SoftwareRow[];

  if (q && ecosystem) {
    rows = await prisma.$queryRaw<SoftwareRow[]>`
      SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl", "createdAt", "updatedAt"
      FROM   "Software"
      WHERE  (name LIKE ${'%'+q+'%'} OR slug LIKE ${'%'+q+'%'} OR description LIKE ${'%'+q+'%'})
        AND  ecosystem = ${ecosystem}
      ORDER  BY ecosystem ASC, name ASC LIMIT 50
    `;
  } else if (q) {
    rows = await prisma.$queryRaw<SoftwareRow[]>`
      SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl", "createdAt", "updatedAt"
      FROM   "Software"
      WHERE  name LIKE ${'%'+q+'%'} OR slug LIKE ${'%'+q+'%'} OR description LIKE ${'%'+q+'%'}
      ORDER  BY ecosystem ASC, name ASC LIMIT 50
    `;
  } else if (ecosystem) {
    rows = await prisma.$queryRaw<SoftwareRow[]>`
      SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl", "createdAt", "updatedAt"
      FROM   "Software"
      WHERE  ecosystem = ${ecosystem}
      ORDER  BY ecosystem ASC, name ASC LIMIT 50
    `;
  } else {
    rows = await prisma.$queryRaw<SoftwareRow[]>`
      SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl", "createdAt", "updatedAt"
      FROM   "Software"
      ORDER  BY ecosystem ASC, name ASC LIMIT 50
    `;
  }

  if (rows.length === 0) return NextResponse.json([]);

  // Fetch owners for rows that have one.
  const ownerIds = Array.from(new Set(rows.map((r) => r.ownerId).filter(Boolean))) as string[];
  type OwnerRow = { id: string; name: string; type: string; logoUrl: string | null };
  const ownerRows: OwnerRow[] = ownerIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, type: true, logoUrl: true },
      })
    : [];
  const ownerMap = new Map(ownerRows.map((o) => [o.id, o]));

  // Fetch versions (and optionally CVE cache).
  const softwareIds = rows.map((r) => r.id);
  type VersionRow = { id: string; softwareId: string; version: string; releasedAt: string | null; changelog: string | null; createdAt: string };
  type CveRow = { id: string; softwareVersionId: string; severity: string; cvssScore: number | null };

  const versionRows: VersionRow[] = await prisma.$queryRaw<VersionRow[]>(
    Prisma.sql`
      SELECT id, "softwareId", version, "releasedAt", changelog, "createdAt"
      FROM   "SoftwareVersion"
      WHERE  "softwareId" IN (${Prisma.join(softwareIds)})
      ORDER  BY "createdAt" DESC
    `
  );

  let cveMap = new Map<string, CveRow[]>();
  if (withVersions && versionRows.length > 0) {
    const svIds = versionRows.map((v) => v.id);
    const cveRows: CveRow[] = await prisma.$queryRaw<CveRow[]>(
      Prisma.sql`
        SELECT id, "softwareVersionId", severity, "cvssScore"
        FROM   "CveCache"
        WHERE  "softwareVersionId" IN (${Prisma.join(svIds)})
        ORDER  BY "cvssScore" DESC
      `
    );
    for (const c of cveRows) {
      if (!cveMap.has(c.softwareVersionId)) cveMap.set(c.softwareVersionId, []);
      cveMap.get(c.softwareVersionId)!.push(c);
    }
  }

  // Group versions by softwareId (take:1 when not withVersions).
  const versionsBySw = new Map<string, VersionRow[]>();
  for (const v of versionRows) {
    if (!versionsBySw.has(v.softwareId)) versionsBySw.set(v.softwareId, []);
    if (!withVersions && versionsBySw.get(v.softwareId)!.length >= 1) continue;
    versionsBySw.get(v.softwareId)!.push(v);
  }

  const software = rows.map((r) => ({
    ...r,
    owner: r.ownerId ? (ownerMap.get(r.ownerId) ?? null) : null,
    versions: (versionsBySw.get(r.id) ?? []).map((v) => ({
      ...v,
      cveCache: withVersions ? (cveMap.get(v.id) ?? []) : undefined,
    })),
  }));

  return NextResponse.json(software);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { name, description, ecosystem, repoUrl } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const resolvedEcosystem = ecosystem || "other";

  // Check if an unclaimed community package already exists for this name+ecosystem.
  // If so, the vendor is claiming it rather than creating a duplicate.
  // Raw SQL — Prisma runtime enforces non-null owner until client is regenerated.
  const unclaimedRows = await prisma.$queryRaw<
    Array<{ id: string; slug: string; description: string | null; repoUrl: string | null }>
  >`
    SELECT id, slug, description, "repoUrl"
    FROM   "Software"
    WHERE  name = ${name}
      AND  ecosystem = ${resolvedEcosystem}
      AND  "ownerId" IS NULL
    LIMIT  1
  `;
  const unclaimed = unclaimedRows[0] ?? null;

  if (unclaimed) {
    const claimed = await prisma.software.update({
      where: { id: unclaimed.id },
      data: {
        ownerId: session!.user.id,
        description: description || unclaimed.description,
        repoUrl: repoUrl || unclaimed.repoUrl,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(claimed, { status: 200 });
  }

  // No unclaimed package — create a fresh one.
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let i = 1;
  // Raw SQL count — avoids ORM deserializing rows with nullable ownerId.
  while (true) {
    const hit = await prisma.$queryRaw<Array<{ c: number }>>`
      SELECT COUNT(*) AS c FROM "Software" WHERE slug = ${slug}
    `;
    if (Number(hit[0]?.c ?? 0) === 0) break;
    slug = `${baseSlug}-${i++}`;
  }

  const pkg = await prisma.software.create({
    data: {
      ownerId: session!.user.id,
      name,
      slug,
      description: description || null,
      ecosystem: resolvedEcosystem,
      repoUrl: repoUrl || null,
    },
  });

  return NextResponse.json(pkg, { status: 201 });
}
