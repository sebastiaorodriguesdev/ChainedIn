import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const badges = await prisma.badgeRequest.findMany({
    include: { user: { select: { id: true, name: true, email: true, type: true } } },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(badges);
}
