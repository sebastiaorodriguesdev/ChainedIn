import { cn } from "@/lib/utils";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

const colors: Record<Severity, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-blue-100 text-blue-800 border-blue-200",
  NONE: "bg-green-100 text-green-800 border-green-200",
};

export function SeverityBadge({
  severity,
  count,
  className,
}: {
  severity: string;
  count?: number;
  className?: string;
}) {
  const s = (severity as Severity) in colors ? (severity as Severity) : "NONE";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        colors[s],
        className
      )}
    >
      {count !== undefined ? (
        <>
          <span className="font-bold">{count}</span> {s}
        </>
      ) : (
        s
      )}
    </span>
  );
}

export function SeverityRow({ cves }: { cves: { severity: string }[] }) {
  const counts: Record<string, number> = {};
  for (const c of cves) {
    counts[c.severity] = (counts[c.severity] ?? 0) + 1;
  }

  if (cves.length === 0) {
    return <SeverityBadge severity="NONE" count={0} />;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map(
        (s) =>
          counts[s] ? (
            <SeverityBadge key={s} severity={s} count={counts[s]} />
          ) : null
      )}
    </div>
  );
}
