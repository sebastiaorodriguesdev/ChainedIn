import PartnerDirectory, { Partner } from "../PartnerDirectory";

const partners: Partner[] = [
  {
    name: "InternalAudit NIS2",
    description: "Dedicated internal audit support for NIS2 compliance. We embed with your team to assess existing controls, identify gaps and prepare you for supervisory review.",
    specialties: ["Control Testing", "NIS2 Gap Assessment", "Risk Management", "Maturity Scoring"],
    website: "https://example.com",
    email: "audit@example.com",
    location: "Dublin, Ireland",
  },
  {
    name: "CyberAudit Professionals",
    description: "Certified internal auditors with deep cybersecurity expertise. We assess your technical and organisational measures against all ten NIS2 risk management requirements.",
    specialties: ["Technical Controls", "Penetration Testing", "Access Management", "Cryptography Review"],
    website: "https://example.com",
    email: "info@example.com",
    phone: "+353 1 000 0000",
    location: "Copenhagen, Denmark",
  },
  {
    name: "Meridian Audit Services",
    description: "Independent internal audit teams for medium and large organisations. We provide structured findings reports with prioritised remediation roadmaps.",
    specialties: ["Remediation Roadmaps", "Supply Chain Audits", "Incident Readiness", "Board Presentations"],
    email: "contact@example.com",
    phone: "+46 8 000 0000",
    location: "Stockholm, Sweden",
  },
];

export default function InternalAuditorPage() {
  return (
    <PartnerDirectory
      title="Internal Auditor Partners"
      subtitle="Our partner auditors will assess your current controls against NIS2 requirements and identify what needs to change."
      partners={partners}
    />
  );
}
