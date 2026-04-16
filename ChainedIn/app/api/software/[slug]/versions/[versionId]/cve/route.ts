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

  // Raw SQL — stale Prisma client rejects NULL ownerId during deserialization.
  const rows = await prisma.$queryRaw<Array<{ id: string; ownerId: string | null }>>`
    SELECT id, "ownerId" FROM "Software" WHERE slug = ${params.slug} LIMIT 1
  `;
  const pkg = rows[0];
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
