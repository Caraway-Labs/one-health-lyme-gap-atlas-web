import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";

/**
 * Disposable copy for the Public-First Local Snapshot prototype.
 * Places are fictional layout stand-ins. Do not add scores, counts,
 * clinical direction, or claims that transmission is occurring.
 */

export const PUBLIC_FIRST_PATH = "/ux-lab/public-first";

export const PUBLIC_FIRST_SAMPLE_NOTICE = UX_LAB_SAMPLE_NOTICE;

export const PUBLIC_FIRST_PLACES = [
  {
    id: "sample-county",
    kind: "County",
    name: "Sample County",
    region: "North Example",
  },
  {
    id: "river-parish",
    kind: "Parish",
    name: "River Parish",
    region: "South Example",
  },
  {
    id: "harbor-borough",
    kind: "Borough",
    name: "Harbor Borough",
    region: "East Example",
  },
] as const;

export type PublicFirstPlace = (typeof PUBLIC_FIRST_PLACES)[number];

export type PublicFirstPlaceId = PublicFirstPlace["id"];

export type PublicFirstSelection = {
  place: PublicFirstPlace;
  unrecognizedPlace: boolean;
};

export type PublicFirstSection = "clinical" | "snapshot" | "surveillance";

const DEFAULT_PLACE = PUBLIC_FIRST_PLACES[0];

export function readPublicFirstPlace(
  value?: string | string[]
): PublicFirstSelection {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return { place: DEFAULT_PLACE, unrecognizedPlace: false };
  }
  const place = PUBLIC_FIRST_PLACES.find((candidate) => candidate.id === raw);
  if (!place) {
    return { place: DEFAULT_PLACE, unrecognizedPlace: true };
  }
  return { place, unrecognizedPlace: false };
}

export function publicFirstHref(
  placeId: PublicFirstPlaceId,
  section: PublicFirstSection = "snapshot"
): string {
  const path =
    section === "snapshot"
      ? PUBLIC_FIRST_PATH
      : `${PUBLIC_FIRST_PATH}/${section}`;
  return `${path}?place=${placeId}`;
}

export const PUBLIC_FIRST_CONTEXT_ROWS = [
  {
    id: "reported-cases",
    summary:
      "A published snapshot could point to case-surveillance references for a jurisdiction. No case counts are loaded here.",
    title: "Reported-case context",
  },
  {
    id: "tick-habitat",
    summary:
      "A published snapshot could point to tick or habitat references. This prototype does not state that ticks or pathogens are present.",
    title: "Tick and habitat context",
  },
  {
    id: "care-access",
    summary:
      "A published snapshot could describe care-access context for a place. It would not direct a person to a clinician.",
    title: "Care-access context",
  },
] as const;

export const PUBLIC_FIRST_EDUCATION = [
  {
    id: "tick-awareness",
    summary:
      "Sample heading for public education about ticks and Lyme disease. The topics are placeholders for a stakeholder walkthrough.",
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
    summary: "Sample public-outreach materials for stakeholder walkthroughs.",
    title: "Outreach resources",
  },
] as const;

export const PUBLIC_FIRST_CLINICAL_CARDS = [
  {
    id: "clinician-resources",
    summary:
      "Sample cards for professional resource discovery. This is not a clinical care pathway.",
    title: "Clinician resource cards",
  },
  {
    id: "reporting-links",
    summary:
      "Sample labels for where reporting resources could be listed. No reporting workflow is connected.",
    title: "Reporting resource links",
  },
] as const;

export const PUBLIC_FIRST_SURVEILLANCE_MODULES = [
  {
    id: "evidence-summary",
    summary:
      "Sample description of an evidence-review summary. No scores or classifications are included.",
    title: "Evidence summary",
  },
  {
    id: "methods",
    summary:
      "Sample location for methodology, freshness, and limitation notes. The live Atlas methods pages are unchanged.",
    title: "Methods and limitations",
  },
  {
    id: "action-center",
    summary:
      "Sample reference to the professional investigation workspace. The live workspace is unchanged.",
    title: "Action Center reference",
  },
] as const;

export function publicFirstCopyCorpus(): readonly string[] {
  return [
    PUBLIC_FIRST_SAMPLE_NOTICE,
    ...PUBLIC_FIRST_PLACES.flatMap((place) => [
      place.kind,
      place.name,
      place.region,
    ]),
    ...PUBLIC_FIRST_CONTEXT_ROWS.flatMap((row) => [row.title, row.summary]),
    ...PUBLIC_FIRST_EDUCATION.flatMap((topic) => [topic.title, topic.summary]),
    ...PUBLIC_FIRST_CLINICAL_CARDS.flatMap((card) => [
      card.title,
      card.summary,
    ]),
    ...PUBLIC_FIRST_SURVEILLANCE_MODULES.flatMap((module) => [
      module.title,
      module.summary,
    ]),
  ];
}
