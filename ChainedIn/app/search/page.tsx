import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { BADGE_LABELS } from "@/lib/utils";
import { Award, Building2, Package, Search, User } from "lucide-react";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() ?? "";

  if (!q) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
        <Search className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Search ChainedIn</h1>
        <p className="text-muted-foreground mb-8">
          Find companies, individuals, and software packages.
        </p>
        <form method="GET" action="/search" className="flex gap-2 justify-center">
          <input
            name="q"
            autoFocus
            placeholder="Search…"
            className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </div>
    );
  }

  const [users, software] = await Promise.all([
    prisma.user.findMany({
      where: {
        type: { not: "ADMIN" },
        name: { contains: q },
      },
      include: {
        software: { select: { id: true } },
        badges: { where: { status: "APPROVED" } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      take: 12,
    }),
    prisma.software.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { slug: { contains: q } },
          { description: { contains: q } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, logoUrl: true, type: true } },
        versions: {
          orderBy: { releasedAt: "desc" },
          take: 1,
          select: { version: true },
        },
      },
      orderBy: { name: "asc" },
      take: 12,
    }),
  ]);

  const total = users.length + software.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header + search bar */}
      <div className="mb-8">
        <form method="GET" action="/search" className="flex gap-2 max-w-lg">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search…"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
        <p className="text-sm text-muted-foreground mt-3">
          {total} result{total !== 1 ? "s" : ""} for <strong>"{q}"</strong>
        </p>
      </div>

      {total === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          No results found. Try a different search term.
        </div>
      )}

      {/* Profiles section */}
      {users.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4" />
            Profiles
            <span className="text-sm font-normal text-muted-foreground">({users.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => {
              const isCompany = user.type === "COMPANY";
              return (
                <Link
                  key={user.id}
                  href={`/profile/${user.id}`}
                  className="group rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {user.logoUrl ? (
                        <Image
                          src={user.logoUrl}
                          alt={user.name}
                          width={40}
                          height={40}
                          className="rounded-full object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border">
                          {isCompany
                            ? <Building2 className="h-4 w-4 text-muted-foreground" />
                            : <User className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate group-hover:underline">{user.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                          isCompany ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                        }`}>
                          {isCompany ? "Company" : "Individual"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.software.length} pkg{user.software.length !== 1 ? "s" : ""}
                        </span>
                        {user.badges.slice(0, 2).map((b) => (
                          <span
                            key={b.id}
                            className="inline-flex items-center gap-0.5 rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700"
                            title={BADGE_LABELS[b.badgeType]}
                          >
                            <Award className="h-2.5 w-2.5" />
                            {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {users.length === 12 && (
            <p className="text-sm text-muted-foreground mt-3">
              Showing first 12 profiles.{" "}
              <Link href={`/directory?q=${encodeURIComponent(q)}`} className="underline hover:text-foreground">
                Browse all in Directory →
              </Link>
            </p>
          )}
        </section>
      )}

      {/* Software section */}
      {software.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Software Packages
            <span className="text-sm font-normal text-muted-foreground">({software.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {software.map((pkg) => (
              <Link
                key={pkg.id}
                href={`/software/${pkg.slug}`}
                className="group rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center border">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:underline">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{pkg.slug}</p>
                  </div>
                  {pkg.versions[0] && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      v{pkg.versions[0].version}
                    </span>
                  )}
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                    {pkg.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {pkg.owner.logoUrl ? (
                    <Image
                      src={pkg.owner.logoUrl}
                      alt={pkg.owner.name}
                      width={16}
                      height={16}
                      className="rounded-full border"
                    />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-muted border flex items-center justify-center">
                      {pkg.owner.type === "COMPANY"
                        ? <Building2 className="h-2.5 w-2.5" />
                        : <User className="h-2.5 w-2.5" />}
                    </div>
                  )}
                  {pkg.owner.name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
