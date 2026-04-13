import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { GitBranch, Plus } from "lucide-react";

export default async function StacksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const stacks = await prisma.stack.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { nodes: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/stacks" />
        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitBranch className="h-6 w-6" /> My Stacks
            </h1>
            <Link href="/stacks/new">
              <Button><Plus className="h-4 w-4 mr-1" />New stack</Button>
            </Link>
          </div>

          {stacks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground mb-4">No stacks yet. Build your first dependency graph.</p>
                <Link href="/stacks/new">
                  <Button variant="outline">Create stack</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {stacks.map((stack) => (
                <Link key={stack.id} href={`/stacks/${stack.id}`}>
                  <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{stack.name}</p>
                          {stack.description && (
                            <p className="text-sm text-muted-foreground">{stack.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {stack._count.nodes} node{stack._count.nodes !== 1 ? "s" : ""} · Updated {formatDate(stack.updatedAt)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">Open</Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
