import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 64);
}

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL:   "#dc2626",  // red
  HIGH:       "#ea580c",  // orange
  MEDIUM:     "#ca8a04",  // amber
  LOW:        "#65a30d",  // yellow-green
  NONE:       "#16a34a",  // green
  UNSCANNED:  "#2563eb",  // blue — newly released, not yet scanned
};

export const SEVERITY_BG: Record<string, string> = {
  CRITICAL:  "bg-red-100 text-red-800 border-red-200",
  HIGH:      "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW:       "bg-lime-100 text-lime-800 border-lime-200",
  NONE:      "bg-green-100 text-green-800 border-green-200",
  UNSCANNED: "bg-blue-100 text-blue-800 border-blue-200",
};

export const BADGE_LABELS: Record<string, string> = {
  ISO27001: "ISO 27001",
  NIS2: "NIS2",
  SOC2: "SOC 2",
  GDPR: "GDPR",
  PCI_DSS: "PCI DSS",
};

export const ECOSYSTEM_LABELS: Record<string, string> = {
  npm: "npm",
  pip: "PyPI (pip)",
  maven: "Maven",
  cargo: "Cargo (Rust)",
  gem: "RubyGems",
  nuget: "NuGet",
  go: "Go",
  other: "Other",
};

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function worstSeverity(severities: string[]): string {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
  for (const s of order) {
    if (severities.includes(s)) return s;
  }
  return "NONE";
}
