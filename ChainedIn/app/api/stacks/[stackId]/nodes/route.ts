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

  const body = await req.json();
  const { softwareVersionId, freeformName, freeformVersion, freeformEcosystem, positionX, positionY } = body;

  const node = await prisma.stackNode.create({
    data: {
      stackId: params.stackId,
      softwareVersionId: softwareVersionId || null,
      freeformName: freeformName || null,
      freeformVersion: freeformVersion || null,
      freeformEcosystem: freeformEcosystem || null,
      positionX: positionX ?? 0,
      positionY: positionY ?? 0,
    },
    include: {
      softwareVersion: {
        include: { software: true, cveCache: true },
      },
    },
  });

  // Touch stack updatedAt
  await prisma.stack.update({ where: { id: params.stackId }, data: {} });

  return NextResponse.json(node, { status: 201 });
}
