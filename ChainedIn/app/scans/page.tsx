import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getRiskLevelLabel, getPlainSummary } from "@/lib/scan-plain-language";
import { ShieldCheck, ShieldAlert, Clock, ChevronRight, GitBranch } from "lucide-react";

interface ScanListItem {
  id: string;
  projectName: string;
  scannedAt: Date;
  totalDeps: number;
  vulnerableDeps: number;
  totalAdvisories: number;
  ecosystems: string;
  riskLevel: string;
  stackId: string | null;
}

export default async function ScansPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Raw SQL so stackId (column added after client generation) is included.
  const reports = await prisma.$queryRaw<ScanListItem[]>`
    SELECT id, "projectName", "scannedAt", "totalDeps", "vulnerableDeps",
           "totalAdvisories", ecosystems, "riskLevel", "stackId"
    FROM   "ScanReport"
    WHERE  "userId" = ${session.user.id}
    ORDER  BY "scannedAt" DESC
  `;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/scans" />
        <main className="flex-1 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">Security Scans</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Results from running the ChainedIn scanner on your projects.
              </p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm">Get API key</Button>
            </Link>
          </div>

          {reports.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No scans yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Run the ChainedIn scanner on your project and upload the results using your API key.
                </p>
                <div className="mt-4 bg-muted rounded-md px-4 py-3 text-left max-w-md mx-auto text-xs font-mono">
                  <p className="text-muted-foreground mb-1"># Install &amp; scan</p>
                  <p>pip install chainedIn</p>
                  <p>chainedIn scan . --upload --api-key YOUR_KEY</p>
                </div>
                <Link href="/settings" className="mt-4 inline-block">
                  <Button variant="outline" size="sm">Generate API key</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const ecosystems: string[] = JSON.parse(report.ecosystems);
                const summary = getPlainSummary(report.riskLevel, report.vulnerableDeps, report.totalAdvisories);
                const cleanName = report.projectName.replace(/^.*[\\/]/, "");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stackId: string | null = (report as any).stackId ?? null;
                return (
                  <Card key={report.id} className="relative hover:bg-muted/30 transition-colors">
                    {/* Stretched link covers the whole card */}
                    <Link href={`/scans/${report.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={`View scan for ${cleanName}`} />
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className={`h-3 w-3 rounded-full shrink-0 ${summary.statusDot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{cleanName}</span>
                            <span className={`text-xs rounded-full border px-2 py-0.5 font-semibold ${summary.statusBg} ${summary.statusColor}`}>
                              {getRiskLevelLabel(report.riskLevel)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {report.totalDeps} dependencies · {report.vulnerableDeps} vulnerable ·{" "}
                            {ecosystems.join(", ")} · {formatDate(report.scannedAt)}
                          </p>
                        </div>
                        <div className="relative z-10 flex items-center gap-1 shrink-0">
                          {stackId && (
                            <Link href={`/stacks/${stackId}`}>
                              <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
                                <GitBranch className="h-3.5 w-3.5" />
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
        </main>
      </div>
    </div>
  );
}
