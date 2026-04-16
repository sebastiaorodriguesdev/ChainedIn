import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type SoftwareRow = { id: string; ownerId: string | null; slug: string };

async function fetchPkg(slug: string): Promise<SoftwareRow | null> {
  const rows = await prisma.$queryRaw<SoftwareRow[]>`
    SELECT id, "ownerId", slug FROM "Software" WHERE slug = ${slug} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const pkg = await fetchPkg(params.slug);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type VersionRow = { id: string; softwareId: string; version: string; releasedAt: Date | null; changelog: string | null; createdAt: Date };
  const versions = await prisma.$queryRaw<VersionRow[]>(
    Prisma.sql`
      SELECT id, "softwareId", version, "releasedAt", changelog, "createdAt"
      FROM   "SoftwareVersion"
      WHERE  "softwareId" = ${pkg.id}
      ORDER  BY "createdAt" DESC
    `
  );

  type CveRow = { id: string; softwareVersionId: string; cveId: string; severity: string; cvssScore: number | null };
  const cveRows: CveRow[] = versions.length > 0
    ? await prisma.$queryRaw<CveRow[]>(
        Prisma.sql`
          SELECT id, "softwareVersionId", "cveId", severity, "cvssScore"
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

  return NextResponse.json(
    versions.map((v) => ({ ...v, cveCache: cveByVersion.get(v.id) ?? [] }))
  );
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await fetchPkg(params.slug);
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { version, releasedAt, changelog } = body;

  if (!version) return NextResponse.json({ error: "Version is required" }, { status: 400 });

  const existing = await prisma.softwareVersion.findUnique({
    where: { softwareId_version: { softwareId: pkg.id, version } },
  });
  if (existing) return NextResponse.json({ error: "Version already exists" }, { status: 409 });

  const sv = await prisma.softwareVersion.create({
    data: {
      softwareId: pkg.id,
      version,
      releasedAt: releasedAt ? new Date(releasedAt) : null,
      changelog: changelog || null,
    },
  });

  return NextResponse.json(sv, { status: 201 });
}
