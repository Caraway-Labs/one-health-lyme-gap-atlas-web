/**
 * Disposable Geography-First prototype content.
 * Fictional places only. Do not attach governed county identifiers,
 * scores, clinical direction, or local-risk claims.
 */

export const GEOGRAPHY_FIRST_PATH = "/ux-lab/geography-first";

export const GEOGRAPHY_FIRST_DEFAULT_PLACE_ID = "sample-county";

export type GeographyFirstPlace = {
  id: string;
  kind: string;
  name: string;
  setting: string;
};

export const GEOGRAPHY_FIRST_PLACES: readonly GeographyFirstPlace[] = [
  {
    id: GEOGRAPHY_FIRST_DEFAULT_PLACE_ID,
    kind: "County",
    name: "Sample County",
    setting: "Representative fictional county for this prototype.",
  },
  {
    id: "sample-parish",
    kind: "Parish",
    name: "Sample Parish",
    setting: "Second fictional place so location search can be compared.",
  },
  {
    id: "harbor-sample",
    kind: "Local area",
    name: "Harbor Sample",
    setting: "Fictional local area that uses the same layered page.",
  },
];

export const GEOGRAPHY_FIRST_PUBLIC_TOPICS = [
  {
    id: "tick-awareness",
    summary:
      "Sample public-education topic about ticks and Lyme disease. It names a topic people can learn about. It does not estimate exposure for people who live here.",
    title: "Tick awareness",
  },
  {
    id: "prevention-topics",
    summary:
      "Sample heading for prevention content. Prototype copy is not personal prevention advice.",
    title: "Prevention topics",
  },
  {
    id: "outreach",
    summary: "Sample public-outreach materials for a place-based walkthrough.",
    title: "Outreach resources",
  },
] as const;

export const GEOGRAPHY_FIRST_CLINICIAN_TOPICS = [
  {
    id: "clinician-resources",
    summary:
      "Sample cards for professional resource discovery. Not a clinical care pathway.",
    title: "Clinician resource cards",
  },
  {
    id: "reporting-links",
    summary:
      "Sample labels for where reporting resources could be listed. No reporting workflow is connected.",
    title: "Reporting resource links",
  },
] as const;

export const GEOGRAPHY_FIRST_SURVEILLANCE_DISCLOSURES = [
  {
    body: "This is a sample description of an evidence-review summary. It includes no scores, counts, or classifications. A real review belongs in the professional Atlas.",
    id: "evidence-summary",
    summary: "Open the sample surveillance summary",
  },
  {
    body: "A governed county page would name sources, vintage, and completeness here. In this sample those fields are blank on purpose. Blank fields mean the information is missing. They are not zeros, and they do not mean disease is absent.",
    id: "methodology",
    summary: "Open methodology and missingness",
  },
] as const;

export const GEOGRAPHY_FIRST_PROFESSIONAL_LINKS = [
  {
    description: "County surveillance review in the live Atlas.",
    href: "/investigate",
    id: "investigation-workspace",
    label: "Investigation Workspace",
  },
  {
    description: "Linked map, table, and chart views in the live Atlas.",
    href: "/geographic_explorer",
    id: "geographic-explorer",
    label: "Geographic Explorer",
  },
] as const;

export type GeographyFirstSelection =
  | { place: GeographyFirstPlace; status: "selected" }
  | { requestedId: string; status: "missing" };

export function geographyFirstPlaceParam(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    return geographyFirstPlaceParam(value[0]);
  }
  return undefined;
}

export function resolveGeographyFirstPlace(
  requestedId?: string
): GeographyFirstSelection {
  if (!requestedId) {
    const place = GEOGRAPHY_FIRST_PLACES.find(
      (item) => item.id === GEOGRAPHY_FIRST_DEFAULT_PLACE_ID
    );
    if (!place) {
      return {
        requestedId: GEOGRAPHY_FIRST_DEFAULT_PLACE_ID,
        status: "missing",
      };
    }
    return { place, status: "selected" };
  }

  const place = GEOGRAPHY_FIRST_PLACES.find((item) => item.id === requestedId);
  if (!place) {
    return { requestedId, status: "missing" };
  }
  return { place, status: "selected" };
}

export function geographyFirstPlaceHref(placeId: string): string {
  return `${GEOGRAPHY_FIRST_PATH}?place=${placeId}`;
}

export function geographyFirstCopyStrings(): readonly string[] {
  return [
    ...GEOGRAPHY_FIRST_PLACES.flatMap((place) => [
      place.kind,
      place.name,
      place.setting,
    ]),
    ...GEOGRAPHY_FIRST_PUBLIC_TOPICS.flatMap((topic) => [
      topic.summary,
      topic.title,
    ]),
    ...GEOGRAPHY_FIRST_CLINICIAN_TOPICS.flatMap((topic) => [
      topic.summary,
      topic.title,
    ]),
    ...GEOGRAPHY_FIRST_SURVEILLANCE_DISCLOSURES.flatMap((item) => [
      item.body,
      item.summary,
    ]),
    ...GEOGRAPHY_FIRST_PROFESSIONAL_LINKS.flatMap((link) => [
      link.description,
      link.label,
    ]),
  ];
}
