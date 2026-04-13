import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { BADGE_LABELS, ECOSYSTEM_LABELS, formatDate } from "@/lib/utils";
import { SeverityRow } from "@/components/severity-badge";
import { Award, Building2, User, ExternalLink, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function ProfilePage({ params }: { params: { userId: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      software: {
        include: {
          versions: {
            include: { cveCache: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      badges: {
        where: { status: "APPROVED" },
        orderBy: { resolvedAt: "desc" },
      },
    },
  });

  if (!user) notFound();

  const isCompany = user.type === "COMPANY";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile header */}
      <div className="mb-8 flex items-start gap-6">
        <div className="flex-shrink-0">
          {user.logoUrl ? (
            <Image
              src={user.logoUrl}
              alt={user.name}
              width={80}
              height={80}
              className="rounded-full object-cover border"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
              {isCompany ? <Building2 className="h-10 w-10 text-muted-foreground" /> : <User className="h-10 w-10 text-muted-foreground" />}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
              {isCompany ? "Company" : "Individual"}
            </span>
          </div>
          {user.bio && <p className="mt-2 text-muted-foreground">{user.bio}</p>}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            {user.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" />
                {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span>Member since {formatDate(user.createdAt)}</span>
          </div>

          {/* Approved badges */}
          {user.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.badges.map((b) => (
                <div
                  key={b.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-800"
                  title={`Verified ${BADGE_LABELS[b.badgeType] ?? b.badgeType}`}
                >
                  <Award className="h-3.5 w-3.5" />
                  {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                  <span className="text-green-600 text-xs">✓</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Software packages */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Software packages ({user.software.length})
        </h2>
        {user.software.length === 0 ? (
          <p className="text-muted-foreground text-sm">No packages published yet.</p>
        ) : (
          <div className="space-y-4">
            {user.software.map((pkg) => {
              const latestVersion = pkg.versions[0];
              const allCves = pkg.versions.flatMap((v) => v.cveCache);
              return (
                <Card key={pkg.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/software/${pkg.slug}`} className="font-semibold hover:underline">
                            {pkg.name}
                          </Link>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {ECOSYSTEM_LABELS[pkg.ecosystem] ?? pkg.ecosystem}
                          </span>
                        </div>
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground mb-2">
                          {pkg.versions.length} version{pkg.versions.length !== 1 ? "s" : ""}
                          {latestVersion && ` · Latest: ${latestVersion.version}`}
                        </div>
                        <SeverityRow cves={allCves} />
                      </div>
                      <Link href={`/software/${pkg.slug}`} className="shrink-0 text-sm text-muted-foreground hover:text-foreground hover:underline">
                        View →
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
