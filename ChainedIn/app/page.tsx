import Link from "next/link";
import { Shield, Package, GitBranch, Award, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

async function getStats() {
  const [users, software] = await Promise.all([
    prisma.user.count(),
    prisma.software.count(),
  ]);
  return { users, software };
}

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <main>
      {/* Hero */}
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
              <Button size="lg">Get started free</Button>
            </Link>
            <Link href="#how">
              <Button variant="outline" size="lg">How it works</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <div>
              <p className="text-3xl font-bold">{stats.users}</p>
              <p className="text-sm text-muted-foreground">Registered profiles</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.software}</p>
              <p className="text-sm text-muted-foreground">Software packages</p>
            </div>
            <div>
              <p className="text-3xl font-bold">NVD</p>
              <p className="text-sm text-muted-foreground">CVE source (NIST)</p>
            </div>
            <div>
              <p className="text-3xl font-bold">100%</p>
              <p className="text-sm text-muted-foreground">Local & private</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how" className="container mx-auto px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Package,
              title: "List your software",
              desc: "Register your packages and version releases. Works with npm, PyPI, Maven, Cargo, and more.",
            },
            {
              icon: Shield,
              title: "CVE overlay",
              desc: "We pull data from the NIST NVD and show CRITICAL, HIGH, MEDIUM, LOW counts per version visually.",
            },
            {
              icon: GitBranch,
              title: "Private stack builder",
              desc: "Build your dependency graph privately. See your total vulnerability exposure at a glance.",
            },
            {
              icon: Award,
              title: "Compliance badges",
              desc: "Request ISO 27001, NIS2, SOC 2 and other compliance badges. Admin-verified before display.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="mb-4 text-2xl font-bold">Ready to build trusted software?</h2>
          <p className="mb-8 text-muted-foreground">Join the platform and make dependency security visible.</p>
          <Link href="/register">
            <Button size="lg">Create your profile</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
