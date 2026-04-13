import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { BADGE_LABELS, ECOSYSTEM_LABELS } from "@/lib/utils";
import { Award, Building2, Package, User } from "lucide-react";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: { type?: string; q?: string };
}) {
  const typeFilter = searchParams.type; // "company" | "person" | undefined
  const q = searchParams.q?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: {
      type: { not: "ADMIN" },
      ...(typeFilter === "company" && { type: "COMPANY" }),
      ...(typeFilter === "person"  && { type: "PERSON"  }),
      ...(q && { name: { contains: q } }),
    },
    include: {
      software: { select: { id: true } },
      badges: { where: { status: "APPROVED" } },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const tabs = [
    { label: "All",       value: undefined },
    { label: "Companies", value: "company" },
    { label: "People",    value: "person"  },
  ];

  function tabHref(value?: string) {
    const params = new URLSearchParams();
    if (value) params.set("type", value);
    if (q)     params.set("q", q);
    const s = params.toString();
    return `/directory${s ? `?${s}` : ""}`;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Directory</h1>
        <p className="text-muted-foreground">
          Browse companies and individuals on ChainedIn
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <form method="GET" action="/directory" className="flex gap-2 flex-1 max-w-sm">
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
          {q && (
            <Link
              href={tabHref(typeFilter)}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"
            >
              Clear
            </Link>
          )}
        </form>

        {/* Type tabs */}
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/30 w-fit">
          {tabs.map((tab) => {
            const active = (tab.value ?? "") === (typeFilter ?? "");
            return (
              <Link
                key={tab.label}
                href={tabHref(tab.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {users.length} profile{users.length !== 1 ? "s" : ""}
        {q && <> matching <strong>"{q}"</strong></>}
      </p>

      {/* Grid */}
      {users.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No profiles found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => {
            const isCompany = user.type === "COMPANY";
            return (
              <Link
                key={user.id}
                href={`/profile/${user.id}`}
                className="group rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
              >
                {/* Avatar + name */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0">
                    {user.logoUrl ? (
                      <Image
                        src={user.logoUrl}
                        alt={user.name}
                        width={44}
                        height={44}
                        className="rounded-full object-cover border"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center border">
                        {isCompany
                          ? <Building2 className="h-5 w-5 text-muted-foreground" />
                          : <User className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate group-hover:underline">
                      {user.name}
                    </p>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 ${
                      isCompany
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {isCompany ? "Company" : "Individual"}
                    </span>
                  </div>
                </div>

                {/* Bio */}
                {user.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {user.bio}
                  </p>
                )}

                {/* Footer: software count + badges */}
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    {user.software.length} package{user.software.length !== 1 ? "s" : ""}
                  </span>
                  {user.badges.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {user.badges.slice(0, 3).map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-0.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                          title={BADGE_LABELS[b.badgeType]}
                        >
                          <Award className="h-3 w-3" />
                          {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                        </span>
                      ))}
                      {user.badges.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{user.badges.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
