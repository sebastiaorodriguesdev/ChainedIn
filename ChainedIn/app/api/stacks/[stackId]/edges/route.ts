import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { stackId: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await prisma.stack.findUnique({ where: { id: params.stackId } });
  if (!stack || stack.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { sourceId, targetId } = await req.json();
  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "sourceId and targetId required" }, { status: 400 });
  }

  const edge = await prisma.stackEdge.create({
    data: { stackId: params.stackId, sourceId, targetId },
  });

  return NextResponse.json(edge, { status: 201 });
}
