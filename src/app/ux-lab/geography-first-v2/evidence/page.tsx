import type { Metadata } from "next";

import { renderGeographyFirstV2AudiencePage } from "@/features/ux-lab/geography-first-v2/geography-first-v2-audience-page";
import { GeographyFirstV2EvidenceExperience } from "@/features/ux-lab/geography-first-v2/geography-first-v2-evidence-experience";

export const metadata: Metadata = {
  description:
    "Geography-First v2 public-health evidence for a sample place. Provenance, uncertainty, and professional handoffs.",
  robots: { follow: false, index: false },
  title: "Geography-First v2 · Evidence",
};

export async function GeographyFirstV2EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  return renderGeographyFirstV2AudiencePage({
    audience: "evidence",
    intro: (
      <>
        <p className="eyebrow">Product research · round 2</p>
        <p className="type-section">
          Public-health evidence for the same place
        </p>
        <p className="type-body">
          Review sample provenance rows, state-level entry concepts, and
          handoffs to the live professional Atlas while keeping the selected
          geography in view.
        </p>
      </>
    ),
    renderExperience: (place) => (
      <GeographyFirstV2EvidenceExperience place={place} />
    ),
    searchParams,
  });
}

export default GeographyFirstV2EvidencePage;
