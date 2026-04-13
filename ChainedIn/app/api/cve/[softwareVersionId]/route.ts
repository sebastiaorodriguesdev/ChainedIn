import { NextRequest, NextResponse } from "next/server";
import { getCvesForVersion } from "@/lib/cve-service";

export async function GET(
  _: NextRequest,
  { params }: { params: { softwareVersionId: string } }
) {
  const cves = await getCvesForVersion(params.softwareVersionId);
  return NextResponse.json(cves);
}
