import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityRow } from "@/components/severity-badge";
import { BADGE_LABELS, ECOSYSTEM_LABELS, formatDate } from "@/lib/utils";
import { computeTrustScore } from "@/lib/trust-score";
import { getPlainSummary, getRiskLevelLabel } from "@/lib/scan-plain-language";
import { Package, GitBranch, Award, Plus, ExternalLink, ScanLine, ChevronRight, ShieldCheck } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, recentScans] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      include: {
        software: {
          include: {
            versions: {
              include: { cveCache: true },
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
          orderBy: { createdAt: "desc" },
        },
        stacks: { orderBy: { updatedAt: "desc" }, take: 5 },
        badges: { orderBy: { requestedAt: "desc" } },
      },
    }),
    prisma.$queryRaw<Array<{ id: string; projectName: string; scannedAt: Date; riskLevel: string; vulnerableDeps: number; totalAdvisories: number; totalDeps: number; stackId: string | null }>>`
      SELECT id, "projectName", "scannedAt", "riskLevel", "vulnerableDeps", "totalAdvisories", "totalDeps", "stackId"
      FROM   "ScanReport"
      WHERE  "userId" = ${session.user.id}
      ORDER  BY "scannedAt" DESC
      LIMIT  3
    `,
  ]);

  const trustScore = computeTrustScore(user);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/dashboard" />
        <main className="flex-1 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
              <p className="text-muted-foreground">
                {user.type === "COMPANY" ? "Company account" : "Individual account"} ·{" "}
                <Link href={`/profile/${user.id}`} className="underline hover:text-foreground">
                  View public profile
                </Link>
              </p>
            </div>
            {trustScore && (
              <div
                className="flex items-center gap-3 rounded-lg border px-4 py-3"
                style={{ borderColor: trustScore.color, backgroundColor: trustScore.color + "12" }}
              >
                <ShieldCheck className="h-6 w-6" style={{ color: trustScore.color }} />
                <div className="text-right">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-3xl font-bold" style={{ color: trustScore.color }}>
                      {trustScore.score}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: trustScore.color }}>
                    {trustScore.grade} vendor score
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Software */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" /> Software packages ({user.software.length})
              </h2>
              <Link href="/software/new">
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add package</Button>
              </Link>
            </div>
            {user.software.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No packages yet.</p>
                  <Link href="/software/new" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">Add your first package</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {user.software.map((pkg) => (
                  <Card key={pkg.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/software/${pkg.slug}`} className="font-medium hover:underline">
                              {pkg.name}
                            </Link>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {ECOSYSTEM_LABELS[pkg.ecosystem] ?? pkg.ecosystem}
                            </span>
                          </div>
                          {pkg.description && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">{pkg.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {pkg.versions.length} version{pkg.versions.length !== 1 ? "s" : ""} · Latest:{" "}
                            {pkg.versions[0]?.version ?? "none"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/software/${pkg.slug}/versions`}>
                            <Button variant="outline" size="sm">Manage</Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Stacks */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="h-5 w-5" /> My stacks ({user.stacks.length})
              </h2>
              <Link href="/stacks/new">
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />New stack</Button>
              </Link>
            </div>
            {user.stacks.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No stacks yet. Build your dependency graph.</p>
                  <Link href="/stacks/new" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">Create stack</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {user.stacks.map((stack) => (
                  <Link key={stack.id} href={`/stacks/${stack.id}`}>
                    <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{stack.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Updated {formatDate(stack.updatedAt)}
                          </span>
                        </div>
                        {stack.description && (
                          <p className="text-sm text-muted-foreground">{stack.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Security Scans */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ScanLine className="h-5 w-5" /> Security scans
              </h2>
              <Link href="/scans">
                <Button size="sm" variant="outline">View all scans</Button>
              </Link>
            </div>
            {recentScans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <ScanLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scans yet. Run the scanner on your project.</p>
                  <Link href="/settings" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">Get your API key</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentScans.map((report) => {
                  const plain = getPlainSummary(report.riskLevel, report.vulnerableDeps, report.totalAdvisories);
                  const cleanName = report.projectName.replace(/^.*[\\/]/, "");
                  return (
                    <Card key={report.id} className="relative hover:bg-muted/30 transition-colors">
                      <Link href={`/scans/${report.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={`View scan for ${cleanName}`} />
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${plain.statusDot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{cleanName}</span>
                              <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${plain.statusBg} ${plain.statusColor}`}>
                                {getRiskLevelLabel(report.riskLevel)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{formatDate(report.scannedAt)}</p>
                          </div>
                          <div className="relative z-10 flex items-center gap-1 shrink-0">
                            {report.stackId && (
                              <Link href={`/stacks/${report.stackId}`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                                  <GitBranch className="h-3 w-3" />
                                  Map
                                </Button>
                              </Link>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Badges */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Award className="h-5 w-5" /> Compliance badges
              </h2>
              <Link href="/badges">
                <Button size="sm" variant="outline">Manage badges</Button>
              </Link>
            </div>
            {user.badges.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-muted-foreground">
                  <p className="text-sm">No badges requested yet.</p>
                  <Link href="/badges" className="mt-2 inline-block">
                    <Button variant="outline" size="sm">Request a badge</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.badges.map((b) => (
                  <div key={b.id} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
                    b.status === "APPROVED" ? "bg-green-50 border-green-200 text-green-800" :
                    b.status === "PENDING" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                    "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <Award className="h-3.5 w-3.5" />
                    {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                    <span className="text-xs opacity-70">({b.status})</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
