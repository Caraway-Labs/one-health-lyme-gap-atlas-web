import { RESET_REVIEW_PATH } from "@/features/ux-reset/routes";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

export const FRONT_PORCH_HERO_HEADLINE =
  "The data is telling more than one story.";

export const FRONT_PORCH_HERO_SUPPORT =
  "Human health, vectors, and environmental conditions each reveal part of the picture. One Health Atlas helps epidemiologists connect those perspectives and decide what deserves a closer look.";

export const FRONT_PORCH_GLASS_CALLOUT = "Human health + Vectors + Environment";

export const FRONT_PORCH_FOLLOW_STORY_LABEL = "Follow the story";

export const FRONT_PORCH_STORY_ID = "front-porch-story";

export const FRONT_PORCH_EXPLORE_LABEL = "Explore counties like this in Atlas";

export const FRONT_PORCH_EXPLORE_SUPPORT =
  "Built for public-health epidemiologists";

/** Owner-approved transparent ecosystem illustration (Web issues 478 / 475). */
export const FRONT_PORCH_HERO_IMAGE = {
  approved: true,
  src: "/images/one-health-ecosystem.png",
} as const;

export const FRONT_PORCH_METHODOLOGY_HREF = "/docs/releases-and-methodology";

export const FRONT_PORCH_EVIDENCE_HREF = "/docs/evidence-and-uncertainty";

export const FRONT_PORCH_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/ai-ethics", label: "AI Ethics" },
  { href: FRONT_PORCH_METHODOLOGY_HREF, label: "Methodology" },
  { href: FRONT_PORCH_EVIDENCE_HREF, label: "Evidence and uncertainty" },
] as const;

export type FrontPorchBeat = {
  id: string;
  paragraphs: readonly string[];
  title: string;
};

export const FRONT_PORCH_BEATS: readonly FrontPorchBeat[] = [
  {
    id: "question",
    paragraphs: [
      "Reported illness, tick observations, and environmental conditions can point in different directions.",
      "That difference is a reason for a closer look. It does not, by itself, show underreporting, local transmission, or personal risk.",
    ],
    title:
      "When human cases, tick data, and environmental signals do not line up, what should public health do?",
  },
  {
    id: "human-surveillance",
    paragraphs: [
      "Reported Lyme disease cases show where illness was recognized and recorded.",
      "They do not show every infection, where exposure happened, or that a place without reports is free of disease.",
      "A missing report is not a count of zero.",
    ],
    title: "Reported cases show part of the human signal",
  },
  {
    id: "vector-pathogen",
    paragraphs: [
      "Tick observations record where vectors have been found. Pathogen testing, when a program has done it, records what was detected in the samples that were tested.",
      "Finding a tick is not the same as finding a pathogen. Neither result on its own shows that a pathogen is established or that people are being infected locally.",
    ],
    title: "Ticks and pathogens answer different questions",
  },
  {
    id: "environment-community",
    paragraphs: [
      "Landscape, season, and access to care describe the setting around human and vector signals. They are context, not proof that one condition caused another.",
      "One Health is the practice of reading human health, vectors, and the environment together.",
    ],
    title: "Place and community fill in the setting",
  },
  {
    id: "sources-limits",
    paragraphs: [
      "The streams Atlas is meant to hold — published human surveillance, tick and pathogen observations, and community context — each come from their own source, place, and time window.",
      "This introduction does not state a year, a count, or a coverage rate. Unknown is not zero.",
      "A pattern is a reason to inspect the source, not a forecast or a finding that one thing caused another.",
    ],
    title: "Every stream has a source and a limit",
  },
  {
    id: "atlas",
    paragraphs: [
      "Atlas is where those streams can be inspected together before deciding what deserves a closer look.",
      "The professional workspace is for public-health epidemiologists doing that review. It does not turn disagreement between streams into a risk score or an outbreak call.",
    ],
    title: "Look across the streams, then decide where to look closer",
  },
];

export function frontPorchExploreHref(signedIn: boolean): string {
  if (signedIn) {
    return RESET_REVIEW_PATH;
  }
  return signInHrefForReturnPath(RESET_REVIEW_PATH);
}

const FRONT_PORCH_FORBIDDEN_HREF_PATTERN =
  /buncombe|37021|alaska|hawaii|county=|fips=/i;

export function frontPorchExploreHrefSelectsCounty(href: string): boolean {
  return FRONT_PORCH_FORBIDDEN_HREF_PATTERN.test(href);
}
