"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewStackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/stacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), description: form.get("description") }),
    });
    if (res.ok) {
      const stack = await res.json();
      router.push(`/stacks/${stack.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/stacks" />
        <main className="flex-1 max-w-md">
          <h1 className="text-2xl font-bold mb-6">Create stack</h1>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Stack name *</Label>
                  <Input id="name" name="name" required placeholder="e.g. Production API stack" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={2} placeholder="What is this stack for?" />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create & open editor"}</Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
