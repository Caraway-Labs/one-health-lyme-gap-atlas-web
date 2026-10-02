/**
 * Disposable Geography-First v2 prototype content.
 * Fictional places only. No governed identifiers, scores, or local-risk claims.
 */

export const GEOGRAPHY_FIRST_V2_PATH = "/ux-lab/geography-first-v2";

export const GEOGRAPHY_FIRST_V2_HYPOTHESIS =
  "Whether leading with place makes Atlas immediately relevant while users can still tell surveillance context apart from personal medical risk.";

export const GEOGRAPHY_FIRST_V2_DIFFERENCE =
  "Compared with Geography-First (round 1): a stronger non-geographic lived-experience path; essential uncertainty beside local claims; no AQI-like personal-risk framing; clinician and public-health evidence on same-place routes.";

export const GEOGRAPHY_FIRST_V2_CLINICIANS_PATH =
  `${GEOGRAPHY_FIRST_V2_PATH}/clinicians` as const;

export const GEOGRAPHY_FIRST_V2_EVIDENCE_PATH =
  `${GEOGRAPHY_FIRST_V2_PATH}/evidence` as const;

export const GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID = "ridge-sample-county";

export type GeographyFirstV2Audience = "public" | "clinicians" | "evidence";

export const GEOGRAPHY_FIRST_V2_AUDIENCE_NAV = [
  {
    audience: "public" as const,
    description: "Plain-language local summary and evidence boundaries.",
    label: "Public local entry",
  },
  {
    audience: "clinicians" as const,
    description: "Resource discovery and reporting cues for this place.",
    label: "Clinician context",
  },
  {
    audience: "evidence" as const,
    description: "Deeper surveillance review with provenance and uncertainty.",
    label: "Public-health evidence",
  },
] as const;

export type GeographyFirstV2Place = {
  id: string;
  kind: string;
  name: string;
  setting: string;
};

export const GEOGRAPHY_FIRST_V2_PLACES: readonly GeographyFirstV2Place[] = [
  {
    id: GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID,
    kind: "County",
    name: "Ridge Sample County",
    setting:
      "Representative fictional county for Geography-First v2 local-entry research.",
  },
  {
    id: "meadow-sample-town",
    kind: "Town",
    name: "Meadow Sample Town",
    setting: "Second fictional place to compare location search behavior.",
  },
];

export const GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES = [
  {
    id: "incomplete-surveillance",
    label: "Surveillance may be incomplete",
    detail:
      "Case reporting, lab confirmation, and geographic coding vary. A place can have Lyme activity that never appears in the datasets Atlas would review.",
  },
  {
    id: "missing-not-absence",
    label: "Fewer records are not proof of absence",
    detail:
      "Blank, suppressed, or unpublished fields mean information is missing. They are not zeros and do not show that ticks or Lyme are absent.",
  },
  {
    id: "residence-not-exposure",
    label: "Where you live is not where exposure happened",
    detail:
      "Residence on a map does not establish that transmission occurred there. Travel, recreation, and care outside the home are not captured by a jurisdiction label.",
  },
  {
    id: "not-personal-risk",
    label: "Population surveillance is not personal risk guidance",
    detail:
      "What health departments observe for a place is not a personal medical label, a prognosis, or instructions for an individual. Clinical questions belong with a clinician.",
  },
] as const;

export type GeographyFirstV2ClinicianResource = {
  applicability: string;
  boundary: string;
  freshness: string;
  id: string;
  source: string;
  summary: string;
  title: string;
};

export const geographyFirstV2ClinicianResources = (
  placeName: string
): readonly GeographyFirstV2ClinicianResource[] => [
  {
    applicability: `Sample applicability: materials that could apply when discussing ${placeName} in outreach. Not a patient-specific label.`,
    boundary:
      "Listing only. These cards show where governed resources could appear. They are not surveillance counts and not care instructions for an individual.",
    freshness:
      "Sample freshness: layout catalog marked 2026-Q1 in this prototype.",
    id: "jurisdiction-handouts",
    source: "Sample source: fictional outreach catalog stub.",
    summary: `Sample shelf for patient-facing handouts that mention ${placeName} as a jurisdiction label.`,
    title: "Jurisdiction-linked handouts",
  },
  {
    applicability:
      "Sample applicability: clinicians who need reporting contact placeholders for this prototype county.",
    boundary:
      "No reporting workflow is connected. Contacts are fictional placeholders beside real-world expectations for source and jurisdiction notes.",
    freshness:
      "Sample freshness: directory placeholder; not refreshed from a live public-health feed.",
    id: "reporting-contacts",
    source: "Sample source: fictional health department directory entry.",
    summary: `Sample reporting-resource cue for ${placeName}. Shows where case-reporting links could sit without starting a workflow.`,
    title: "Reporting resource cues",
  },
  {
    applicability:
      "Sample applicability: professional education that stays separate from community surveillance summaries.",
    boundary:
      "Surveillance context for a place is not the same as individual clinical decisions. This card labels that separation explicitly.",
    freshness: "Sample freshness: static prototype copy only.",
    id: "clinical-education",
    source: "Sample source: professional education stub (prototype).",
    summary:
      "Sample card for continuing education or clinician bulletins that reference place without turning surveillance into care direction.",
    title: "Clinician education listings",
  },
];

