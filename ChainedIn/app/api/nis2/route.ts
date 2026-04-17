import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const result = await prisma.nis2Result.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const { verdict, answers } = await req.json();

  const result = await prisma.nis2Result.upsert({
    where: { userId: session.user.id },
    update: { verdict, answers: JSON.stringify(answers) },
    create: { userId: session.user.id, verdict, answers: JSON.stringify(answers) },
  });

  return NextResponse.json(result);
}
