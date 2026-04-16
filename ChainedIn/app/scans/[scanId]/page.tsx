import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { getPlainSummary, getActionForSeverity } from "@/lib/scan-plain-language";
import { ArrowLeft, ShieldAlert, ShieldCheck, ChevronDown, ChevronRight, ExternalLink, GitBranch } from "lucide-react";

interface Advisory {
  id: string;
  summary: string;
  severity: string;
  cvss_score: number | null;
  fixed_versions: string[];
  has_exploit: boolean;
  aliases?: string[];
}

interface Finding {
  dependency: {
    name: string;
    version: string;
    ecosystem: string;
    source_file: string;
  };
  advisories: Advisory[];
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];

function groupByHighestSeverity(findings: Finding[]): Record<string, Finding[]> {
  const groups: Record<string, Finding[]> = {};
  for (const f of findings) {
    const severities = f.advisories.map((a) => a.severity);
    const highest = SEVERITY_ORDER.find((s) => severities.includes(s)) ?? "UNKNOWN";
    if (!groups[highest]) groups[highest] = [];
    groups[highest].push(f);
  }
  return groups;
}

export default async function ScanReportPage({ params }: { params: { scanId: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const report = await prisma.scanReport.findUnique({ where: { id: params.scanId } });
  if (!report) notFound();
  if (report.userId !== session.user.id) notFound();

  // Fetch stackId via raw SQL — column added after client generation.
  const stackRows = await prisma.$queryRaw<Array<{ stackId: string | null }>>`
    SELECT "stackId" FROM "ScanReport" WHERE id = ${params.scanId}
  `;
  const stackId: string | null = stackRows[0]?.stackId ?? null;

  const findings: Finding[] = JSON.parse(report.findingsJson);
  const ecosystems: string[] = JSON.parse(report.ecosystems);
  const grouped = groupByHighestSeverity(findings);
  const summary = getPlainSummary(report.riskLevel, report.vulnerableDeps, report.totalAdvisories);

  const cleanProjectName = report.projectName.replace(/^.*[\\/]/, "");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/scans" />
        <main className="flex-1 space-y-6">

          {/* Back link */}
          <div className="flex items-center gap-2">
            <Link href="/scans">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" /> All scans
              </Button>
            </Link>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{cleanProjectName}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Scanned on {formatDate(report.scannedAt)} · {report.totalDeps} dependencies checked ·{" "}
                {ecosystems.join(", ")}
              </p>
            </div>
            {stackId && (
              <Link href={`/stacks/${stackId}`}>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <GitBranch className="h-4 w-4" />
                  View dependency map
                </Button>
              </Link>
            )}
          </div>

          {/* Status card */}
          <Card className={`border-2 ${summary.statusBg}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`mt-1 h-4 w-4 rounded-full shrink-0 ${summary.statusDot}`} />
                <div className="flex-1">
                  <h2 className={`text-lg font-semibold ${summary.statusColor}`}>{summary.headline}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{summary.subheadline}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${summary.statusBg} ${summary.statusColor}`}>
                  {summary.actionLabel}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total dependencies", value: report.totalDeps },
              { label: "Vulnerable packages", value: report.vulnerableDeps },
              { label: "Security issues", value: report.totalAdvisories },
              { label: "Scan time", value: `${report.scanDurationSecs.toFixed(1)}s` },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* What does this mean section */}
          {report.riskLevel !== "CLEAN" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What does this mean for your business?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  The scanner checked all third-party libraries your software depends on against a global database of
                  known security vulnerabilities. Each vulnerability has a severity rating based on how easy it is to
                  exploit and how much damage it can cause.
                </p>
                <p>
                  Your engineering team can fix most issues by simply upgrading the affected package to a newer,
                  patched version — the table below shows exactly what to upgrade.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Findings grouped by severity */}
          {report.riskLevel !== "CLEAN" ? (
            <div className="space-y-6">
              {SEVERITY_ORDER.filter((s) => grouped[s]?.length).map((sev) => {
                const action = getActionForSeverity(sev);
                return (
                  <section key={sev}>
                    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 mb-3 ${action.bg}`}>
                      <ShieldAlert className={`h-4 w-4 ${action.color}`} />
                      <span className={`font-semibold text-sm ${action.color}`}>
                        {sev} — {action.label}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{action.description}</span>
                    </div>
                    <div className="space-y-3">
                      {grouped[sev].map((finding) => (
                        <FindingCard key={`${finding.dependency.ecosystem}:${finding.dependency.name}@${finding.dependency.version}`} finding={finding} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-semibold text-green-700">No vulnerabilities found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All {report.totalDeps} dependencies are clean as of this scan.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const { dependency, advisories } = finding;
  const severities = advisories.map((a) => a.severity);
  const highest = SEVERITY_ORDER.find((s) => severities.includes(s)) ?? "UNKNOWN";
  const action = getActionForSeverity(highest);
  const hasExploit = advisories.some((a) => a.has_exploit);
  const fixVersions = advisories.flatMap((a) => a.fixed_versions).filter(Boolean);
  const uniqueFixes = Array.from(new Set(fixVersions));

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold">{dependency.name}</span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                v{dependency.version}
              </span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {dependency.ecosystem}
              </span>
              {hasExploit && (
                <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-semibold">
                  Active exploit known
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-1">
              {advisories.length} security {advisories.length === 1 ? "issue" : "issues"} found
              {uniqueFixes.length > 0 ? (
                <> · <span className="text-green-700 font-medium">Fix: upgrade to {uniqueFixes.slice(0, 2).join(" or ")}</span></>
              ) : (
                <> · <span className="text-yellow-700">No fix available yet — monitor for updates</span></>
              )}
            </p>

            {/* Advisory list */}
            <div className="mt-3 space-y-2">
              {advisories.map((adv) => {
                const cve = adv.aliases?.find((a) => a.startsWith("CVE-")) ?? adv.id;
                return (
                  <div key={adv.id} className="text-xs bg-muted/50 rounded p-2 border border-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{cve}</span>
                      {adv.cvss_score != null && (
                        <span className="text-muted-foreground">CVSS {adv.cvss_score.toFixed(1)}</span>
                      )}
                    </div>
                    {adv.summary && (
                      <p className="mt-0.5 text-muted-foreground leading-snug">{adv.summary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${action.bg} ${action.color}`}>
            {action.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
