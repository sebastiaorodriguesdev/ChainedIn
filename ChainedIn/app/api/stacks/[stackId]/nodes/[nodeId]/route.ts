import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { stackId: string; nodeId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await prisma.stack.findUnique({ where: { id: params.stackId } });
  if (!stack || stack.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const node = await prisma.stackNode.update({
    where: { id: params.nodeId },
    data: {
      ...(body.positionX !== undefined && { positionX: body.positionX }),
      ...(body.positionY !== undefined && { positionY: body.positionY }),
    },
  });

  return NextResponse.json(node);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { stackId: string; nodeId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await prisma.stack.findUnique({ where: { id: params.stackId } });
  if (!stack || stack.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stackNode.delete({ where: { id: params.nodeId } });
  return new NextResponse(null, { status: 204 });
}
