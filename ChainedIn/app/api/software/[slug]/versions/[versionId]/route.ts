import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: NextRequest,
  { params }: { params: { slug: string; versionId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await prisma.software.findUnique({ where: { slug: params.slug } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.softwareVersion.delete({ where: { id: params.versionId } });
  return new NextResponse(null, { status: 204 });
}
