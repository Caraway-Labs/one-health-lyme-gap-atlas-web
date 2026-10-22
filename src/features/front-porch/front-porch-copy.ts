import {
  FRONT_PORCH_CONTEXT_OBSERVATION,
  FRONT_PORCH_HUMAN_OBSERVATION,
  FRONT_PORCH_VECTOR_OBSERVATION,
} from "@/features/front-porch/front-porch-example";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

export const FRONT_PORCH_HERO_EYEBROW =
  "One county. Many signals. A clearer picture.";

export const FRONT_PORCH_HERO_HEADLINE =
  "Connect the data. See the bigger picture.";

/** Desktop keeps one sentence per line. Smaller screens wrap the same words. */
export const FRONT_PORCH_HERO_HEADLINE_LINES = [
  "Connect the data.",
  "See the bigger picture.",
] as const;

export const FRONT_PORCH_HERO_SUPPORT =
  "One Health Atlas brings county-level Lyme surveillance, tick and pathogen data, and community context into one place. It helps public health professionals compare counties, review data gaps, and identify questions for local follow-up.";

export const FRONT_PORCH_HERO_AUDIENCE =
  "Designed for epidemiologists and vector-borne disease programs.";

export const FRONT_PORCH_HERO_EXAMPLE =
  "Follow the Lyme disease example in Montgomery County, Virginia.";

export const FRONT_PORCH_GLASS_CALLOUT = "Human health + Vectors + Environment";

export const FRONT_PORCH_FOLLOW_STORY_LABEL = "Follow the story";

export const FRONT_PORCH_HOW_ID = "front-porch-how";

export const FRONT_PORCH_STORY_ID = "front-porch-story";

export const FRONT_PORCH_EXPLORE_LABEL = "Explore Atlas";

export const FRONT_PORCH_WORKSPACE_LABEL = "Explore One Health Atlas";

export const FRONT_PORCH_EXPLORE_SUPPORT = "Workspace access requires sign-in.";

/** Owner-approved transparent ecosystem illustration (Web issues 478 / 475). */
export const FRONT_PORCH_HERO_IMAGE = {
  approved: true,
  src: "/images/one-health-ecosystem.png",
} as const;

/**
 * Anonymous-safe trust links for `/` (issue 534).
 * Production returns 200 for `/privacy`, `/ai-ethics`, and `/data-provenance`.
 * Privacy settings stays the shared PrivacyPreferences dialog.
 */
export const FRONT_PORCH_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/ai-ethics", label: "AI / Responsible Use" },
  { href: "/data-provenance", label: "Data Provenance" },
] as const;

export const FRONT_PORCH_INTRO = {
  eyebrow: "The question worth asking",
  paragraph:
    "Start with reported Lyme disease, then add tick surveillance and community context. This illustrative walkthrough uses published data from Montgomery County, Virginia, to explore what the sources tell us and what questions remain.",
  title: "What can we learn by looking at the data together?",
} as const;

export const FRONT_PORCH_TRUST_ID = "front-porch-trust";

export const FRONT_PORCH_TRUST_PANEL_LABEL = "Understand the data";

export const FRONT_PORCH_TRUST = {
  eyebrow: "Confidence through clarity",
  paragraph:
    "Every finding has a source, a time period, and limits to its interpretation. One Health Atlas makes these details visible so public health professionals can assess what the data support and where additional information is needed.",
  title: "What's missing from the data matters, too.",
} as const;

export const FRONT_PORCH_EXAMPLE_PERIODS = [
  {
    label: "Reported probable cases",
    period: "2023 · County of residence",
  },
  {
    label: "Tick and pathogen status",
    period: "Cumulative through December 2025",
  },
  {
    label: "Insurance coverage",
    period: "2018\u20132022 ACS · CDC/ATSDR SVI 2022",
  },
] as const;

export const FRONT_PORCH_TRUST_LINES = [
  {
    detail: "Data sources and definitions",
    href: "/docs/sources-and-canonical-evidence",
    label: "Sources",
  },
  {
    detail: "Observation periods and methodology",
    href: "/docs/releases-and-methodology",
    label: "Time periods",
  },
  {
    detail: "Missing data and uncertainty",
    href: "/docs/evidence-and-uncertainty",
    label: "Coverage",
  },
  {
    detail: "Current capabilities and limitations",
    href: "/docs/current-capabilities",
    label: "Limitations",
  },
] as const;

export const FRONT_PORCH_REVIEW_PRIORITY_NOTE = {
  text: "County review priorities use defined, versioned scoring rules. The methodology explains how the published data contribute to the results.",
  title: "Review priorities",
} as const;

