import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: NextRequest,
  { params }: { params: { slug: string; versionId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  // Raw SQL — stale Prisma client rejects NULL ownerId during deserialization.
  const rows = await prisma.$queryRaw<Array<{ id: string; ownerId: string | null }>>`
    SELECT id, "ownerId" FROM "Software" WHERE slug = ${params.slug} LIMIT 1
  `;
  const pkg = rows[0];
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.softwareVersion.delete({ where: { id: params.versionId } });
  return new NextResponse(null, { status: 204 });
}