export const GEOGRAPHY_FIRST_V2_CLINICIAN_BOUNDARY =
  "This view helps clinicians find applicable resources and reporting context for a sample place. It does not interpret symptoms, classify individual patients, or provide care pathways.";

export type GeographyFirstV2EvidenceRow = {
  label: string;
  note: string;
};

export type GeographyFirstV2EvidenceTopic = {
  body: string;
  id: string;
  rows: readonly GeographyFirstV2EvidenceRow[];
  summary: string;
  title: string;
  uncertainty: string;
};

export const geographyFirstV2EvidenceTopics = (
  placeName: string
): readonly GeographyFirstV2EvidenceTopic[] => [
  {
    body: `Sample evidence desk entry for ${placeName}. A governed review would attach sources, vintage, and completeness beside each field.`,
    id: "surveillance-review",
    rows: [
      {
        label: "Source",
        note: "Sample source: fictional surveillance feed placeholder (prototype only).",
      },
      {
        label: "Vintage",
        note: "Sample vintage: layout marked 2026-Q1. Not a live refresh timestamp.",
      },
      {
        label: "Completeness",
        note: "Sample completeness: intentionally blank fields mean missing information, not zero activity.",
      },
    ],
    summary:
      "Sample county-level review summary with provenance rows visible without opening methodology.",
    title: "Place surveillance review",
    uncertainty:
      "Uncertainty sits beside the summary: incomplete reporting can hide activity even when Lyme occurs in the area.",
  },
  {
    body: "Sample methodology disclosure for how a place-based review would describe coding, suppression, and linkage limits.",
    id: "methodology",
    rows: [
      {
        label: "Coding",
        note: "Sample note: residence, exposure location, and care location may differ.",
      },
      {
        label: "Suppression",
        note: "Sample note: small counts may be withheld; suppression is missingness, not absence.",
      },
      {
        label: "Linkage",
        note: "Sample note: lab and case data may not align for every jurisdiction.",
      },
    ],
    summary:
      "Progressive detail for epidemiologists who need methodology adjacent to claims.",
    title: "Methodology and missingness",
    uncertainty:
      "Methodology does not remove uncertainty; it explains why a place-based view can still be incomplete.",
  },
];

export const GEOGRAPHY_FIRST_V2_STATE_REVIEW = {
  description:
    "Epidemiologists can start from a state or regional review before opening a specific geography. This prototype keeps that entry concept visible so county-by-county navigation is not the only path.",
  id: "state-review",
  label: "State / regional review entry",
  note: "The fictional place stays in context when you move between review levels in a full Atlas build.",
} as const;

export const GEOGRAPHY_FIRST_V2_PROFESSIONAL_HANDOFFS = [
  {
    description:
      "Opens the live investigation workspace without attaching this fictional county identifier.",
    href: "/investigate",
    id: "investigation-workspace",
    label: "Investigation workspace",
  },
  {
    description:
      "Opens linked map, table, and chart views in the live Atlas without sample scores.",
    href: "/geographic_explorer",
    id: "geographic-explorer",
    label: "Geographic Explorer",
  },
] as const;

export type GeographyFirstV2LocalClaim = {
  id: string;
  claim: string;
  limitation: string;
  title: string;
};

export const geographyFirstV2LocalClaims = (
  placeName: string
): readonly GeographyFirstV2LocalClaim[] => [
  {
    id: "what-might-be-reviewed",
    claim: `For ${placeName}, public-health teams may review tick surveillance topics, case reports, and outreach materials as part of jurisdiction-level monitoring.`,
    limitation:
      "This prototype does not show live counts or maps. Surveillance can be incomplete even when activity occurs.",
    title: "What surveillance may discuss for a place",
  },
  {
    id: "what-is-often-missing",
    claim: `Published place-based Lyme information can be uneven. ${placeName} is a fictional stand-in, so every field in this layout is intentionally sample-only.`,
    limitation:
      "Lack of records or visible data does not mean Lyme or ticks are absent from the area.",
    title: "What may be missing from public view",
  },
  {
    id: "what-this-cannot-say",
    claim: `A local summary can describe monitoring context. It cannot tell a resident whether they were exposed, will become ill, or need specific care.`,
    limitation:
      "Population surveillance is not personal medical risk guidance and does not replace clinical judgment.",
    title: "What this page cannot establish",
  },
];

