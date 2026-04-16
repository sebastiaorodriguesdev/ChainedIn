import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Raw SQL helper — stale Prisma client rejects NULL ownerId during ORM deserialization.
type SoftwareRow = {
  id: string; ownerId: string | null; name: string; slug: string;
  description: string | null; ecosystem: string; repoUrl: string | null;
  createdAt: string; updatedAt: string;
};

async function fetchPkgBySlug(slug: string): Promise<SoftwareRow | null> {
  const rows = await prisma.$queryRaw<SoftwareRow[]>`
    SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl", "createdAt", "updatedAt"
    FROM   "Software"
    WHERE  slug = ${slug}
    LIMIT  1
  `;
  return rows[0] ?? null;
}

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const pkg = await fetchPkgBySlug(params.slug);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch owner separately if present.
  const owner = pkg.ownerId
    ? await prisma.user.findUnique({
        where: { id: pkg.ownerId },
        select: { id: true, name: true, type: true, logoUrl: true },
      })
    : null;

  // Fetch versions + CVE cache.
  type VersionRow = { id: string; softwareId: string; version: string; releasedAt: string | null; changelog: string | null; createdAt: string };
  const versions = await prisma.$queryRaw<VersionRow[]>(
    Prisma.sql`
      SELECT id, "softwareId", version, "releasedAt", changelog, "createdAt"
      FROM   "SoftwareVersion"
      WHERE  "softwareId" = ${pkg.id}
      ORDER  BY "createdAt" DESC
    `
  );

  type CveRow = { id: string; softwareVersionId: string; cveId: string; severity: string; cvssScore: number | null; description: string | null; publishedAt: string; modifiedAt: string; cachedAt: string };
  const cveRows: CveRow[] = versions.length > 0
    ? await prisma.$queryRaw<CveRow[]>(
        Prisma.sql`
          SELECT id, "softwareVersionId", "cveId", severity, "cvssScore", description, "publishedAt", "modifiedAt", "cachedAt"
          FROM   "CveCache"
          WHERE  "softwareVersionId" IN (${Prisma.join(versions.map((v) => v.id))})
          ORDER  BY "cvssScore" DESC
        `
      )
    : [];

  const cveByVersion = new Map<string, CveRow[]>();
  for (const c of cveRows) {
    if (!cveByVersion.has(c.softwareVersionId)) cveByVersion.set(c.softwareVersionId, []);
    cveByVersion.get(c.softwareVersionId)!.push(c);
  }

  return NextResponse.json({
    ...pkg,
    owner,
    versions: versions.map((v) => ({ ...v, cveCache: cveByVersion.get(v.id) ?? [] })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await fetchPkgBySlug(params.slug);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { description, repoUrl } = body;

  // ownerId is non-null here (ownership check passed), so ORM update is safe.
  const updated = await prisma.software.update({
    where: { id: pkg.id },
    data: { description: description ?? pkg.description, repoUrl: repoUrl ?? pkg.repoUrl },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await fetchPkgBySlug(params.slug);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.software.delete({ where: { id: pkg.id } });
  return new NextResponse(null, { status: 204 });
}
