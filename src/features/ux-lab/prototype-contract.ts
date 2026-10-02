import type { Metadata } from "next";

/**
 * Shared contract for disposable Atlas UX Lab prototypes.
 * Concept routes live under `/ux-lab/<concept>` and inherit this harness.
 * Keep sample copy free of clinical guidance, scores, and local-risk claims.
 */

export const UX_LAB_PATH = "/ux-lab";

export const UX_LAB_BANNER_LABEL = "Atlas UX Prototype — Product research only";

export const UX_LAB_TESTING_LABEL = "What this variant is testing";

export const UX_LAB_SECOND_ROUND_LABEL = "Second-round research concept";

export const UX_LAB_ROBOTS = { follow: false, index: false } as const;

export const UX_LAB_SAMPLE_NOTICE =
  "Sample labels for prototype layout only. This is not surveillance data, clinical guidance, or a statement about local risk.";

export const UX_LAB_CONCEPT_IDS = [
  "persona-gateway",
  "public-first",
  "three-lanes",
  "geography-first",
  "public-site-pro-app",
  "people-first-hub",
] as const;

export type UxLabConceptId = (typeof UX_LAB_CONCEPT_IDS)[number];

export type UxLabConceptStatus = "available" | "planned";

export type UxLabResearchRound = "second";

export type UxLabConcept = {
  difference: string;
  href: `${typeof UX_LAB_PATH}/${UxLabConceptId}`;
  hypothesis: string;
  id: UxLabConceptId;
  researchRound?: UxLabResearchRound;
  status: UxLabConceptStatus;
  title: string;
};

export const UX_LAB_AUDIENCES = [
  "public",
  "clinician",
  "public-health",
] as const;

export type UxLabAudience = (typeof UX_LAB_AUDIENCES)[number];

export const UX_LAB_AUDIENCE_LABELS: Record<UxLabAudience, string> = {
  clinician: "Clinician",
  "public-health": "Public health",
  public: "Public",
};

export type UxLabSampleTopic = {
  audience: UxLabAudience;
  id: string;
  summary: string;
  title: string;
};

export const UX_LAB_CONCEPTS: readonly UxLabConcept[] = [
  {
    difference: "The front door asks visitors to choose an audience.",
    href: "/ux-lab/persona-gateway",
    hypothesis:
      "Whether choosing Public, Clinician, or Public Health before anything else makes the right depth of Atlas obvious.",
    id: "persona-gateway",
    status: "available",
    title: "Persona Gateway",
  },
  {
    difference: "Professional paths stay available after the public snapshot.",
    href: "/ux-lab/public-first",
    hypothesis:
      "Whether understandable public and local context should come first, with professional tools still easy to reach.",
    id: "public-first",
    status: "available",
    title: "Public-First Local Snapshot",
  },
  {
    difference:
      "Learn, Clinical Resources, and Public Health & Intelligence are peers.",
    href: "/ux-lab/three-lanes",
    hypothesis:
      "Whether Learn, Clinical Resources, and Public Health & Intelligence should be peer destinations in one Atlas.",
    id: "three-lanes",
    status: "available",
    title: "One Atlas / Three Lanes",
  },
  {
    difference: "Audience-specific content deepens from a shared place.",
    href: "/ux-lab/geography-first",
    hypothesis:
      "Whether a shared place should organize the experience, with audience-specific depth layered on that place.",
    id: "geography-first",
    status: "available",
    title: "Geography-First",
  },
  {
    difference:
      "The advanced workspace is related, and visibly separate, from the public front door.",
    href: "/ux-lab/public-site-pro-app",
    hypothesis:
      "Whether a public and clinical site should lead into a related but clearly separate professional application.",
    id: "public-site-pro-app",
    status: "available",
    title: "Public Site + Professional App",
  },
  {
    difference:
      "One task-oriented Atlas shell keeps lived-experience, clinician, and professional paths in the same navigation—without mandatory persona selection at the front door.",
    href: "/ux-lab/people-first-hub",
    hypothesis:
      "Whether one task-oriented Atlas front door can welcome prevention-oriented visitors and people already affected by Lyme without forcing a persona choice.",
    id: "people-first-hub",
    researchRound: "second",
    status: "available",
    title: "People-First Atlas Hub",
  },
];

