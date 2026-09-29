import {
  UX_LAB_PATH,
  UX_LAB_SAMPLE_NOTICE,
} from "@/features/ux-lab/prototype-contract";

/**
 * Disposable copy for the People-First Atlas Hub prototype (issue 309).
 * Task-oriented paths without persona selection. No clinical direction,
 * scores, classifications, or local-risk claims.
 */

export const PEOPLE_FIRST_HUB_PATH = `${UX_LAB_PATH}/people-first-hub` as const;

export const PEOPLE_FIRST_HUB_SAMPLE_NOTICE = UX_LAB_SAMPLE_NOTICE;

export const PEOPLE_FIRST_HUB_HYPOTHESIS =
  "Whether one task-oriented Atlas front door can welcome prevention-oriented visitors and people already affected by Lyme without forcing a persona choice.";

export const PEOPLE_FIRST_HUB_DIFFERENCE =
  "Paths follow information needs (learn, live with Lyme, local context) while clinician and public-health tools stay visible but secondary.";

export const PEOPLE_FIRST_TASK_IDS = [
  "learn",
  "living-with-lyme",
  "local-context",
  "clinicians",
  "public-health",
] as const;

export type PeopleFirstTaskId = (typeof PEOPLE_FIRST_TASK_IDS)[number];

export type PeopleFirstTask = {
  audience: "public" | "professional";
  description: string;
  emphasis?: "featured";
  id: PeopleFirstTaskId;
  navLabel: string;
  summary: string;
};

export const PEOPLE_FIRST_TASKS: Record<PeopleFirstTaskId, PeopleFirstTask> = {
  learn: {
    audience: "public",
    description:
      "Plain-language orientation to ticks, Lyme disease, and how public health monitors the disease.",
    id: "learn",
    navLabel: "Learn about Lyme",
    summary:
      "Start here if you want background before diving into a specific concern.",
  },
  "living-with-lyme": {
    audience: "public",
    description:
      "Ongoing symptoms, follow-up questions, and supporting a family member—without treating Atlas as a care plan.",
    emphasis: "featured",
    id: "living-with-lyme",
    navLabel: "Living with Lyme",
    summary:
      "For people already affected or supporting someone who is—not only prevention visitors.",
  },
  "local-context": {
    audience: "public",
    description:
      "How place-shaped information could appear in Atlas without implying personal medical risk.",
    id: "local-context",
    navLabel: "Local context",
    summary:
      "Sample geography and surveillance limitations in understandable language.",
  },
  clinicians: {
    audience: "professional",
    description:
      "Trustworthy resource discovery and patient-facing materials for clinical teams.",
    id: "clinicians",
    navLabel: "Clinician resources",
    summary: "Professional listings with source and freshness placeholders.",
  },
  "public-health": {
    audience: "professional",
    description:
      "Evidence review, investigation references, and communication tools for health departments.",
    id: "public-health",
    navLabel: "Public-health tools",
    summary: "Deeper Atlas workflows without dominating the public front door.",
  },
};

export function peopleFirstHubHref(taskId?: PeopleFirstTaskId): string {
  if (taskId === undefined) {
    return PEOPLE_FIRST_HUB_PATH;
  }
  return `${PEOPLE_FIRST_HUB_PATH}/${taskId}`;
}

export type TrustworthyResource = {
  boundary: string;
  freshness: string;
  id: string;
  source: string;
  summary: string;
  title: string;
};

export const LIVING_WITH_LYME_SECTIONS = [
  {
    body: "Atlas does not evaluate individual illness or replace clinical care. This prototype shows how understandable information could acknowledge ongoing concerns while pointing to governed external resources.",
    heading: "What this path is for",
  },
  {
    body: "Sample headings only: finding credible follow-up information, understanding surveillance limits, and supporting a family member without implying individual risk.",
    heading: "Representative topics",
  },
] as const;

export const LIVING_WITH_LYME_RESOURCES: readonly TrustworthyResource[] = [
  {
    boundary:
      "Prototype placeholder. Not a referral to care and not an endorsement of any organization.",
    freshness: "Sample freshness label",
    id: "patient-education-outline",
    source: "Sample source label (neutral)",
    summary:
      "A card layout for externally maintained patient-education material with explicit source attribution.",
    title: "Patient education outline",
  },
  {
    boundary:
      "Does not interpret symptoms or direct care. Links would open governed destinations only.",
    freshness: "Sample freshness label",
    id: "supporting-a-family-member",
    source: "Sample source label (neutral)",
    summary:
      "Caregiver-oriented reading that stays informational, not a care pathway.",
    title: "Supporting a family member",
  },
  {
    boundary:
      "Surveillance data describe populations, not individual outcomes. No local transmission claims in this prototype.",
    freshness: "Sample freshness label",
    id: "uncertainty-and-limits",
    source: "Atlas methodology placeholder",
    summary:
      "How Atlas could surface reporting delays and data gaps without overwhelming nonexpert readers.",
    title: "Uncertainty and surveillance limits",
  },
];

export const LEARN_TOPIC_CARDS = [
  {
    id: "ticks-and-lyme-basics",
    summary:
      "Sample plain-language overview of how ticks relate to Lyme disease in public education materials.",
    title: "Ticks and Lyme basics",
  },
  {
    id: "prevention-headings",
    summary:
      "Topic headings for prevention content—not personal prevention instructions in this prototype.",
    title: "Prevention topic headings",
  },
  {
    id: "after-a-tick-bite",
    summary:
      "Sample structure for what to read after a tick encounter, without clinical directives.",
    title: "After a tick bite",
  },
] as const;

export const LOCAL_CONTEXT_PLACE = {
  kind: "County",
  name: "Sample County",
  region: "North Example",
} as const;

export const LOCAL_CONTEXT_ROWS = [
  {
    id: "monitoring-topics",
    summary:
      "Topics a health department might review for a jurisdiction. No connected feed in this prototype.",
    title: "Monitoring topics",
  },
  {
    id: "not-personal-risk",
    summary:
      "This layout does not estimate individual illness risk or where an infection occurred.",
    title: "Not personal medical risk",
  },
] as const;

export function peopleFirstHubCopyCorpus(): readonly string[] {
  return [
    PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
    PEOPLE_FIRST_HUB_HYPOTHESIS,
    PEOPLE_FIRST_HUB_DIFFERENCE,
    ...Object.values(PEOPLE_FIRST_TASKS).flatMap((task) => [
      task.navLabel,
      task.summary,
      task.description,
    ]),
    ...LIVING_WITH_LYME_SECTIONS.flatMap((section) => [
      section.heading,
      section.body,
    ]),
    ...LIVING_WITH_LYME_RESOURCES.flatMap((resource) => [
      resource.title,
      resource.summary,
      resource.source,
      resource.boundary,
    ]),
    ...LEARN_TOPIC_CARDS.flatMap((topic) => [topic.title, topic.summary]),
    LOCAL_CONTEXT_PLACE.kind,
    LOCAL_CONTEXT_PLACE.name,
    LOCAL_CONTEXT_PLACE.region,
    ...LOCAL_CONTEXT_ROWS.flatMap((row) => [row.title, row.summary]),
  ];
}
