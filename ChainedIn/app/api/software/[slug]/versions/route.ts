import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const pkg = await prisma.software.findUnique({
    where: { slug: params.slug },
    include: {
      versions: {
        include: { cveCache: { orderBy: { cvssScore: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pkg.versions);
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await prisma.software.findUnique({ where: { slug: params.slug } });
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
