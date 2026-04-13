import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _: NextRequest,
  { params }: { params: { stackId: string; edgeId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await prisma.stack.findUnique({ where: { id: params.stackId } });
  if (!stack || stack.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stackEdge.delete({ where: { id: params.edgeId } });
  return new NextResponse(null, { status: 204 });
}