export const UX_LAB_COMPARISON_CRITERIA = [
  {
    id: "first-time-comprehension",
    label: "First-time comprehension",
    prompt:
      "Can a new visitor say what Atlas is for before they need specialist vocabulary?",
  },
  {
    id: "public-usefulness",
    label: "Public usefulness",
    prompt:
      "Does a public visitor get something understandable without first entering an expert workflow?",
  },
  {
    id: "clinician-discoverability",
    label: "Clinician discoverability",
    prompt:
      "Can a clinician recognize a professional resource path, and tell it apart from public education?",
  },
  {
    id: "professional-differentiation",
    label: "Professional differentiation",
    prompt:
      "Is the public-health investigation material visibly different in depth from public and clinician material?",
  },
  {
    id: "geography",
    label: "Geography",
    prompt:
      "How does place show up: as the organizing object, as supporting context, or later in the path?",
  },
  {
    id: "cross-persona-movement",
    label: "Cross-persona movement",
    prompt:
      "How does someone move between audience materials, and is that movement explicit?",
  },
  {
    id: "perceived-complexity",
    label: "Perceived complexity",
    prompt:
      "How much structure is visible at once, and does that read as clarity or as too many choices?",
  },
] as const;

export type UxLabComparisonCriterionId =
  (typeof UX_LAB_COMPARISON_CRITERIA)[number]["id"];

export const UX_LAB_KNOWN_LIMITATIONS = [
  "These are research prototypes. None of the concepts is a selected production design.",
  "Copy and places are samples. They are not surveillance results, clinical guidance, or statements about local risk.",
  "Place search filters a fixed sample list. It does not look up governed counties.",
  "Accounts, saved preferences, reporting workflows, and investigation tools are not connected.",
  "Visual completeness is for the walkthrough. It does not mean a screen is production-ready.",
] as const;

export type UxLabMockedInteraction = {
  conceptId: UxLabConceptId;
  detail: string;
};

export const UX_LAB_MOCKED_INTERACTIONS: readonly UxLabMockedInteraction[] = [
  {
    conceptId: "persona-gateway",
    detail:
      "Audience cards and the switcher move among static sample pages. The choice is not saved, and no one is signed in.",
  },
  {
    conceptId: "public-first",
    detail:
      "The place control swaps a fictional snapshot. Clinical and surveillance pages are static layouts, not live professional tools.",
  },
  {
    conceptId: "three-lanes",
    detail:
      "Lane navigation and shared-topic links jump between static sample pages. They do not share live records.",
  },
  {
    conceptId: "geography-first",
    detail:
      "Place search and surveillance disclosures use fictional sample text. Professional links open the live Atlas without a county identifier or a sample finding.",
  },
  {
    conceptId: "public-site-pro-app",
    detail:
      "Open Atlas changes the visual shell only. Evidence and investigation pages outline the professional workspace. They do not load live tools.",
  },
  {
    conceptId: "people-first-hub",
    detail:
      "Task navigation moves among static sample pages in one shared shell. Clinician listings and the public-health workspace show provenance placeholders only—no live reporting, county lookup, or investigation tools.",
  },
];

export type UxLabSessionRoute = {
  href: string;
  label: string;
};

