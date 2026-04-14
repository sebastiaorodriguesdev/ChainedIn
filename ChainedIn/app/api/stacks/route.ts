import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const stacks = await prisma.stack.findMany({
    where: { userId: session!.user.id },
    include: {
      _count: { select: { nodes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(stacks);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { name, description } = body;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const stack = await prisma.stack.create({
    data: {
      userId: session!.user.id,
      name,
      description: description || null,
    },
  });

  return NextResponse.json(stack, { status: 201 });
}
