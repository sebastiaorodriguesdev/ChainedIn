import Link from "next/link";
import { Shield, Award, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { computeTrustScore } from "@/lib/trust-score";

async function getTopSuppliers() {
  const companies = await prisma.user.findMany({
    where: { type: "COMPANY" },
    include: {
      software: {
        include: {
          versions: {
            include: { cveCache: { select: { severity: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      badges: { where: { status: "APPROVED" }, select: { id: true } },
    },
  });

  return companies
    .map(c => ({ company: c, trust: computeTrustScore(c) }))
    .filter(({ trust }) => trust !== null)
    .sort((a, b) => b.trust!.score - a.trust!.score)
    .slice(0, 5);
}

export default async function LandingPage() {
  const [session, topSuppliers] = await Promise.all([
    auth(),
    getTopSuppliers(),
  ]);

  return (
    <main>
      {/* ── Hero ── */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm font-medium text-muted-foreground">
            <Shield className="h-4 w-4" />
            Cyber Trust Network
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Know exactly which dependencies are safe to use
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            ChainedIn connects CVE vulnerability data to software releases so you can instantly see which versions are safe, build trusted stacks, and verify compliance credentials.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Start building</Button>
            </Link>
            <Link href="#how">
              <Button variant="outline" size="lg">How it works</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works — two illustrated panels ── */}
      <section id="how" className="border-t bg-muted/20">
        <div className="container mx-auto px-4 py-20">
          <h2 className="mb-4 text-center text-3xl font-bold">How it works</h2>
          <p className="mb-14 text-center text-muted-foreground max-w-xl mx-auto">
            Whether you publish software or depend on it, ChainedIn gives you the full picture.
          </p>

          <div className="flex flex-col gap-10 max-w-5xl mx-auto">

            {/* Panel A — supplier story */}
            <div className="rounded-2xl border bg-card overflow-hidden grid md:grid-cols-2">
              {/* Mockup */}
              <div className="bg-muted/40 p-8 flex items-center justify-center order-last md:order-first">
                <div className="w-full max-w-xs space-y-3">
                  {/* Profile header */}
                  <div className="rounded-xl border bg-background p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">Acme Security Libs</p>
                        <p className="text-xs text-muted-foreground">3 packages · 1 badge</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <Award className="h-3 w-3" />ISO 27001
                      </span>
                    </div>
                    {/* Trust score */}
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular-nums" style={{ color: "#16a34a" }}>94</span>
                      <span className="text-xs font-semibold text-green-600 mb-1">Excellent</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: "94%", backgroundColor: "#16a34a" }} />
                    </div>
                  </div>
                  {/* Package rows */}
                  {[
                    { name: "acme-auth", ver: "v3.2.1", status: "Clean ✓", color: "#16a34a", bg: "#f0fdf4", textColor: "#15803d" },
                    { name: "acme-crypto", ver: "v1.8.0", status: "Clean ✓", color: "#16a34a", bg: "#f0fdf4", textColor: "#15803d" },
                    { name: "acme-logger", ver: "v2.0.0", status: "1 MEDIUM",  color: "#ca8a04", bg: "#fefce8", textColor: "#a16207" },
                  ].map(pkg => (
                    <div key={pkg.name} className="rounded-lg border bg-background px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{pkg.name}</p>
                        <p className="text-xs text-muted-foreground">{pkg.ver}</p>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold border"
                        style={{ color: pkg.textColor, backgroundColor: pkg.bg, borderColor: pkg.color + "40" }}
                      >
                        {pkg.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Text */}
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">For software suppliers</p>
                <h3 className="text-2xl font-bold mb-4">Your software, proven secure</h3>
                <p className="text-muted-foreground mb-6 text-sm">
                  Publish your packages, get a live Trust Score, and let buyers see exactly how safe every release is — before they integrate it.
                </p>
                <ul className="space-y-3">
                  {[
                    "List packages and version history in minutes",
                    "CVE overlay from NIST NVD shows which versions are safe",
                    "Earn ISO 27001, NIS2, SOC 2 badges — admin-verified, publicly displayed",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Panel B — stack builder story */}
            <div className="rounded-2xl border bg-card overflow-hidden grid md:grid-cols-2">
              {/* Text */}
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">For engineering teams</p>
                <h3 className="text-2xl font-bold mb-4">Secure by design, maintained by sight</h3>
                <p className="text-muted-foreground mb-6 text-sm">
                  Map your dependency graph and instantly see where your supply chain is exposed. Color-coded CVE severity means no guesswork.
                </p>
                <ul className="space-y-3">
                  {[
                    "Visual canvas: drag, connect, and organise your full stack",
                    "Every node shows real-time CVE status — green to critical",
                    "Spot weak links before they become incidents",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Canvas mockup */}
              <div className="bg-muted/40 p-8 flex items-center justify-center">
                <div className="relative w-full max-w-xs h-52">
                  {/* SVG connecting lines */}
                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} aria-hidden>
                    {/* Next.js → React */}
                    <line x1="80" y1="40" x2="220" y2="40" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* Next.js → lodash */}
                    <line x1="80" y1="40" x2="80" y2="120" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* lodash → axios */}
                    <line x1="80" y1="120" x2="220" y2="120" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* React → openssl */}
                    <line x1="220" y1="40" x2="220" y2="120" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                    {/* lodash → jwt */}
                    <line x1="80" y1="120" x2="150" y2="190" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>

                  {/* Nodes */}
                  {[
                    { label: "Next.js", sub: "v14.2.0", x: 10, y: 16, border: "#16a34a", bg: "#16a34a0d", dot: "#16a34a" },
                    { label: "React", sub: "v18.3.0", x: 168, y: 16, border: "#16a34a", bg: "#16a34a0d", dot: "#16a34a" },
                    { label: "lodash", sub: "v4.17.21", x: 10, y: 96, border: "#ca8a04", bg: "#ca8a040d", dot: "#ca8a04" },
                    { label: "axios", sub: "v1.6.0", x: 168, y: 96, border: "#dc2626", bg: "#dc26260d", dot: "#dc2626" },
                    { label: "jsonwebtoken", sub: "v9.0.0", x: 88, y: 168, border: "#16a34a", bg: "#16a34a0d", dot: "#16a34a" },
                  ].map(node => (
                    <div
                      key={node.label}
                      className="absolute rounded-lg border-2 px-2.5 py-1.5 text-xs font-medium shadow-sm bg-background"
                      style={{ left: node.x, top: node.y, borderColor: node.border, backgroundColor: node.bg, zIndex: 1, minWidth: 80 }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: node.dot }} />
                        <span className="font-semibold truncate">{node.label}</span>
                      </div>
                      <p className="text-muted-foreground text-[10px] pl-3.5">{node.sub}</p>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="absolute bottom-0 right-0 flex gap-2 text-[10px] text-muted-foreground bg-background/80 rounded-md px-2 py-1 border" style={{ zIndex: 2 }}>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" />Clean</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" />Medium</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" />Critical</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Top-rated suppliers ── */}
      {topSuppliers.length > 0 && (
        <section className="border-t">
          <div className="container mx-auto px-4 py-16">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-2">Top-rated software suppliers</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Browse companies publishing software on ChainedIn, ranked by Trust Score — a measure of CVE cleanliness, patch speed, and compliance certifications.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 max-w-5xl mx-auto">
              {topSuppliers.map(({ company, trust }, i) => (
                <Link
                  key={company.id}
                  href={`/profile/${company.id}`}
                  className="group relative rounded-xl border bg-background p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
                >
                  <span className={`absolute -top-3 -left-3 h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-sm bg-background ${
                    i === 0 ? "border-yellow-400 text-yellow-600" :
                    i === 1 ? "border-slate-400 text-slate-600" :
                    i === 2 ? "border-amber-600 text-amber-700" :
                    "border-muted text-muted-foreground"
                  }`}>
                    #{i + 1}
                  </span>

                  <p className="font-semibold text-sm truncate group-hover:underline mt-1">
                    {company.name}
                  </p>

                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold tabular-nums" style={{ color: trust!.color }}>
                      {trust!.score}
                    </span>
                    <span className={`text-xs font-semibold mb-1 ${trust!.gradeColor}`}>
                      {trust!.grade}
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${trust!.score}%`, backgroundColor: trust!.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{company.software.length} pkg{company.software.length !== 1 ? "s" : ""}</span>
                    {company.badges.length > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600">
                        <Award className="h-3 w-3" />
                        {company.badges.length}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex justify-center mt-8">
              <Link href="/directory">
                <Button variant="outline">
                  Browse all companies
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Score is based on the CVE status of each package&apos;s latest release plus bonuses for patching past vulnerabilities and holding compliance certifications.
            </p>
          </div>
        </section>
      )}

      {/* ── Visualise your stack CTA ── */}
      <section className="border-t bg-muted/20">
        <div className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-10 items-center max-w-4xl mx-auto">
            <div>
              <h2 className="text-2xl font-bold mb-3">Visualise your stack</h2>
              <p className="text-muted-foreground mb-6">
                Map every dependency. See your supply chain&apos;s CVE exposure at a glance. Know exactly where to act before something breaks in production.
              </p>
              <Link href="/stacks">
                <Button>
                  Start building
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            {/* Mini canvas repeat */}
            <div className="relative h-44 rounded-xl border bg-background shadow-sm overflow-hidden p-4">
              <svg className="absolute inset-0 w-full h-full" aria-hidden>
                <line x1="90" y1="44" x2="230" y2="44" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                <line x1="90" y1="44" x2="90" y2="118" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
                <line x1="90" y1="118" x2="230" y2="118" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              {[
                { label: "postgres", sub: "v15", x: 14, y: 20, border: "#16a34a", bg: "#16a34a0d", dot: "#16a34a" },
                { label: "redis", sub: "v7.2", x: 165, y: 20, border: "#ea580c", bg: "#ea580c0d", dot: "#ea580c" },
                { label: "express", sub: "v4.18", x: 14, y: 94, border: "#ca8a04", bg: "#ca8a040d", dot: "#ca8a04" },
                { label: "zod", sub: "v3.22", x: 165, y: 94, border: "#16a34a", bg: "#16a34a0d", dot: "#16a34a" },
              ].map(node => (
                <div
                  key={node.label}
                  className="absolute rounded-lg border-2 px-2.5 py-1.5 text-xs font-medium shadow-sm"
                  style={{ left: node.x, top: node.y, borderColor: node.border, backgroundColor: node.bg, zIndex: 1, minWidth: 76 }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: node.dot }} />
                    <span className="font-semibold">{node.label}</span>
                  </div>
                  <p className="text-muted-foreground text-[10px] pl-3.5">{node.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase your software CTA ── */}
      <section className="border-t">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-3">Showcase your software</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Register your packages, link CVE data, earn compliance badges. Build trust with every release — and let buyers see your security posture before they depend on you.
          </p>
          <Link href={session?.user ? "/software/new" : "/register"}>
            <Button size="lg">
              {session?.user ? "Add your software" : "Get started free"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Bottom CTA — logged-out only ── */}
      {!session?.user && (
        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-16 text-center">
            <h2 className="mb-4 text-2xl font-bold">Ready to build trusted software?</h2>
            <p className="mb-8 text-muted-foreground">Join the platform and make dependency security visible.</p>
            <Link href="/register">
              <Button size="lg">Create your profile</Button>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
