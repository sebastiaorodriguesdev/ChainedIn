import PartnerDirectory, { Partner } from "../PartnerDirectory";

const partners: Partner[] = [
  {
    name: "EuroAudit Compliance",
    description: "Accredited external auditors providing independent NIS2 compliance verification. Our certificates are recognised by national competent authorities across the EU.",
    specialties: ["Independent Certification", "Supervisory Liaison", "ISO 27001 Audit", "ENISA Framework"],
    website: "https://example.com",
    email: "external@example.com",
    location: "Paris, France",
  },
  {
    name: "Vertex External Assurance",
    description: "Big-four-grade external assurance for Essential and Important Entities. We provide formal compliance opinions and evidence packs for regulatory submissions.",
    specialties: ["Regulatory Submission", "Evidence Packs", "Formal Opinions", "Multi-jurisdiction"],
    website: "https://example.com",
    email: "assurance@example.com",
    phone: "+33 1 000 0000",
    location: "Luxembourg",
  },
  {
    name: "Nordic Cyber Certification",
    description: "Specialised external auditors for digital infrastructure and ICT service providers. Extensive experience with supervisory authorities in Nordic and Baltic states.",
    specialties: ["Digital Infrastructure", "ICT Service Providers", "Nordic Regulators", "Incident Review"],
    email: "hello@example.com",
    phone: "+358 9 000 0000",
    location: "Helsinki, Finland",
  },
];

export default function ExternalAuditorPage() {
  return (
    <PartnerDirectory
      title="External Auditor Partners"
      subtitle="Our accredited external audit partners provide independent third-party NIS2 compliance verification recognised by EU regulators."
      partners={partners}
    />
  );
}
