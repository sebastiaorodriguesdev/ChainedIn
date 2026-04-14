import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const ecosystem = searchParams.get("ecosystem") ?? "";
  // "withVersions=1" includes all versions + CVE cache (used by stack builder)
  const withVersions = searchParams.get("withVersions") === "1";

  const software = await prisma.software.findMany({
    where: {
      ...(q && { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }] }),
      ...(ecosystem && { ecosystem }),
    },
    include: {
      owner: { select: { id: true, name: true, type: true } },
      versions: withVersions
        ? {
            include: { cveCache: { select: { severity: true, cvssScore: true }, orderBy: { cvssScore: "desc" } } },
            orderBy: { createdAt: "desc" },
          }
        : { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ ecosystem: "asc" }, { name: "asc" }],
    take: 50,
  });

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

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let i = 1;
  while (await prisma.software.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  const pkg = await prisma.software.create({
    data: {
      ownerId: session!.user.id,
      name,
      slug,
      description: description || null,
      ecosystem: ecosystem || "other",
      repoUrl: repoUrl || null,
    },
  });

  return NextResponse.json(pkg, { status: 201 });
}
