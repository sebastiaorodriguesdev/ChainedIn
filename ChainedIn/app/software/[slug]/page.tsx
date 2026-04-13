import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ECOSYSTEM_LABELS, BADGE_LABELS, formatDate } from "@/lib/utils";
import { SeverityRow } from "@/components/severity-badge";
import { CveStackedBar, CveTimeline } from "@/components/cve-charts";
import { Award, ExternalLink, Package, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SoftwareDetailPage({ params }: { params: { slug: string } }) {
  const pkg = await prisma.software.findUnique({
    where: { slug: params.slug },
    include: {
      owner: {
        select: { id: true, name: true, type: true, logoUrl: true, badges: true },
      },
      versions: {
        include: { cveCache: { orderBy: { cvssScore: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pkg) notFound();

  const approvedBadges = pkg.owner.badges.filter((b) => b.status === "APPROVED");

  const allCves = pkg.versions.flatMap((v) =>
    v.cveCache.map((c) => ({ ...c, version: v.version }))
  );

  const chartData = pkg.versions.map((v) => ({
    version: v.version,
    cves: v.cveCache.map((c) => ({
      cveId: c.cveId,
      severity: c.severity,
      cvssScore: c.cvssScore,
      publishedAt: c.publishedAt.toISOString(),
    })),
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Package className="h-6 w-6 text-muted-foreground" />
            <h1 className="text-3xl font-bold">{pkg.name}</h1>
            <span className="text-sm bg-muted px-2 py-0.5 rounded font-medium">
              {ECOSYSTEM_LABELS[pkg.ecosystem] ?? pkg.ecosystem}
            </span>
          </div>
          {pkg.description && <p className="text-muted-foreground mt-2">{pkg.description}</p>}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/profile/${pkg.owner.id}`} className="hover:text-foreground flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {pkg.owner.name}
            </Link>
            {pkg.repoUrl && (
              <a href={pkg.repoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" />
                Repository
              </a>
            )}
            <span>{pkg.versions.length} version{pkg.versions.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* CVE Charts */}
      {pkg.versions.length > 0 && (
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vulnerability distribution by version</CardTitle>
            </CardHeader>
            <CardContent>
              <CveStackedBar data={chartData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CVE timeline (all versions)</CardTitle>
            </CardHeader>
            <CardContent>
              <CveTimeline allCves={allCves.map(c => ({ ...c, publishedAt: c.publishedAt.toISOString() }))} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Version list */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Releases</h2>
        {pkg.versions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No versions published yet.
            </CardContent>
          </Card>
        ) : (
          pkg.versions.map((v) => (
            <Card key={v.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-semibold text-lg">{v.version}</span>
                      {v.releasedAt && (
                        <span className="text-sm text-muted-foreground">{formatDate(v.releasedAt)}</span>
                      )}
                    </div>
                    <SeverityRow cves={v.cveCache} />
                    {v.changelog && (
                      <p className="text-sm text-muted-foreground mt-2">{v.changelog}</p>
                    )}
                    {v.cveCache.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          {v.cveCache.length} CVE{v.cveCache.length !== 1 ? "s" : ""} — click to expand
                        </summary>
                        <div className="mt-2 space-y-1">
                          {v.cveCache.slice(0, 10).map((c) => (
                            <div key={c.id} className="text-xs flex items-start gap-2 p-2 rounded bg-muted/50">
                              <span className="font-mono font-medium shrink-0">{c.cveId}</span>
                              <span className="text-muted-foreground line-clamp-2">{c.description}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {v.cveCache.length === 0 ? (
                      <span className="text-muted-foreground">No CVE data</span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
