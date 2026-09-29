import type { Metadata } from "next";

import { renderGeographyFirstV2AudiencePage } from "@/features/ux-lab/geography-first-v2/geography-first-v2-audience-page";
import { GeographyFirstV2CliniciansExperience } from "@/features/ux-lab/geography-first-v2/geography-first-v2-clinicians-experience";

export const metadata: Metadata = {
  description:
    "Geography-First v2 clinician context for a sample place. Resource discovery with source, freshness, and applicability cues.",
  robots: { follow: false, index: false },
  title: "Geography-First v2 · Clinicians",
};

export async function GeographyFirstV2CliniciansPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  return renderGeographyFirstV2AudiencePage({
    audience: "clinicians",
    intro: (
      <>
        <p className="eyebrow">Product research · round 2</p>
        <p className="type-section">Clinician context for the same place</p>
        <p className="type-body">
          Open jurisdiction-linked resource labels and reporting cues without
          mixing them into the public local summary. Clinical care decisions
          stay outside this prototype view.
        </p>
      </>
    ),
    renderExperience: (place) => (
      <GeographyFirstV2CliniciansExperience place={place} />
    ),
    searchParams,
  });
}

export default GeographyFirstV2CliniciansPage;
