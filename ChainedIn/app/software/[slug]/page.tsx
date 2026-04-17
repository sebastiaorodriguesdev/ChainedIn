import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ECOSYSTEM_LABELS, SEVERITY_COLORS, formatDate } from "@/lib/utils";
import { SeverityRow } from "@/components/severity-badge";
import { Award, ExternalLink, Package, User, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function SoftwareDetailPage({ params }: { params: { slug: string } }) {
  // Raw SQL — stale Prisma client rejects NULL ownerId during ORM deserialization.
  type SoftwareRow = {
    id: string; ownerId: string | null; name: string; slug: string;
    description: string | null; ecosystem: string; repoUrl: string | null;
  };
  const pkgRows = await prisma.$queryRaw<SoftwareRow[]>`
    SELECT id, "ownerId", name, slug, description, ecosystem, "repoUrl"
    FROM   "Software" WHERE slug = ${params.slug} LIMIT 1
  `;
  const pkgRow = pkgRows[0];
  if (!pkgRow) notFound();

  // Fetch owner + their badges if package is claimed.
  type OwnerRow = { id: string; name: string; type: string; logoUrl: string | null };
  type BadgeRow = { id: string; badgeType: string; status: string };
  const owner: OwnerRow | null = pkgRow.ownerId
    ? (await prisma.user.findUnique({
        where: { id: pkgRow.ownerId },
        select: { id: true, name: true, type: true, logoUrl: true },
      })) ?? null
    : null;
  const ownerBadges: BadgeRow[] = pkgRow.ownerId
    ? await prisma.badgeRequest.findMany({
        where: { userId: pkgRow.ownerId, status: "APPROVED" },
        select: { id: true, badgeType: true, status: true },
      })
    : [];

  // Fetch versions + CVE cache.
  type VersionRow = { id: string; version: string; releasedAt: Date | null; changelog: string | null; createdAt: Date };
  type CveRow = { id: string; cveId: string; severity: string; cvssScore: number | null; description: string | null };

  const versions = await prisma.$queryRaw<VersionRow[]>(
    Prisma.sql`
      SELECT id, version, "releasedAt", changelog, "createdAt"
      FROM   "SoftwareVersion"
      WHERE  "softwareId" = ${pkgRow.id}
      ORDER  BY "createdAt" DESC
    `
  );

  const cveRows: CveRow[] = versions.length > 0
    ? await prisma.$queryRaw<CveRow[]>(
        Prisma.sql`
          SELECT id, "softwareVersionId", "cveId", severity, "cvssScore", description
          FROM   "CveCache"
          WHERE  "softwareVersionId" IN (${Prisma.join(versions.map((v) => v.id))})
          ORDER  BY "cvssScore" DESC
        `
      )
    : [];

  const cveByVersion = new Map<string, CveRow[]>();
  for (const c of cveRows) {
    const svId = (c as any).softwareVersionId as string;
    if (!cveByVersion.has(svId)) cveByVersion.set(svId, []);
    cveByVersion.get(svId)!.push(c);
  }

  const pkg = {
    ...pkgRow,
    owner,
    versions: versions.map((v) => ({ ...v, cveCache: cveByVersion.get(v.id) ?? [] })),
  };

  const approvedBadges = ownerBadges.filter((b) => b.status === "APPROVED");


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
            {pkg.owner ? (
              <Link href={`/profile/${pkg.owner.id}`} className="hover:text-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {pkg.owner.name}
              </Link>
            ) : (
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Community package — <Link href="/software/new" className="underline hover:text-foreground">claim as vendor</Link>
              </span>
            )}
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
                  {v.cveCache.length === 0 && (() => {
                    const isUnscanned = v.releasedAt !== null &&
                      (Date.now() - new Date(v.releasedAt).getTime()) < 45 * 24 * 60 * 60 * 1000;
                    return (
                      <span
                        className="text-xs font-medium shrink-0 px-2 py-0.5 rounded-full border"
                        style={isUnscanned
                          ? { color: SEVERITY_COLORS.UNSCANNED, borderColor: SEVERITY_COLORS.UNSCANNED, backgroundColor: SEVERITY_COLORS.UNSCANNED + "18" }
                          : { color: SEVERITY_COLORS.NONE, borderColor: SEVERITY_COLORS.NONE, backgroundColor: SEVERITY_COLORS.NONE + "18" }}
                      >
                        {isUnscanned ? "Scan pending" : "Clean ✓"}
                      </span>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
