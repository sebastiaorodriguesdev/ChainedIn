import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { computeTrustScore } from "@/lib/trust-score";
import { BADGE_LABELS, ECOSYSTEM_LABELS, formatDate } from "@/lib/utils";
import { Award, Building2, User, ShieldCheck, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function VendorsPage() {
  // Fetch all users who own at least one software package, with full CVE data for scoring.
  const vendors = await prisma.user.findMany({
    where: { software: { some: {} } },
    include: {
      software: {
        include: {
          versions: {
            include: { cveCache: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      badges: { where: { status: "APPROVED" } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Compute scores and sort descending.
  const ranked = vendors
    .map((v) => ({ vendor: v, score: computeTrustScore(v) }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score.score - a.score.score;
    });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/vendors" />
        <main className="flex-1 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Vendor Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Vendors ranked by security score — computed from CVE severity across all published software versions.
            </p>
          </div>

          {/* Score legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border rounded-lg px-4 py-3">
            <span className="font-semibold">Score ranges:</span>
            {[
              { label: "Excellent", range: "85–100", color: "#16a34a" },
              { label: "Good",      range: "65–84",  color: "#65a30d" },
              { label: "Fair",      range: "45–64",  color: "#ca8a04" },
              { label: "Poor",      range: "0–44",   color: "#dc2626" },
            ].map(({ label, range, color }) => (
              <span key={label} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span style={{ color }}>{label}</span>
                <span className="opacity-60">({range})</span>
              </span>
            ))}
          </div>

          {ranked.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No vendors have registered software yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ranked.map(({ vendor, score }, index) => {
                const isCompany = vendor.type === "COMPANY";
                const totalVersions = vendor.software.reduce(
                  (sum, pkg) => sum + pkg.versions.length, 0
                );
                const totalCves = vendor.software.reduce(
                  (sum, pkg) =>
                    sum + pkg.versions.reduce((s, v) => s + v.cveCache.length, 0),
                  0
                );

                return (
                  <Card key={vendor.id} className="hover:bg-muted/30 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        {/* Rank */}
                        <div className="w-8 text-center shrink-0">
                          <span className="text-lg font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>

                        {/* Avatar */}
                        <div className="shrink-0">
                          {vendor.logoUrl ? (
                            <Image
                              src={vendor.logoUrl}
                              alt={vendor.name}
                              width={40}
                              height={40}
                              className="rounded-full object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border">
                              {isCompany
                                ? <Building2 className="h-5 w-5 text-muted-foreground" />
                                : <User className="h-5 w-5 text-muted-foreground" />}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/profile/${vendor.id}`}
                              className="font-semibold hover:underline"
                            >
                              {vendor.name}
                            </Link>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {isCompany ? "Company" : "Individual"}
                            </span>
                            {vendor.badges.map((b) => (
                              <span
                                key={b.id}
                                className="inline-flex items-center gap-1 text-xs rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700"
                                title={BADGE_LABELS[b.badgeType] ?? b.badgeType}
                              >
                                <Award className="h-3 w-3" />
                                {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {vendor.software.length} package{vendor.software.length !== 1 ? "s" : ""}
                            </span>
                            <span>{totalVersions} version{totalVersions !== 1 ? "s" : ""}</span>
                            {totalCves > 0 && (
                              <span className="text-orange-600 font-medium">
                                {totalCves} CVE{totalCves !== 1 ? "s" : ""}
                              </span>
                            )}
                            <span>Since {formatDate(vendor.createdAt)}</span>
                          </div>
                          {/* Ecosystems */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Array.from(new Set(vendor.software.map((s) => s.ecosystem))).map((eco) => (
                              <span key={eco} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {ECOSYSTEM_LABELS[eco] ?? eco}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Score */}
                        <div className="shrink-0 text-right">
                          {score ? (
                            <div
                              className="inline-flex flex-col items-center rounded-lg border px-4 py-2 min-w-[80px]"
                              style={{ borderColor: score.color, backgroundColor: score.color + "12" }}
                            >
                              <span className="text-2xl font-bold leading-none" style={{ color: score.color }}>
                                {score.score}
                              </span>
                              <span className="text-xs font-medium mt-0.5" style={{ color: score.color }}>
                                {score.grade}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center rounded-lg border border-muted px-4 py-2 min-w-[80px] text-muted-foreground">
                              <span className="text-xl font-bold">—</span>
                              <span className="text-xs mt-0.5">No data</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
