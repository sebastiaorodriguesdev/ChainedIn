import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { apiKey: true },
  });

  return NextResponse.json({ apiKey: user?.apiKey ?? null });
}

export async function POST() {
  const { session, error } = await requireSession();
  if (error) return error;

  const newKey = "ci_" + randomBytes(24).toString("hex");

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { apiKey: newKey },
  });

  return NextResponse.json({ apiKey: newKey });
}

export async function DELETE() {
  const { session, error } = await requireSession();
  if (error) return error;

  await prisma.user.update({
    where: { id: session!.user.id },
    data: { apiKey: null },
  });

  return NextResponse.json({ apiKey: null });
}
