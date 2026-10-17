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
  "Human health, vectors, and environmental conditions each reveal part of the picture. One Health Atlas helps public health professionals connect those perspectives and decide what deserves a closer look.";

export const FRONT_PORCH_HERO_EXAMPLE =
  "Follow the Lyme disease example in Montgomery County, Virginia.";

export const FRONT_PORCH_GLASS_CALLOUT = "Human health + Vectors + Environment";

export const FRONT_PORCH_FOLLOW_STORY_LABEL = "Follow the story";

export const FRONT_PORCH_STORY_ID = "front-porch-story";

export const FRONT_PORCH_EXPLORE_LABEL = "Explore counties like this in Atlas";

export const FRONT_PORCH_EXPLORE_SUPPORT =
  "Built for public health professionals.";

/** Owner-approved transparent ecosystem illustration (Web issues 478 / 475). */
export const FRONT_PORCH_HERO_IMAGE = {
  approved: true,
  src: "/images/one-health-ecosystem.png",
} as const;

/**
 * Anonymous-safe trust links for `/` (issue 534).
 * Production returns 200 for `/privacy` and `/ai-ethics`.
 * `/app/ai-responsible-use` and `/app/settings` return 307 to sign-in, and
 * Settings has no analytics consent control until issues 427 and 527. Privacy settings
 * stays the shared PrivacyPreferences dialog. Methodology and evidence docs stay
 * on Resources, not in this footer.
 */
export const FRONT_PORCH_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/ai-ethics", label: "AI / Responsible Use" },
] as const;

export const FRONT_PORCH_INTRO = {
  eyebrow: "The question worth asking",
  paragraph:
    "Reported Lyme cases show part of the picture. Tick surveillance, environmental data, and community context add other perspectives. Follow the Montgomery County example to see what becomes clearer—and what questions remain.",
  title: "What can we learn by looking at the data together?",
} as const;

export const FRONT_PORCH_TRUST_ID = "front-porch-trust";

export const FRONT_PORCH_TRUST_PANEL_LABEL = "Know what you're looking at";

export const FRONT_PORCH_TRUST = {
  eyebrow: "Confidence through clarity",
  paragraph:
    "Understanding a dataset means knowing where it came from, when it was collected, and what it can tell us. Atlas brings sources, coverage, and limitations into view so public health professionals can interpret the data in context.",
  title: "What's missing from the data matters, too.",
} as const;

export const FRONT_PORCH_TRUST_LINES = [
  {
    label: "Source",
    detail: "See where the data came from",
  },
  {
    label: "Time period",
    detail: "Know when the data were collected or reported",
  },
  {
    label: "Coverage",
    detail: "See where data are available and where gaps remain",
  },
  {
    label: "Limitations",
    detail: "Understand what the data can and cannot tell you",
  },
] as const;

export const FRONT_PORCH_FINALE = {
  eyebrow: "Continue exploring",
  paragraph:
    "Bring human surveillance, tick and pathogen data, and environmental and community context together. Explore county patterns, review the available data, and identify questions for follow-up.",
  title: "One place to see the bigger picture.",
} as const;

export type FrontPorchBeat = {
  body: string;
  cardDetail: string;
  cardTitle: string;
  caveat: string;
  id: string;
  kicker: string;
  mobileLabel: string;
  paragraphs: readonly string[];
  status: string;
  title: string;
};

export const FRONT_PORCH_STAGE_HEADER = "ATLAS / DATA VIEW";

export const FRONT_PORCH_STAGE_NOTE =
  "Interpret data in light of their source, location, and time period.";

/**
 * Three steps share one pinned county panel.
 * The county drawing and its dots are illustrative, not sampling locations.
 * Montgomery County is the named example, not a selected explore target.
 */
export const FRONT_PORCH_BEATS: readonly FrontPorchBeat[] = [
  {
    body: "Reported Lyme disease cases show where illness was recognized and recorded. They provide a starting point for understanding the county, while leaving questions about infections that were not reported and where exposure occurred.",
    cardDetail: "Reported cases provide a starting point for review.",
    cardTitle: "Human disease surveillance",
    caveat:
      "Cases are reported by county of residence, which may differ from where exposure occurred.",
    id: "human-surveillance",
    kicker: "01 / The first signal",
    mobileLabel: "Human surveillance",
    paragraphs: [
      "Reported Lyme disease cases show where illness was recognized and recorded. They provide a starting point for understanding the county, while leaving questions about infections that were not reported and where exposure occurred.",
      "Cases are reported by county of residence, which may differ from where exposure occurred.",
    ],
    status: "Human data",
    title: "Start with reported human illness.",
  },
  {
    body: "Tick surveillance records where ticks have been found. Pathogen testing adds information about what was detected in the samples tested. Together, these data add another perspective to the human case record.",
    cardDetail: "Tick observations and testing add another perspective.",
    cardTitle: "Tick and pathogen surveillance",
    caveat:
      "Where, when, and how ticks were sampled shapes what the results can tell us.",
    id: "vector-pathogen",
    kicker: "02 / The vector view",
    mobileLabel: "Tick and pathogen evidence",
    paragraphs: [
      "Tick surveillance records where ticks have been found. Pathogen testing adds information about what was detected in the samples tested. Together, these data add another perspective to the human case record.",
      "Where, when, and how ticks were sampled shapes what the results can tell us.",
    ],
    status: "Vector data",
    title: "Add tick and pathogen data.",
  },
  {
    body: "Landscape, weather, and community conditions—including access to care—help frame the picture. Considering these alongside human and tick data brings the One Health approach into public health review.",
    cardDetail: "Local conditions help frame public health questions.",
    cardTitle: "Environmental and community context",
    caveat:
      "County-level patterns do not establish individual risk or show that one condition caused another.",
    id: "environment-community",
    kicker: "03 / The shared context",
    mobileLabel: "A One Health perspective",
    paragraphs: [
      "Landscape, weather, and community conditions—including access to care—help frame the picture. Considering these alongside human and tick data brings the One Health approach into public health review.",
      "County-level patterns do not establish individual risk or show that one condition caused another.",
    ],
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

const FRONT_PORCH_FORBIDDEN_HREF_PATTERN =
  /buncombe|montgomery|37021|51121|alaska|hawaii|county=|fips=/i;

export function frontPorchExploreHrefSelectsCounty(href: string): boolean {
  return FRONT_PORCH_FORBIDDEN_HREF_PATTERN.test(href);
}
