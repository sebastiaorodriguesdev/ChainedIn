import Link from "next/link";
import { LayoutDashboard, Package, GitBranch, Award, Settings, ShieldCheck, ScanLine, Trophy, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/software/new", label: "Add Software", icon: Package },
  { href: "/stacks", label: "My Stacks", icon: GitBranch },
  { href: "/scans", label: "Security Scans", icon: ScanLine },
  { href: "/nis2", label: "NIS2 Compliance", icon: ClipboardCheck },
  { href: "/vendors", label: "Vendor Scores", icon: Trophy },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ currentPath }: { currentPath?: string }) {
  return (
    <aside className="w-56 shrink-0">
      <nav className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              currentPath?.startsWith(href) && href !== "/software/new"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function AdminSidebar({ currentPath }: { currentPath?: string }) {
  return (
    <aside className="w-56 shrink-0">
      <nav className="flex flex-col gap-1">
        <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
        <Link
          href="/admin/badges"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
            currentPath?.startsWith("/admin/badges") ? "bg-accent" : "text-muted-foreground"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          Badge Requests
        </Link>
        <div className="mt-4 border-t pt-4">
          <Sidebar currentPath={currentPath} />
        </div>
      </nav>
    </aside>
  );
}
