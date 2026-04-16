/**
 * Plain-language helpers for scan reports.
 * Designed for non-technical stakeholders: POs, PMs, CISOs.
 */

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";

export interface PlainSummary {
  headline: string;
  subheadline: string;
  statusColor: string;
  statusBg: string;
  statusDot: string;
  actionLabel: string;
}

export function getPlainSummary(riskLevel: string, vulnerableDeps: number, totalAdvisories: number): PlainSummary {
  const level = riskLevel as RiskLevel;

  if (level === "CLEAN") {
    return {
      headline: "All clear — no known vulnerabilities found",
      subheadline: "Your project's dependencies look healthy. No action required right now.",
      statusColor: "text-green-700",
      statusBg: "bg-green-50 border-green-200",
      statusDot: "bg-green-500",
      actionLabel: "Keep it up",
    };
  }

  const pkgWord = vulnerableDeps === 1 ? "package" : "packages";
  const issueWord = totalAdvisories === 1 ? "issue" : "issues";

  if (level === "CRITICAL") {
    return {
      headline: `Immediate action required — ${vulnerableDeps} ${pkgWord} with critical security holes`,
      subheadline: `We found ${totalAdvisories} security ${issueWord} that attackers could exploit right now. Your engineering team should address these today.`,
      statusColor: "text-red-700",
      statusBg: "bg-red-50 border-red-200",
      statusDot: "bg-red-500",
      actionLabel: "Fix today",
    };
  }

  if (level === "HIGH") {
    return {
      headline: `Serious issues found — ${vulnerableDeps} ${pkgWord} need urgent attention`,
      subheadline: `We found ${totalAdvisories} high-severity security ${issueWord}. These should be fixed within the next few days before they become a bigger risk.`,
      statusColor: "text-orange-700",
      statusBg: "bg-orange-50 border-orange-200",
      statusDot: "bg-orange-500",
      actionLabel: "Fix this week",
    };
  }

  if (level === "MEDIUM") {
    return {
      headline: `Some issues to review — ${vulnerableDeps} ${pkgWord} flagged`,
      subheadline: `We found ${totalAdvisories} moderate security ${issueWord}. These are not emergencies, but your team should schedule fixes within the next 30 days.`,
      statusColor: "text-yellow-700",
      statusBg: "bg-yellow-50 border-yellow-200",
      statusDot: "bg-yellow-500",
      actionLabel: "Schedule fixes",
    };
  }

  // LOW
  return {
    headline: `Minor notes — ${vulnerableDeps} ${pkgWord} with low-severity findings`,
    subheadline: `We found ${totalAdvisories} low-severity ${issueWord}. These carry minimal risk but are worth keeping on the backlog.`,
    statusColor: "text-blue-700",
    statusBg: "bg-blue-50 border-blue-200",
    statusDot: "bg-blue-500",
    actionLabel: "Monitor",
  };
}

export function getActionForSeverity(severity: string): { label: string; color: string; bg: string; description: string } {
  switch (severity) {
    case "CRITICAL":
      return {
        label: "Fix today",
        color: "text-red-700",
        bg: "bg-red-100 border-red-200",
        description: "This is a critical security hole. Attackers can exploit it right now.",
      };
    case "HIGH":
      return {
        label: "Fix this week",
        color: "text-orange-700",
        bg: "bg-orange-100 border-orange-200",
        description: "Serious risk. Your team should fix this within a few days.",
      };
    case "MEDIUM":
      return {
        label: "Schedule a fix",
        color: "text-yellow-700",
        bg: "bg-yellow-100 border-yellow-200",
        description: "Moderate risk. Plan to resolve within 30 days.",
      };
    case "LOW":
      return {
        label: "Low priority",
        color: "text-blue-700",
        bg: "bg-blue-100 border-blue-200",
        description: "Minor issue. Keep it on the backlog.",
      };
    default:
      return {
        label: "Review",
        color: "text-gray-700",
        bg: "bg-gray-100 border-gray-200",
        description: "Needs review.",
      };
  }
}

export function getRiskLevelLabel(riskLevel: string): string {
  const labels: Record<string, string> = {
    CRITICAL: "Critical Risk",
    HIGH: "High Risk",
    MEDIUM: "Medium Risk",
    LOW: "Low Risk",
    CLEAN: "All Clear",
  };
  return labels[riskLevel] ?? riskLevel;
}
