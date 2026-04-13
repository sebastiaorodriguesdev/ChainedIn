"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminSidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BADGE_LABELS, formatDate } from "@/lib/utils";
import { ShieldCheck, User, Building2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface BadgeRequest {
  id: string;
  badgeType: string;
  status: string;
  evidence: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  adminNote: string | null;
  user: { id: string; name: string; email: string; type: string };
}

const statusColor = {
  PENDING: "text-yellow-600 bg-yellow-50 border-yellow-200",
  APPROVED: "text-green-600 bg-green-50 border-green-200",
  REJECTED: "text-red-600 bg-red-50 border-red-200",
};

export default function AdminBadgesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [badges, setBadges] = useState<BadgeRequest[]>([]);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    const userType = (session?.user as { type?: string })?.type;
    if (status === "authenticated" && userType !== "ADMIN") router.push("/dashboard");
    if (status === "authenticated") {
      fetch("/api/admin/badges").then(r => r.json()).then(setBadges);
    }
  }, [status, session, router]);

  async function resolve(badgeId: string, newStatus: "APPROVED" | "REJECTED") {
    setLoading(badgeId);
    const res = await fetch(`/api/admin/badges/${badgeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, adminNote: noteMap[badgeId] }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBadges(prev => prev.map(b => b.id === badgeId ? { ...b, ...updated } : b));
    }
    setLoading(null);
  }

  const pending = badges.filter(b => b.status === "PENDING");
  const resolved = badges.filter(b => b.status !== "PENDING");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <AdminSidebar currentPath="/admin/badges" />
        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Badge Requests
          </h1>

          {/* Pending */}
          <section className="mb-8">
            <h2 className="font-semibold mb-3">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending requests.</p>
            ) : (
              <div className="space-y-4">
                {pending.map(b => (
                  <Card key={b.id} className="border-yellow-200">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {b.user.type === "COMPANY" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            <Link href={`/profile/${b.user.id}`} className="font-semibold hover:underline">
                              {b.user.name}
                            </Link>
                            <span className="text-xs text-muted-foreground">{b.user.email}</span>
                          </div>
                          <p className="text-sm mb-1">
                            Requesting: <strong>{BADGE_LABELS[b.badgeType] ?? b.badgeType}</strong>
                          </p>
                          {b.evidence && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Evidence: <a href={b.evidence} target="_blank" rel="noopener" className="underline hover:text-foreground">{b.evidence}</a>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">Requested {formatDate(b.requestedAt)}</p>
                          <div className="mt-3">
                            <Textarea
                              placeholder="Admin note (optional)…"
                              value={noteMap[b.id] ?? ""}
                              onChange={e => setNoteMap(prev => ({ ...prev, [b.id]: e.target.value }))}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => resolve(b.id, "APPROVED")}
                            disabled={loading === b.id}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => resolve(b.id, "REJECTED")}
                            disabled={loading === b.id}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Resolved */}
          <section>
            <h2 className="font-semibold mb-3">Resolved ({resolved.length})</h2>
            {resolved.length === 0 ? (
              <p className="text-muted-foreground text-sm">No resolved requests yet.</p>
            ) : (
              <div className="space-y-2">
                {resolved.map(b => (
                  <Card key={b.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor[b.status as keyof typeof statusColor]}`}>
                          {b.status === "APPROVED" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {b.status}
                        </span>
                        <Link href={`/profile/${b.user.id}`} className="font-medium text-sm hover:underline">{b.user.name}</Link>
                        <span className="text-sm text-muted-foreground">{BADGE_LABELS[b.badgeType] ?? b.badgeType}</span>
                        {b.resolvedAt && <span className="text-xs text-muted-foreground ml-auto">{formatDate(b.resolvedAt)}</span>}
                      </div>
                      {b.adminNote && <p className="text-xs text-muted-foreground mt-1 pl-16">Note: {b.adminNote}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
