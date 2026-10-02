import {
  UX_LAB_PATH,
  UX_LAB_SAMPLE_NOTICE,
} from "@/features/ux-lab/prototype-contract";

/**
 * Disposable copy for the People-First Atlas Hub prototype (issues 309–310).
 * Task-oriented paths without persona selection. No clinical direction,
 * scores, classifications, or local-risk claims.
 */

export const PEOPLE_FIRST_HUB_PATH = `${UX_LAB_PATH}/people-first-hub` as const;

export const PEOPLE_FIRST_HUB_SAMPLE_NOTICE = UX_LAB_SAMPLE_NOTICE;

export const PEOPLE_FIRST_HUB_HYPOTHESIS =
  "Whether one task-oriented Atlas front door can welcome prevention-oriented visitors and people already affected by Lyme without forcing a persona choice.";

export const PEOPLE_FIRST_HUB_DIFFERENCE =
  "One task-oriented Atlas shell keeps lived-experience, clinician, and professional paths in the same navigation—without mandatory persona selection at the front door.";

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

export type PeopleFirstClinicianResource = {
  applicability: string;
  boundary: string;
  freshness: string;
  id: string;
  kind: "clinical-guidance" | "patient-materials" | "reporting";
  source: string;
  summary: string;
  title: string;
};

export const CLINICIAN_SURVEILLANCE_CONTEXT = {
  body: "Population surveillance summaries, reporting cadence, and jurisdiction notes belong in the public-health tools path. They describe community patterns—not individual patients—and stay visually separate from clinical resource listings.",
  heading: "Surveillance context is not clinical guidance",
} as const;

export const PEOPLE_FIRST_CLINICIAN_RESOURCES: readonly PeopleFirstClinicianResource[] =
  [
    {
      applicability:
        "Sample applicability: outpatient clinicians reviewing placeholder patient-education handouts.",
      boundary:
        "Listing only. Not instructions for a specific patient and not surveillance results.",
      freshness:
        "Sample freshness: placeholder catalog reviewed for layout in 2026-Q1.",
      id: "patient-handouts",
      kind: "patient-materials",
      source: "Sample source: governed outreach stub (prototype only).",
      summary:
        "Sample card for patient-facing PDFs listed with provenance visible up front.",
      title: "Patient-facing handout shelf",
    },
    {
      applicability:
        "Sample applicability: clinicians who need governed reference outlines, not live clinical protocols.",
      boundary:
        "Reference headings only. Does not direct care steps or interpret individual illness.",
      freshness:
        "Sample freshness: outline placeholder; not refreshed from a live library.",
      id: "clinical-reference-outline",
      kind: "clinical-guidance",
      source: "Sample source: neutral professional reference stub.",
      summary:
        "Sample layout for where clinical reference material could appear with explicit boundaries.",
      title: "Clinical reference outline",
    },
    {
      applicability:
        "Sample applicability: teams who need reporting contact placeholders, not live reporting workflow.",
      boundary:
        "Reporting links would appear with jurisdiction notes. No reporting action is wired in this prototype.",
      freshness:
        "Sample freshness: contact list placeholder; not refreshed from a live directory.",
      id: "reporting-contacts",
      kind: "reporting",
      source: "Sample source: fictional public-health directory entry.",
      summary:
        "Sample layout for reporting resource discovery with source and applicability cues on the card.",
      title: "Reporting resource contacts",
    },
  ];

export type PeopleFirstPublicHealthModule = {
  id: string;
  summary: string;
  title: string;
};

export const PEOPLE_FIRST_PUBLIC_HEALTH_MODULES: readonly PeopleFirstPublicHealthModule[] =
  [
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
      id: "investigation-entry",
      summary:
        "Sample reference to the professional investigation workspace. The live workspace is unchanged.",
      title: "Investigation entry reference",
    },
    {
      id: "outreach-handoff",
      summary:
        "Sample outline for reviewed handoff from professional findings into understandable public and clinician artifacts.",
      title: "Outreach handoff preview",
    },
  ];

export const PEOPLE_FIRST_PUBLIC_HEALTH_PLACE = {
  kind: "Sample jurisdiction",
  name: "Sample County",
  region: "North Example",
} as const;

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
    CLINICIAN_SURVEILLANCE_CONTEXT.heading,
    CLINICIAN_SURVEILLANCE_CONTEXT.body,
    ...PEOPLE_FIRST_CLINICIAN_RESOURCES.flatMap((resource) => [
      resource.title,
      resource.summary,
      resource.source,
      resource.freshness,
      resource.applicability,
      resource.boundary,
    ]),
    PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.kind,
    PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.name,
    PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.region,
    ...PEOPLE_FIRST_PUBLIC_HEALTH_MODULES.flatMap((module) => [
      module.title,
      module.summary,
    ]),
  ];
}
