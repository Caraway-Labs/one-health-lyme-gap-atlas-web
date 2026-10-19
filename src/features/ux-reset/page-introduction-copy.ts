/**
 * Product-owner copy for Atlas Explorer and Compare.
 * Explorer welcome copy was approved October 17, 2026.
 * Compare keeps the heading and one supporting sentence visible.
 * The reporting-context sentence stays in the release disclosure.
 * Ask Atlas, Feed, Settings, and Docs do not use a page introduction.
 */
export const PAGE_INTRODUCTION_COPY = {
  compare: {
    headline: "Two counties. A clearer picture.",
    stripBody:
      "Differences in reporting, coverage, and data availability can affect comparisons. Atlas makes these limitations visible alongside the evidence.",
    stripHeading: "Compare with context",
    supporting:
      "Compare surveillance evidence across counties to uncover meaningful differences, shared patterns, and gaps in what we know.",
  },
  explorer: {
    guidance:
      "Choose a state, search for a county, or select one on the map to explore the evidence, identify gaps, and see suggested follow-up.",
    guidanceLead: "Get started:",
    headline: "Explore the One Health Atlas",
    supporting:
      "Discover patterns in reported Lyme disease, tick and pathogen surveillance, and community context across U.S. counties.",
  },
} as const;

export const EXPLORER_MAP_SECTION_HEADING = "Explore county patterns";

export type PageIntroductionId = keyof typeof PAGE_INTRODUCTION_COPY;