export const UX_LAB_SESSION_ROUTES: readonly UxLabSessionRoute[] = [
  { href: "/ux-lab", label: "Comparison index" },
  { href: "/ux-lab/persona-gateway", label: "Persona Gateway" },
  {
    href: "/ux-lab/persona-gateway/public",
    label: "Persona Gateway · Public",
  },
  {
    href: "/ux-lab/persona-gateway/clinician",
    label: "Persona Gateway · Clinician",
  },
  {
    href: "/ux-lab/persona-gateway/public-health",
    label: "Persona Gateway · Public health",
  },
  { href: "/ux-lab/public-first", label: "Public-First Local Snapshot" },
  {
    href: "/ux-lab/public-first/clinical",
    label: "Public-First · Clinical Resources",
  },
  {
    href: "/ux-lab/public-first/surveillance",
    label: "Public-First · Surveillance",
  },
  { href: "/ux-lab/three-lanes", label: "One Atlas / Three Lanes" },
  { href: "/ux-lab/three-lanes/learn", label: "Three Lanes · Learn" },
  {
    href: "/ux-lab/three-lanes/clinical",
    label: "Three Lanes · Clinical Resources",
  },
  {
    href: "/ux-lab/three-lanes/intelligence",
    label: "Three Lanes · Public Health & Intelligence",
  },
  { href: "/ux-lab/geography-first", label: "Geography-First" },
  {
    href: "/ux-lab/public-site-pro-app",
    label: "Public Site + Professional App",
  },
  {
    href: "/ux-lab/public-site-pro-app/education",
    label: "Public site · Education",
  },
  {
    href: "/ux-lab/public-site-pro-app/clinicians",
    label: "Public site · Clinicians",
  },
  { href: "/ux-lab/public-site-pro-app/app", label: "Professional app" },
  { href: "/ux-lab/people-first-hub", label: "People-First Atlas Hub" },
  {
    href: "/ux-lab/people-first-hub/living-with-lyme",
    label: "People-First · Living with Lyme",
  },
  {
    href: "/ux-lab/people-first-hub/learn",
    label: "People-First · Learn about Lyme",
  },
  {
    href: "/ux-lab/people-first-hub/local-context",
    label: "People-First · Local context",
  },
  {
    href: "/ux-lab/people-first-hub/clinicians",
    label: "People-First · Clinician resources",
  },
  {
    href: "/ux-lab/people-first-hub/public-health",
    label: "People-First · Public-health tools",
  },
];

export const UX_LAB_SAMPLE_TOPICS: readonly UxLabSampleTopic[] = [
  {
    audience: "public",
    id: "tick-awareness",
    summary: "Sample public-education topic about ticks and Lyme disease.",
    title: "Tick awareness",
  },
  {
    audience: "public",
    id: "prevention-topics",
    summary:
      "Sample heading for prevention content. Prototype copy is not personal prevention advice.",
    title: "Prevention topics",
  },
  {
    audience: "public",
    id: "outreach",
    summary: "Sample public-outreach materials for stakeholder walkthroughs.",
    title: "Outreach resources",
  },
  {
    audience: "public",
    id: "sample-place",
    summary:
      "Fictional Sample County stands in for a location-shaped layout. It is not a real county finding.",
    title: "Sample place",
  },
  {
    audience: "clinician",
    id: "clinician-resources",
    summary:
      "Sample cards for professional resource discovery. Not a clinical care pathway.",
    title: "Clinician resource cards",
  },
  {
    audience: "clinician",
    id: "reporting-links",
    summary:
      "Sample labels for where reporting resources could be listed. No reporting workflow is connected.",
    title: "Reporting resource links",
  },
  {
    audience: "public-health",
    id: "evidence-summary",
    summary:
      "Sample description of an evidence-review summary. No scores or classifications are included.",
    title: "Evidence summary",
  },
  {
    audience: "public-health",
    id: "action-center",
    summary:
      "Sample reference to the professional investigation workspace. The live workspace is unchanged.",
    title: "Action Center reference",
  },
];

export function uxLabMetadata(): Metadata {
  return {
    alternates: { canonical: null },
    description:
      "Product-research prototypes for comparing Atlas information architecture. Not a production experience.",
    robots: UX_LAB_ROBOTS,
    title: {
      default: "UX Lab | One Health Lyme Gap Atlas",
      template: "%s | UX Lab",
    },
  };
}

export function uxLabSampleTopicsForAudience(
  audience: UxLabAudience
): readonly UxLabSampleTopic[] {
  return UX_LAB_SAMPLE_TOPICS.filter((topic) => topic.audience === audience);
}

export function uxLabConceptById(id: UxLabConceptId): UxLabConcept {
  const concept = UX_LAB_CONCEPTS.find((item) => item.id === id);
  if (!concept) {
    throw new Error(`Unknown UX Lab concept: ${id}`);
  }
  return concept;
}
