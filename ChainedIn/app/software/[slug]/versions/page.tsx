"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeverityRow } from "@/components/severity-badge";
import { formatDate } from "@/lib/utils";
import { Plus, RefreshCw, Trash2, ArrowLeft, ExternalLink } from "lucide-react";

interface CveCache { severity: string }
interface Version {
  id: string;
  version: string;
  releasedAt: string | null;
  changelog: string | null;
  cveCache: CveCache[];
}
interface Package {
  id: string;
  name: string;
  slug: string;
  ecosystem: string;
  ownerId: string;
}

export default function VersionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ version: "", releasedAt: "", changelog: "" });

  useEffect(() => {
    fetch(`/api/software/${slug}`).then(r => r.json()).then(data => {
      setPkg(data);
      setVersions(data.versions ?? []);
    });
    fetch("/api/users/me").then(r => r.json()).then(u => setSessionUserId(u.id));
  }, [slug]);

  const isOwner = pkg?.ownerId === sessionUserId;

  async function addVersion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/software/${slug}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed");
      setLoading(false);
      return;
    }

    const newV = await res.json();
    setVersions(prev => [{ ...newV, cveCache: [] }, ...prev]);
    setForm({ version: "", releasedAt: "", changelog: "" });
    setLoading(false);
  }

  async function refreshCve(versionId: string) {
    setRefreshing(versionId);
    try {
      const res = await fetch(`/api/software/${slug}/versions/${versionId}/cve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Reload versions
      const r2 = await fetch(`/api/software/${slug}/versions`);
      setVersions(await r2.json());
    } catch (e) {
      alert(e instanceof Error ? e.message : "CVE refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function deleteVersion(versionId: string, ver: string) {
    if (!confirm(`Delete version ${ver}?`)) return;
    await fetch(`/api/software/${slug}/versions/${versionId}`, { method: "DELETE" });
    setVersions(prev => prev.filter(v => v.id !== versionId));
  }

  if (!pkg) return <div className="container mx-auto px-4 py-8">Loading…</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/dashboard" />
        <main className="flex-1">
          <div className="mb-6 flex items-center gap-4">
            <Link href="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
            <div>
              <h1 className="text-2xl font-bold">{pkg.name} — Versions</h1>
              <Link href={`/software/${slug}`} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
                View public page <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[1fr_350px]">
            {/* Version list */}
            <div className="space-y-3">
              <h2 className="font-semibold">Releases ({versions.length})</h2>
              {versions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">No versions yet.</CardContent>
                </Card>
              ) : (
                versions.map((v) => (
                  <Card key={v.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-semibold">{v.version}</span>
                            {v.releasedAt && (
                              <span className="text-xs text-muted-foreground">{formatDate(v.releasedAt)}</span>
                            )}
                          </div>
                          <SeverityRow cves={v.cveCache} />
                          {v.cveCache.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{v.cveCache.length} CVE{v.cveCache.length !== 1 ? "s" : ""} cached</p>
                          )}
                          {v.changelog && <p className="text-sm text-muted-foreground mt-2">{v.changelog}</p>}
                        </div>
                        {isOwner && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refreshCve(v.id)}
                              disabled={refreshing === v.id}
                              title="Fetch CVE data from NVD"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing === v.id ? "animate-spin" : ""}`} />
                              CVE
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteVersion(v.id, v.version)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Add version form */}
            {isOwner && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Add version</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={addVersion} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="version">Version *</Label>
                      <Input
                        id="version"
                        value={form.version}
                        onChange={e => setForm({ ...form, version: e.target.value })}
                        required
                        placeholder="e.g. 2.3.1"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="releasedAt">Release date</Label>
                      <Input
                        id="releasedAt"
                        type="date"
                        value={form.releasedAt}
                        onChange={e => setForm({ ...form, releasedAt: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="changelog">Changelog</Label>
                      <Textarea
                        id="changelog"
                        value={form.changelog}
                        onChange={e => setForm({ ...form, changelog: e.target.value })}
                        rows={3}
                        placeholder="What changed in this version?"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading}>
                      <Plus className="h-4 w-4 mr-1" />
                      {loading ? "Adding…" : "Add version"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
