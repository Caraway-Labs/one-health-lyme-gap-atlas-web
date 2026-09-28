import type { Metadata } from "next";

/**
 * Shared contract for disposable Atlas UX Lab prototypes.
 * Concept routes live under `/ux-lab/<concept>` and inherit this harness.
 * Keep sample copy free of clinical guidance, scores, and local-risk claims.
 */

export const UX_LAB_PATH = "/ux-lab";

export const UX_LAB_BANNER_LABEL = "Atlas UX Prototype — Product research only";

export const UX_LAB_SAMPLE_NOTICE =
  "Sample labels for prototype layout only. This is not surveillance data, clinical guidance, or a statement about local risk.";

export const UX_LAB_CONCEPT_IDS = [
  "persona-gateway",
  "public-first",
  "three-lanes",
  "geography-first",
  "public-site-pro-app",
] as const;

export type UxLabConceptId = (typeof UX_LAB_CONCEPT_IDS)[number];

export type UxLabConceptStatus = "available" | "planned";

export type UxLabConcept = {
  difference: string;
  href: `${typeof UX_LAB_PATH}/${UxLabConceptId}`;
  hypothesis: string;
  id: UxLabConceptId;
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
    hypothesis: "Explicit Public, Clinician, and Public Health entry points.",
    id: "persona-gateway",
    status: "planned",
    title: "Persona Gateway",
  },
  {
    difference: "Professional paths stay available after the public snapshot.",
    href: "/ux-lab/public-first",
    hypothesis:
      "Understandable public and local value comes before professional tools.",
    id: "public-first",
    status: "planned",
    title: "Public-First Local Snapshot",
  },
  {
    difference:
      "Learn, Clinical Resources, and Public Health & Intelligence are peers.",
    href: "/ux-lab/three-lanes",
    hypothesis: "One Atlas with three peer top-level destinations.",
    id: "three-lanes",
    status: "planned",
    title: "One Atlas / Three Lanes",
  },
  {
    difference: "Audience-specific content deepens from a shared place.",
    href: "/ux-lab/geography-first",
    hypothesis: "A location experience is the shared object.",
    id: "geography-first",
    status: "available",
    title: "Geography-First",
  },
  {
    difference:
      "The advanced workspace is related, and visibly separate, from the public front door.",
    href: "/ux-lab/public-site-pro-app",
    hypothesis:
      "A public and clinical informational site leads into a distinct professional application.",
    id: "public-site-pro-app",
    status: "planned",
    title: "Public Site + Professional App",
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
    robots: { follow: false, index: false },
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
