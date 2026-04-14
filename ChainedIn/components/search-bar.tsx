"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Building2, Package, Search, User } from "lucide-react";
import type { Suggestion } from "@/app/api/search/suggest/route";

interface SearchBarProps {
  /** Which results to include in suggestions. Default: "all" */
  scope?: "all" | "profiles" | "software";
  /** Where Enter / "search all" navigates. Default: "/search" */
  searchAction?: string;
  /** Extra query params to append to every navigation (e.g. { type: "company" }) */
  extraParams?: Record<string, string>;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  scope = "all",
  searchAction = "/search",
  extraParams = {},
  placeholder = "Search profiles & packages…",
  className,
}: SearchBarProps = {}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch suggestions (debounced)
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    const params = new URLSearchParams({ q, scope });
    const res = await fetch(`/api/search/suggest?${params}`);
    const data: Suggestion[] = await res.json();
    // If scoped to profiles, rewrite hrefs to go through searchAction
    setSuggestions(data);
    setOpen(data.length > 0);
    setActiveIdx(-1);
  }, [scope]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function buildSearchHref(q: string) {
    const params = new URLSearchParams({ q, ...extraParams });
    return `${searchAction}?${params}`;
  }

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "Enter" && query.trim()) navigate(buildSearchHref(query.trim()));
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && suggestions[activeIdx]) {
          navigate(suggestions[activeIdx].href);
        } else if (query.trim()) {
          navigate(buildSearchHref(query.trim()));
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIdx(-1);
        inputRef.current?.blur();
        break;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(buildSearchHref(query.trim()));
  }

  return (
    <div ref={containerRef} className={`relative flex-1 max-w-sm ${className ?? ""}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            placeholder={placeholder}
            autoComplete="off"
            className="flex h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </form>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md border bg-background shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s.id + s.type}
              onMouseDown={(e) => { e.preventDefault(); navigate(s.href); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
              }`}
            >
              <span className="shrink-0 text-muted-foreground">
                {s.type === "profile"
                  ? (s.sublabel === "Company"
                      ? <Building2 className="h-3.5 w-3.5" />
                      : <User className="h-3.5 w-3.5" />)
                  : <Package className="h-3.5 w-3.5" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium truncate block">{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.sublabel}</span>
              </span>
            </button>
          ))}

          {/* "Search all results" footer */}
          <button
            onMouseDown={(e) => { e.preventDefault(); navigate(buildSearchHref(query.trim())); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-t hover:bg-accent/50 transition-colors"
          >
            <Search className="h-3 w-3" />
            Search all results for <strong className="ml-1">"{query}"</strong>
          </button>
        </div>
      )}
    </div>
  );
}