export const GEOGRAPHY_FIRST_V2_GENERAL_EDUCATION = [
  {
    id: "tick-basics",
    summary:
      "Sample overview of ticks and Lyme disease for people who want background before choosing a place. Not personal prevention advice.",
    title: "Tick and Lyme basics",
  },
  {
    id: "finding-trusted-sources",
    summary:
      "Sample pointers to how public sites usually organize education materials. No clinical advice is attached.",
    title: "Finding trusted education",
  },
] as const;

export const GEOGRAPHY_FIRST_V2_LIVED_EXPERIENCE = [
  {
    id: "ongoing-symptoms",
    summary:
      "Sample section for people with ongoing symptoms who may not need a map first. This prototype does not provide medical evaluation or care direction.",
    title: "Ongoing symptoms and care questions",
  },
  {
    id: "living-with-lyme",
    summary:
      "Sample resources label for people already affected by Lyme. Geography is optional; lived experience stays reachable without selecting a place.",
    title: "Living with Lyme",
  },
] as const;

export type GeographyFirstV2Selection =
  | { place: GeographyFirstV2Place; status: "selected" }
  | { requestedId: string; status: "missing" };

export function geographyFirstV2PlaceParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    return geographyFirstV2PlaceParam(value[0]);
  }
  return undefined;
}

export function resolveGeographyFirstV2Place(
  requestedId?: string
): GeographyFirstV2Selection {
  if (!requestedId) {
    const place = GEOGRAPHY_FIRST_V2_PLACES.find(
      (item) => item.id === GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID
    );
    if (!place) {
      return {
        requestedId: GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID,
        status: "missing",
      };
    }
    return { place, status: "selected" };
  }

  const place = GEOGRAPHY_FIRST_V2_PLACES.find(
    (item) => item.id === requestedId
  );
  if (!place) {
    return { requestedId, status: "missing" };
  }
  return { place, status: "selected" };
}

export function geographyFirstV2PlaceHref(placeId: string): string {
  return `${GEOGRAPHY_FIRST_V2_PATH}?place=${encodeURIComponent(placeId)}`;
}

export function geographyFirstV2CliniciansHref(placeId: string): string {
  return `${GEOGRAPHY_FIRST_V2_CLINICIANS_PATH}?place=${encodeURIComponent(placeId)}`;
}

export function geographyFirstV2EvidenceHref(placeId: string): string {
  return `${GEOGRAPHY_FIRST_V2_EVIDENCE_PATH}?place=${encodeURIComponent(placeId)}`;
}

export function geographyFirstV2AudienceHref(
  audience: GeographyFirstV2Audience,
  placeId: string
): string {
  switch (audience) {
    case "public": {
      return geographyFirstV2PlaceHref(placeId);
    }
    case "clinicians": {
      return geographyFirstV2CliniciansHref(placeId);
    }
    case "evidence": {
      return geographyFirstV2EvidenceHref(placeId);
    }
    default: {
      const unreachable: never = audience;
      throw new Error(`Unknown audience: ${unreachable}`);
    }
  }
}

export function geographyFirstV2CopyStrings(): readonly string[] {
  return [
    ...GEOGRAPHY_FIRST_V2_PLACES.flatMap((place) => [
      place.kind,
      place.name,
      place.setting,
    ]),
    ...GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES.flatMap((item) => [
      item.detail,
      item.label,
    ]),
    ...GEOGRAPHY_FIRST_V2_GENERAL_EDUCATION.flatMap((topic) => [
      topic.summary,
      topic.title,
    ]),
    ...GEOGRAPHY_FIRST_V2_LIVED_EXPERIENCE.flatMap((topic) => [
      topic.summary,
      topic.title,
    ]),
    ...geographyFirstV2LocalClaims("Ridge Sample County").flatMap((row) => [
      row.claim,
      row.limitation,
      row.title,
    ]),
    ...geographyFirstV2ClinicianResources("Ridge Sample County").flatMap(
      (resource) => [
        resource.applicability,
        resource.boundary,
        resource.freshness,
        resource.source,
        resource.summary,
        resource.title,
      ]
    ),
    GEOGRAPHY_FIRST_V2_CLINICIAN_BOUNDARY,
    ...geographyFirstV2EvidenceTopics("Ridge Sample County").flatMap(
      (topic) => [
        topic.body,
        topic.summary,
        topic.title,
        topic.uncertainty,
        ...topic.rows.flatMap((row) => [row.label, row.note]),
      ]
    ),
    GEOGRAPHY_FIRST_V2_STATE_REVIEW.description,
    GEOGRAPHY_FIRST_V2_STATE_REVIEW.label,
    GEOGRAPHY_FIRST_V2_STATE_REVIEW.note,
    ...GEOGRAPHY_FIRST_V2_PROFESSIONAL_HANDOFFS.flatMap((link) => [
      link.description,
      link.label,
    ]),
    ...GEOGRAPHY_FIRST_V2_AUDIENCE_NAV.flatMap((item) => [
      item.description,
      item.label,
    ]),
  ];
}
