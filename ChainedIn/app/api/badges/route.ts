import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const BADGE_TYPES = ["ISO27001", "NIS2", "SOC2", "GDPR", "PCI_DSS"];

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const badges = await prisma.badgeRequest.findMany({
    where: { userId: session!.user.id },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(badges);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { badgeType, evidence } = body;

  if (!BADGE_TYPES.includes(badgeType)) {
    return NextResponse.json({ error: "Invalid badge type" }, { status: 400 });
  }

  // Check no existing PENDING or APPROVED for same type
  const existing = await prisma.badgeRequest.findFirst({
    where: {
      userId: session!.user.id,
      badgeType,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Already requested or approved" }, { status: 409 });
  }

  const badge = await prisma.badgeRequest.create({
    data: {
      userId: session!.user.id,
      badgeType,
      evidence: evidence || null,
    },
  });

  return NextResponse.json(badge, { status: 201 });
}
