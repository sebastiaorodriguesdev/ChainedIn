import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { scanId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const report = await prisma.scanReport.findUnique({
    where: { id: params.scanId },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.userId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(report);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { scanId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const report = await prisma.scanReport.findUnique({
    where: { id: params.scanId },
    select: { userId: true },
  });

  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.userId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.scanReport.delete({ where: { id: params.scanId } });
  return new NextResponse(null, { status: 204 });
}
