import Link from "next/link";
import { auth } from "@/auth";
import { Search, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

export async function Nav() {
  const session = await auth();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Shield className="h-5 w-5 text-primary" />
          ChainedIn
        </Link>

        {/* Global search */}
        <form method="GET" action="/search" className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              name="q"
              placeholder="Search profiles & packages…"
              className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </form>

        <div className="flex items-center gap-4 ml-auto">
          <Link href="/directory" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
            Directory
          </Link>
          {session?.user ? (
            <>
              {(session.user as { type?: string }).type === "ADMIN" && (
                <Link href="/admin/badges" className="text-sm text-muted-foreground hover:text-foreground">
                  Admin
                </Link>
              )}
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
