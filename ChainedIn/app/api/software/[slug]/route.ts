import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const pkg = await prisma.software.findUnique({
    where: { slug: params.slug },
    include: {
      owner: { select: { id: true, name: true, type: true, logoUrl: true } },
      versions: {
        include: { cveCache: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pkg);
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await prisma.software.findUnique({ where: { slug: params.slug } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { description, repoUrl } = body;

  const updated = await prisma.software.update({
    where: { id: pkg.id },
    data: { description: description ?? pkg.description, repoUrl: repoUrl ?? pkg.repoUrl },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { slug: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await prisma.software.findUnique({ where: { slug: params.slug } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.software.delete({ where: { id: pkg.id } });
  return new NextResponse(null, { status: 204 });
}