export const FRONT_PORCH_ASK_ATLAS_NOTE = {
  text: "Ask Atlas is a separate tool for exploring published literature. It does not determine county review priorities. Responses should be checked against the cited sources.",
  title: "Ask Atlas",
} as const;

export const FRONT_PORCH_TRUST_LINKS = [
  {
    href: "/docs/releases-and-methodology",
    label: "Review-priority methodology",
  },
  {
    href: "/ai-ethics",
    label: "AI and responsible use",
  },
] as const;

export const FRONT_PORCH_RELEASE_SUMMARY =
  "Example snapshot and release details";

export const FRONT_PORCH_SYNTHESIS_ID = "front-porch-synthesis";

export const FRONT_PORCH_SYNTHESIS = {
  eyebrow: "From data to local questions",
  interpretation:
    "The combined view supports further review. It does not, by itself, establish underreporting or a surveillance gap.",
  paragraphs: [
    "One Health Atlas connects human Lyme disease surveillance, tick and pathogen records, and community context by county. Public health professionals can review these findings together, trace them to their sources, and identify where local information could strengthen interpretation.",
    "For Montgomery County, the result is a starting point for discussion: reported illness among residents, documented tick and pathogen presence, and insurance coverage, each with its own period and limitations.",
  ],
  priorityLabel: "Atlas review priority",
  priorityRest:
    " in this release. This relative priority is calculated using versioned scoring rules to help organize county review. It does not mean low Lyme disease risk or low disease burden.",
  priorityStart: "Montgomery County has a ",
  priorityTerm: "Watch priority",
  question:
    "What do local exposure histories and tick sampling records add to our understanding of the reported cases?",
  questionLabel: "A question for local review",
  title: "Bring separate data into a shared view.",
} as const;

export const FRONT_PORCH_WORKFLOW_ID = "front-porch-workflow";

export const FRONT_PORCH_WORKFLOW = {
  eyebrow: "In the workspace",
  note: "Sign-in provides access to the map, county data, and review tools.",
  purpose:
    "One Health Atlas helps public health programs organize data review, consider community context, and focus questions about surveillance, prevention, outreach, and professional education.",
  steps: [
    {
      detail:
        "Start with the national map or focus on a state, then select a county of interest.",
      title: "Select a county",
    },
    {
      detail:
        "Examine human, tick, pathogen, and community data alongside their sources, time periods, and limitations. Review the county’s priority for follow-up and the rationale behind it.",
      title: "Review the data",
    },
    {
      detail:
        "Use suggested follow-up as a starting point for interpreting findings and considering next steps with local context.",
      title: "Identify follow-up actions",
    },
    {
      detail:
        "Compare two counties side by side, or download an available county PDF to support public health review and planning.",
      title: "Compare and share findings",
    },
  ],
  title: "County review in One Health Atlas",
} as const;

export const FRONT_PORCH_FINALE = {
  eyebrow: "Continue exploring",
  lines: ["One place to see", "the bigger picture."] as const,
  paragraph:
    "Explore county-level Lyme disease data, review the findings in context, and consider questions for local follow-up. One Health Atlas brings the sources together to support informed public health review.",
  title: "One place to see the bigger picture.",
} as const;

export const FRONT_PORCH_DISCLOSURE_LABEL = "Sources and interpretation";

export type FrontPorchSourceLink = {
  href: string;
  label: string;
};

export type FrontPorchCardLine = {
  highlight?: boolean;
  italicLead?: string;
  text: string;
  tone: "finding" | "period" | "purpose";
};

export type FrontPorchBeat = {
  body: string;
  cardLines: readonly FrontPorchCardLine[];
  cardTitle: string;
  caveat: string;
  id: string;
  kicker: string;
  mobileLabel: string;
  paragraphs: readonly string[];
  sourceDetail: readonly string[];
  sourceLinks: readonly FrontPorchSourceLink[];
  status: string;
  title: string;
};

export const FRONT_PORCH_STAGE_HEADER = "ATLAS / ILLUSTRATIVE WALKTHROUGH";

export const FRONT_PORCH_STAGE_NOTE =
  "Markers illustrate data perspectives, not case or sampling locations.";

export const FRONT_PORCH_STAGE_INTERPRET =
  "Interpret data in light of their source, location, and time period.";

/**
 * Three steps share one pinned county panel.
 * The county drawing and its dots stay illustrative.
 * The card text uses the verified Montgomery County snapshot.
 */
