/**
 * Disposable Geography-First v2 prototype content.
 * Fictional places only. No governed identifiers, scores, or local-risk claims.
 */

export const GEOGRAPHY_FIRST_V2_PATH = "/ux-lab/geography-first-v2";

export const GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID = "ridge-sample-county";

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
  return `${GEOGRAPHY_FIRST_V2_PATH}?place=${placeId}`;
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
  ];
}
