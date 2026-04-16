"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Copy, RefreshCw, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", website: "", logoUrl: "" });
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") {
      fetch("/api/users/me")
        .then((r) => r.json())
        .then((u) => setForm({ name: u.name ?? "", bio: u.bio ?? "", website: u.website ?? "", logoUrl: u.logoUrl ?? "" }));
      fetch("/api/settings/api-key")
        .then((r) => r.json())
        .then((d) => setApiKey(d.apiKey));
    }
  }, [status, router]);

  async function generateApiKey() {
    setApiKeyLoading(true);
    const res = await fetch("/api/settings/api-key", { method: "POST" });
    const data = await res.json();
    setApiKey(data.apiKey);
    setShowKey(true);
    setApiKeyLoading(false);
  }

  async function revokeApiKey() {
    if (!confirm("Revoke API key? Any running integrations using this key will stop working.")) return;
    setApiKeyLoading(true);
    await fetch("/api/settings/api-key", { method: "DELETE" });
    setApiKey(null);
    setShowKey(false);
    setApiKeyLoading(false);
  }

  function copyKey() {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setSaved(true);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/settings" />
        <main className="flex-1 max-w-lg space-y-6">
          <h1 className="text-2xl font-bold">Profile settings</h1>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Tell us about yourself or your company..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Profile image URL</Label>
                  <Input id="logoUrl" type="url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
                  {saved && <span className="text-sm text-green-600">Saved!</span>}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* API Key */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scanner API key</CardTitle>
              <CardDescription>
                Use this key to upload scan results from the ChainedIn CLI tool to your private dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        readOnly
                        value={showKey ? apiKey : "•".repeat(Math.min(apiKey.length, 32))}
                        className="font-mono text-xs pr-10"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={copyKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && <p className="text-xs text-green-600">Copied to clipboard!</p>}
                  <div className="bg-muted rounded-md px-3 py-2 text-xs font-mono space-y-1">
                    <p className="text-muted-foreground"># Run the scanner and upload results</p>
                    <p>pip install chainedIn</p>
                    <p>chainedIn scan . --upload --api-key {showKey ? apiKey : "<your-api-key>"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generateApiKey} disabled={apiKeyLoading}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Rotate key
                    </Button>
                    <Button variant="outline" size="sm" onClick={revokeApiKey} disabled={apiKeyLoading} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    Generate an API key to connect the ChainedIn CLI scanner to your dashboard.
                  </p>
                  <Button onClick={generateApiKey} disabled={apiKeyLoading}>
                    {apiKeyLoading ? "Generating…" : "Generate API key"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
