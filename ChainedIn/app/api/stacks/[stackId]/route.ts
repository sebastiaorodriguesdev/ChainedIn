import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

async function getOwnedStack(stackId: string, userId: string) {
  const stack = await prisma.stack.findUnique({ where: { id: stackId } });
  if (!stack) return null;
  if (stack.userId !== userId) return null;
  return stack;
}

export async function GET(_: NextRequest, { params }: { params: { stackId: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await prisma.stack.findUnique({
    where: { id: params.stackId },
    include: {
      nodes: {
        include: {
          softwareVersion: {
            include: {
              software: true,
              cveCache: true,
            },
          },
        },
      },
      edges: true,
    },
  });

  if (!stack || stack.userId !== session!.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(stack);
}

export async function PATCH(req: NextRequest, { params }: { params: { stackId: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await getOwnedStack(params.stackId, session!.user.id);
  if (!stack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.stack.update({
    where: { id: params.stackId },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { stackId: string } }) {
  const { session, error } = await requireSession();
  if (error) return error;

  const stack = await getOwnedStack(params.stackId, session!.user.id);
  if (!stack) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.stack.delete({ where: { id: params.stackId } });
  return new NextResponse(null, { status: 204 });
}
