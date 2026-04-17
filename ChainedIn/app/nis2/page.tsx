"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, FileText, UserCheck, Building2, Loader2,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const ESSENTIAL_SECTORS = [
  "Energy (electricity, oil, gas, hydrogen, district heating/cooling)",
  "Transport (air, rail, water, road)",
  "Banking",
  "Financial market infrastructure",
  "Health",
  "Drinking water",
  "Wastewater",
  "Digital infrastructure (IXPs, DNS, TLD registries, cloud computing, data centres, CDN, trust services, electronic communications networks)",
  "ICT service management (B2B managed services / managed security services)",
  "Public administration (central/regional government — excludes defense, national security, law enforcement, judiciary)",
  "Space",
];

const IMPORTANT_SECTORS = [
  "Postal and courier services",
  "Waste management",
  "Chemicals (production, manufacture, distribution)",
  "Food (production, processing, distribution)",
  "Manufacturing (medical devices, computers & electronics, machinery, motor vehicles, other transport equipment)",
  "Digital providers (online marketplaces, online search engines, social networking platforms)",
  "Research",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId = "eu" | "sector" | "size" | "special" | "result";

interface Answers {
  eu?: boolean;
  sectorType?: "essential" | "important" | "none";
  sector?: string;
  size?: "micro" | "small" | "medium" | "large";
  isCritical?: boolean;
  isTrustOrDns?: boolean;
}

export type Verdict = "not-in-scope" | "important" | "essential";

// ─── Logic ────────────────────────────────────────────────────────────────────

function computeVerdict(a: Answers): { verdict: Verdict; reason: string; obligations: string[] } {
  if (!a.eu) return {
    verdict: "not-in-scope",
    reason: "Your organisation does not operate in or from an EU member state.",
    obligations: [],
  };
  if (a.sectorType === "none") return {
    verdict: "not-in-scope",
    reason: "Your sector is not covered by the NIS2 Directive.",
    obligations: [],
  };

  const special = a.isCritical || a.isTrustOrDns;

  if (special || (a.sectorType === "essential" && a.size === "large")) return {
    verdict: "essential",
    reason: special
      ? "Your organisation qualifies as an Essential Entity due to its critical/trust-service status."
      : "Your large organisation operates in an essential sector.",
    obligations: [
      "Implement a risk management programme (art. 21)",
      "Report significant incidents: 24 h early warning → 72 h full notification → 1-month final report (art. 23)",
      "Supply chain security measures",
      "Senior management accountability and mandatory training",
      "Proactive supervision by national authorities",
      "Penalties up to €10 M or 2 % of global annual turnover (art. 34)",
      ...(a.sector === "Banking" || a.sector === "Financial market infrastructure"
        ? ["Note: DORA (Regulation EU 2022/2554) applies as lex specialis — verify which obligations are fulfilled under DORA vs NIS2"]
        : []),
    ],
  };

  if ((a.size === "micro" || a.size === "small") && !special) return {
    verdict: "not-in-scope",
    reason: "Micro and small enterprises are generally exempt from NIS2 unless they hold special status.",
    obligations: [],
  };

  if (
    (a.sectorType === "essential" && a.size === "medium") ||
    (a.sectorType === "important" && (a.size === "medium" || a.size === "large"))
  ) return {
    verdict: "important",
    reason: a.sectorType === "essential"
      ? "Your medium-sized organisation operates in an essential sector."
      : "Your organisation operates in an important sector.",
    obligations: [
      "Implement risk management measures (art. 21)",
      "Report significant incidents: 24 h early warning → 72 h full notification → 1-month final report (art. 23)",
      "Basic cyber-hygiene and security policies",
      "Reactive supervision by national authorities (post-incident)",
      "Penalties up to €7 M or 1.4 % of global annual turnover (art. 34)",
      ...(a.sector === "Banking" || a.sector === "Financial market infrastructure"
        ? ["Note: DORA (Regulation EU 2022/2554) applies as lex specialis — verify which obligations are fulfilled under DORA vs NIS2"]
        : []),
    ],
  };

  return {
    verdict: "not-in-scope",
    reason: "Based on your answers, your organisation does not fall within NIS2 scope.",
    obligations: [],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

function Choice({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm hover:bg-accent hover:border-primary transition-colors"
    >
      <div>
        <p className="font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
    </button>
  );
}

const NEXT_STEPS = [
  {
    key: "document-architect",
    label: "Contact Document Architect",
    sub: "Get help structuring your compliance documentation",
    icon: FileText,
    href: "/nis2/partners/document-architect",
  },
  {
    key: "internal-auditor",
    label: "Contact Internal Auditor",
    sub: "Assess your current controls against NIS2 requirements",
    icon: UserCheck,
    href: "/nis2/partners/internal-auditor",
  },
  {
    key: "external-auditor",
    label: "Contact External Auditor",
    sub: "Independent third-party compliance verification",
    icon: Building2,
    href: "/nis2/partners/external-auditor",
  },
];

function ResultView({
  answers,
  onReset,
  saving,
}: {
  answers: Answers;
  onReset: () => void;
  saving: boolean;
}) {
  const { verdict, reason, obligations } = computeVerdict(answers);
  const inScope = verdict !== "not-in-scope";

  const config = {
    "not-in-scope": {
      icon: <XCircle className="h-6 w-6" style={{ color: "#6b7280" }} />,
      badge: "Not in scope",
      color: "",
      badgeStyle: { backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
      cardStyle: { borderColor: "#d1d5db", backgroundColor: "#f9fafb" },
    },
    important: {
      icon: <AlertTriangle className="h-6 w-6" style={{ color: "#D58600" }} />,
      badge: "Important Entity",
      color: "",
      badgeStyle: { backgroundColor: "#FFF5E2", color: "#D58600", border: "1px solid #D58600" },
      cardStyle: { borderColor: "#D58600", backgroundColor: "#FFF5E2" },
    },
    essential: {
      icon: <AlertTriangle className="h-6 w-6" style={{ color: "#F00013" }} />,
      badge: "Essential Entity",
      color: "",
      badgeStyle: { backgroundColor: "#FFF3F3", color: "#F00013", border: "1px solid #F00013" },
      cardStyle: { borderColor: "#F00013", backgroundColor: "#FFF3F3" },
    },
  }[verdict];

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <Card className="border-2" style={config.cardStyle}>
        <CardContent className="py-5">
          <div className="flex items-center gap-3 mb-3">
            {config.icon}
            <span className="rounded-full px-3 py-1 text-sm font-semibold" style={config.badgeStyle}>
              {config.badge}
            </span>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />}
            {!saving && <span className="text-xs text-muted-foreground ml-auto">Result saved</span>}
          </div>
          <p className="text-sm">{reason}</p>
        </CardContent>
      </Card>

      {/* Obligations */}
      {obligations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Key obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {obligations.map((o, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Next steps */}
      {inScope && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recommended next steps</CardTitle>
            <p className="text-xs text-muted-foreground">Connect with our partner companies to get started.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {NEXT_STEPS.map(({ key, label, sub, icon: Icon, href }) => (
              <Link key={key} href={href}>
                <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent hover:border-primary transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        This assessment is indicative only and does not constitute legal advice. NIS2 explicitly excludes entities in defence, national security, law enforcement, and the judiciary (art. 2(7)). Sector-specific regulations (e.g. DORA for financial entities) may take precedence.
      </p>

      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="h-4 w-4 mr-2" />
        Redo assessment
      </Button>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS: StepId[] = ["eu", "sector", "size", "special", "result"];
const STEP_LABELS: Record<StepId, string> = {
  eu: "EU presence", sector: "Sector", size: "Size", special: "Special status", result: "Result",
};

function ProgressBar({ current }: { current: StepId }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-muted"}`} />
        </div>
      ))}
      <span className="text-xs text-muted-foreground ml-2 shrink-0">{STEP_LABELS[current]}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NIS2Page() {
  const { status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<StepId>("eu");
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Load previous result on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/nis2")
      .then((r) => r.json())
      .then((data) => {
        if (data?.answers) {
          setAnswers(JSON.parse(data.answers));
          setStep("result");
        }
      })
      .finally(() => setLoadingPrev(false));
  }, [status]);

  function answer(patch: Partial<Answers>, next: StepId) {
    const updated = { ...answers, ...patch };
    setAnswers(updated);
    setStep(next);
    if (next === "result") saveResult(updated);
  }

  async function saveResult(a: Answers) {
    const { verdict } = computeVerdict(a);
    setSaving(true);
    await fetch("/api/nis2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, answers: a }),
    });
    setSaving(false);
  }

  function reset() {
    setAnswers({});
    setStep("eu");
    // Clear saved result
    fetch("/api/nis2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict: "not-in-scope", answers: {} }),
    });
  }

  if (loadingPrev && status === "authenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <Sidebar currentPath="/nis2" />
          <main className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-8">
        <Sidebar currentPath="/nis2" />
        <main className="flex-1 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              NIS2 Compliance Check
            </h1>
            {step !== "eu" && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Restart
              </Button>
            )}
          </div>

          <ProgressBar current={step} />

          {step === "eu" && (
            <StepCard title="Does your organisation operate in or provide services within the EU?">
              <Choice label="Yes" sub="We are based in or actively serve customers in an EU member state" onClick={() => answer({ eu: true }, "sector")} />
              <Choice label="No" sub="We have no operations or customers in the EU" onClick={() => answer({ eu: false }, "result")} />
            </StepCard>
          )}

          {step === "sector" && (
            <StepCard title="Which sector best describes your organisation's primary activity?">
              <p className="text-xs text-muted-foreground -mt-1 mb-1 font-medium uppercase tracking-wide">Essential sectors</p>
              {ESSENTIAL_SECTORS.map((s) => (
                <Choice key={s} label={s} onClick={() => answer({ sectorType: "essential", sector: s }, "size")} />
              ))}
              <p className="text-xs text-muted-foreground mt-2 mb-1 font-medium uppercase tracking-wide">Important sectors</p>
              {IMPORTANT_SECTORS.map((s) => (
                <Choice key={s} label={s} onClick={() => answer({ sectorType: "important", sector: s }, "size")} />
              ))}
              <Choice label="None of the above" onClick={() => answer({ sectorType: "none" }, "result")} />
            </StepCard>
          )}

          {step === "size" && (
            <StepCard title="What is the size of your organisation?">
              <Choice label="Micro enterprise" sub="Fewer than 10 employees AND annual turnover / balance sheet below €2 M" onClick={() => answer({ size: "micro" }, "special")} />
              <Choice label="Small enterprise" sub="Fewer than 50 employees AND annual turnover / balance sheet below €10 M" onClick={() => answer({ size: "small" }, "special")} />
              <Choice label="Medium enterprise" sub="Fewer than 250 employees AND annual turnover below €50 M (or balance sheet below €43 M)" onClick={() => answer({ size: "medium" }, "special")} />
              <Choice label="Large enterprise" sub="250 or more employees, or annual turnover of €50 M or more" onClick={() => answer({ size: "large" }, "special")} />
            </StepCard>
          )}

          {step === "special" && (
            <StepCard
              title="Does your organisation have any special status?"
              sub="Certain organisations are subject to NIS2 regardless of size."
            >
              <Choice label="Qualified trust service provider, TLD registry, or DNS service provider" sub="As defined under eIDAS or by ICANN/national authority" onClick={() => answer({ isTrustOrDns: true, isCritical: false }, "result")} />
              <Choice label="Identified as critical infrastructure by a national authority" sub="e.g. under CER Directive or national critical infrastructure frameworks" onClick={() => answer({ isCritical: true, isTrustOrDns: false }, "result")} />
              <Choice label="Neither of the above" onClick={() => answer({ isCritical: false, isTrustOrDns: false }, "result")} />
            </StepCard>
          )}

          {step === "result" && (
            <ResultView answers={answers} onReset={reset} saving={saving} />
          )}
        </main>
      </div>
    </div>
  );
}
