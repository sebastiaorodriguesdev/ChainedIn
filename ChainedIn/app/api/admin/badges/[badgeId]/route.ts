import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { badgeId: string } }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { status, adminNote } = body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const badge = await prisma.badgeRequest.update({
    where: { id: params.badgeId },
    data: {
      status,
      adminNote: adminNote || null,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json(badge);
}
