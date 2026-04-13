"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BADGE_LABELS, formatDate } from "@/lib/utils";
import { Award, CheckCircle2, Clock, XCircle } from "lucide-react";

interface BadgeRequest {
  id: string;
  badgeType: string;
  status: string;
  evidence: string | null;
  adminNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

const BADGE_TYPES = Object.entries(BADGE_LABELS);

const statusIcon = {
  PENDING: <Clock className="h-4 w-4 text-yellow-600" />,
  APPROVED: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  REJECTED: <XCircle className="h-4 w-4 text-red-600" />,
};

const statusStyle = {
  PENDING: "bg-yellow-50 border-yellow-200 text-yellow-800",
  APPROVED: "bg-green-50 border-green-200 text-green-800",
  REJECTED: "bg-red-50 border-red-200 text-red-800",
};

export default function BadgesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [badges, setBadges] = useState<BadgeRequest[]>([]);
  const [badgeType, setBadgeType] = useState("ISO27001");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") {
      fetch("/api/badges").then(r => r.json()).then(setBadges);
    }
  }, [status, router]);

  const existingTypes = new Set(
    badges.filter(b => ["PENDING", "APPROVED"].includes(b.status)).map(b => b.badgeType)
  );

  async function requestBadge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ badgeType, evidence }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to request badge");
      return;
    }

    setBadges(prev => [data, ...prev]);
    setEvidence("");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/badges" />
        <main className="flex-1">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Award className="h-6 w-6" /> Compliance Badges
          </h1>

          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            {/* Badge list */}
            <div className="space-y-3">
              <h2 className="font-semibold">Your badge requests ({badges.length})</h2>
              {badges.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No badges requested yet. Use the form to request one.
                  </CardContent>
                </Card>
              ) : (
                badges.map((b) => (
                  <Card key={b.id} className={`border ${statusStyle[b.status as keyof typeof statusStyle] ?? ""}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {statusIcon[b.status as keyof typeof statusIcon]}
                            <span className="font-semibold">
                              {BADGE_LABELS[b.badgeType] ?? b.badgeType}
                            </span>
                            <span className="text-xs font-medium">{b.status}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Requested {formatDate(b.requestedAt)}
                            {b.resolvedAt && ` · Resolved ${formatDate(b.resolvedAt)}`}
                          </p>
                          {b.evidence && (
                            <p className="text-sm mt-2">
                              <span className="font-medium">Evidence: </span>{b.evidence}
                            </p>
                          )}
                          {b.adminNote && (
                            <p className="text-sm mt-1 text-muted-foreground">
                              <span className="font-medium">Admin note: </span>{b.adminNote}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Request form */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Request a badge</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={requestBadge} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Badge type</Label>
                    <Select value={badgeType} onValueChange={setBadgeType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BADGE_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value} disabled={existingTypes.has(value)}>
                            {label} {existingTypes.has(value) ? "(already requested)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="evidence">Evidence / Certificate URL</Label>
                    <Textarea
                      id="evidence"
                      value={evidence}
                      onChange={e => setEvidence(e.target.value)}
                      rows={3}
                      placeholder="Link to certificate, audit report, or other evidence..."
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading || existingTypes.has(badgeType)}>
                    {loading ? "Requesting…" : "Request badge"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A verified admin will review your request before the badge appears on your public profile.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