export const FRONT_PORCH_BEATS: readonly FrontPorchBeat[] = [
  {
    body: "Reported Lyme disease cases reflect illness diagnosed among county residents and captured by public health surveillance. These records help describe the reported burden of disease.",
    cardLines: [
      {
        text: "Reported cases provide a starting point for review.",
        tone: "purpose",
      },
      {
        highlight: true,
        text: "At least 71 reported probable cases",
        tone: "finding",
      },
      { text: "Lyme disease · 2023", tone: "period" },
    ],
    cardTitle: "Human disease surveillance",
    caveat:
      "Surveillance records do not capture every infection. Cases are reported by county of residence, which may differ from where exposure occurred.",
    id: "human-surveillance",
    kicker: "01 / The first signal",
    mobileLabel: "Human disease surveillance",
    paragraphs: [
      "Reported Lyme disease cases reflect illness diagnosed among county residents and captured by public health surveillance. These records help describe the reported burden of disease.",
      "Surveillance records do not capture every infection. Cases are reported by county of residence, which may differ from where exposure occurred.",
    ],
    sourceDetail: FRONT_PORCH_HUMAN_OBSERVATION.paragraphs,
    sourceLinks: FRONT_PORCH_HUMAN_OBSERVATION.links,
    status: "Human data",
    title: "Start with reported Lyme disease.",
  },
  {
    body: "Tick surveillance helps establish which tick species have been found in a county. Testing collected ticks can also identify pathogens they carry. Together, these findings add another perspective to the human case record.",
    cardLines: [
      {
        text: "Tick observations and testing add another perspective.",
        tone: "purpose",
      },
      {
        italicLead: "Ixodes scapularis",
        text: ": Established",
        tone: "finding",
      },
      {
        italicLead: "Borrelia burgdorferi",
        text: ": Present",
        tone: "finding",
      },
      { text: "Cumulative records through December 2025", tone: "period" },
    ],
    cardTitle: "Tick and pathogen surveillance",
    caveat:
      "Where, when, and how ticks were sampled shapes what the results can tell us. Missing records do not establish absence.",
    id: "vector-pathogen",
    kicker: "02 / The vector view",
    mobileLabel: "Tick and pathogen surveillance",
    paragraphs: [
      "Tick surveillance helps establish which tick species have been found in a county. Testing collected ticks can also identify pathogens they carry. Together, these findings add another perspective to the human case record.",
      "Where, when, and how ticks were sampled shapes what the results can tell us. Missing records do not establish absence.",
    ],
    sourceDetail: FRONT_PORCH_VECTOR_OBSERVATION.paragraphs,
    sourceLinks: FRONT_PORCH_VECTOR_OBSERVATION.links,
    status: "Vector data",
    title: "Add tick and pathogen data.",
  },
  {
    body: "Surveillance findings are part of a larger community picture. One Health Atlas brings insurance coverage, social vulnerability, and rural-urban classification alongside human and tick surveillance. Viewing these data together helps public health professionals ask more informed questions about local needs and potential barriers to care.",
    cardLines: [
      {
        text: "Community conditions help frame local public health questions.",
        tone: "purpose",
      },
      { highlight: true, text: "5.3% uninsured", tone: "finding" },
      { text: "CDC/ATSDR SVI · 2018\u20132022 ACS", tone: "period" },
    ],
    cardTitle: "Community context",
    caveat:
      "Insurance coverage describes one aspect of healthcare access. These county-level measures do not establish underdiagnosis or underreporting, or determine an individual’s risk.",
    id: "community-context",
    kicker: "03 / The shared context",
    mobileLabel: "Community context",
    paragraphs: [
      "Surveillance findings are part of a larger community picture. One Health Atlas brings insurance coverage, social vulnerability, and rural-urban classification alongside human and tick surveillance. Viewing these data together helps public health professionals ask more informed questions about local needs and potential barriers to care.",
      "Insurance coverage describes one aspect of healthcare access. These county-level measures do not establish underdiagnosis or underreporting, or determine an individual’s risk.",
    ],
    sourceDetail: FRONT_PORCH_CONTEXT_OBSERVATION.paragraphs,
    sourceLinks: FRONT_PORCH_CONTEXT_OBSERVATION.links,
    status: "One Health view",
    title: "Place the data in context.",
  },
];

export function frontPorchExploreHref(signedIn: boolean): string {
  if (signedIn) {
    return ATLAS_EXPLORER_PATH;
  }
  return signInHrefForReturnPath(ATLAS_EXPLORER_PATH);
}

const FRONT_PORCH_UNRELATED_COUNTY_PATTERN = /buncombe|37021|alaska|hawaii/i;

export function frontPorchExploreHrefSelectsCounty(href: string): boolean {
  return /county=|fips=|51121|montgomery/i.test(href);
}

export function frontPorchHrefSelectsUnrelatedCounty(href: string): boolean {
  return FRONT_PORCH_UNRELATED_COUNTY_PATTERN.test(href);
}
