import PartnerDirectory, { Partner } from "../PartnerDirectory";

const partners: Partner[] = [
  {
    name: "ComplianceDocs EU",
    description: "Specialists in NIS2 policy frameworks and documentation architecture. We help organisations build complete, audit-ready compliance document sets from scratch.",
    specialties: ["NIS2 Policy Framework", "ISMS Documentation", "Gap Analysis", "ISO 27001"],
    website: "https://example.com",
    email: "contact@example.com",
    location: "Brussels, Belgium",
  },
  {
    name: "SecureDoc Partners",
    description: "Experienced document architects with a focus on critical infrastructure operators. We translate complex regulatory requirements into clear, implementable documentation.",
    specialties: ["Critical Infrastructure", "Risk Registers", "Incident Response Plans", "Supply Chain"],
    website: "https://example.com",
    email: "info@example.com",
    phone: "+32 2 000 0000",
    location: "Amsterdam, Netherlands",
  },
  {
    name: "Archer Compliance Group",
    description: "End-to-end NIS2 documentation services including asset inventories, risk assessments, business continuity plans and board reporting templates.",
    specialties: ["Asset Inventory", "Business Continuity", "Board Reporting", "Training Materials"],
    email: "hello@example.com",
    phone: "+49 30 000 0000",
    location: "Berlin, Germany",
  },
];

export default function DocumentArchitectPage() {
  return (
    <PartnerDirectory
      title="Document Architect Partners"
      subtitle="Our partner firms specialise in building and structuring NIS2 compliance documentation for your organisation."
      partners={partners}
    />
  );
}
