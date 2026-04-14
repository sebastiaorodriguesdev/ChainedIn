import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { refreshCvesForVersion } from "@/lib/cve-service";

export async function POST(
  _: NextRequest,
  { params }: { params: { slug: string; versionId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const pkg = await prisma.software.findUnique({ where: { slug: params.slug } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.ownerId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await refreshCvesForVersion(params.versionId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CVE fetch failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
