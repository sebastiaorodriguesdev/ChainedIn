import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session!.user.id },
    select: { id: true, name: true, email: true, type: true, bio: true, website: true, logoUrl: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { name, bio, website, logoUrl } = body;

  const user = await prisma.user.update({
    where: { id: session!.user.id },
    data: {
      ...(name && { name }),
      bio: bio || null,
      website: website || null,
      logoUrl: logoUrl || null,
    },
    select: { id: true, name: true, bio: true, website: true, logoUrl: true },
  });

  return NextResponse.json(user);
}
