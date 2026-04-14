import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Fuse from "fuse.js";

export interface Suggestion {
  id: string;
  label: string;
  sublabel: string;   // e.g. "Company" or "npm package"
  href: string;
  type: "profile" | "software";
}

// Cache the search corpus for the lifetime of the server process.
// On a small dataset this is fine — re-fetches on cold start only.
let corpusCache: { profiles: any[]; software: any[] } | null = null;
let cacheBuiltAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function getCorpus() {
  if (corpusCache && Date.now() - cacheBuiltAt < CACHE_TTL_MS) return corpusCache;

  const [profiles, software] = await Promise.all([
    prisma.user.findMany({
      where: { type: { not: "ADMIN" } },
      select: { id: true, name: true, type: true, bio: true },
    }),
    prisma.software.findMany({
      select: { id: true, name: true, slug: true, ecosystem: true, description: true },
    }),
  ]);

  corpusCache = { profiles, software };
  cacheBuiltAt = Date.now();
  return corpusCache;
}

const ECOSYSTEM_LABELS: Record<string, string> = {
  npm: "npm", pip: "PyPI", maven: "Maven", cargo: "Cargo",
  gem: "RubyGems", nuget: "NuGet", go: "Go", other: "Other",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  // scope: "all" (default) | "profiles" | "software"
  const scope = searchParams.get("scope") ?? "all";

  if (q.length < 2) return NextResponse.json([]);

  const { profiles, software } = await getCorpus();

  const profileHits: Suggestion[] = scope !== "software"
    ? new Fuse(profiles, {
        keys: [{ name: "name", weight: 2 }, { name: "bio", weight: 0.5 }],
        threshold: 0.45,
        includeScore: true,
        minMatchCharLength: 2,
      }).search(q, { limit: 5 }).map(r => ({
        id: r.item.id,
        label: r.item.name,
        sublabel: r.item.type === "COMPANY" ? "Company" : "Individual",
        href: `/profile/${r.item.id}`,
        type: "profile" as const,
        _score: r.score ?? 1,
      }))
    : [];

  const softwareHits: Suggestion[] = scope !== "profiles"
    ? new Fuse(software, {
        keys: [{ name: "name", weight: 2 }, { name: "slug", weight: 1.5 }, { name: "description", weight: 0.5 }],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      }).search(q, { limit: 5 }).map(r => ({
        id: r.item.id,
        label: r.item.name,
        sublabel: `${ECOSYSTEM_LABELS[r.item.ecosystem] ?? r.item.ecosystem} package`,
        href: `/software/${r.item.slug}`,
        type: "software" as const,
        _score: r.score ?? 1,
      }))
    : [];

  const suggestions = [...profileHits, ...softwareHits]
    .sort((a: any, b: any) => (a._score ?? 1) - (b._score ?? 1))
    .slice(0, 8)
    .map(({ _score, ...s }: any) => s as Suggestion);

  return NextResponse.json(suggestions);
}
