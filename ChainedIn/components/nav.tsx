import Link from "next/link";
import { auth } from "@/auth";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { SearchBar } from "@/components/search-bar";

export async function Nav() {
  const session = await auth();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto px-4 flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Shield className="h-5 w-5 text-primary" />
          ChainedIn
        </Link>

        {/* Global search with autocomplete */}
        <SearchBar />

        <div className="flex items-center gap-4 ml-auto">
          <Link href="/directory" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
            Companies
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
