/**
 * Product-owner copy for Atlas Explorer and Compare.
 * Explorer introduction copy follows the October 19, 2026 design revision.
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
    eyebrow: "ONE HEALTH LYME GAP ATLAS",
    headline: "Explore county Lyme data",
    helper: "Choose a state, search for a county, or select one on the map.",
    scoreBody:
      "The Gap review score (0–100) helps prioritize counties for closer review. Higher scores indicate higher review priority.",
    scoreHeading: "What does the score mean?",
    scoreQualifier:
      "It does not confirm a surveillance gap or measure personal Lyme disease risk.",
    supporting:
      "Compare reported Lyme disease, tick and pathogen data, and community context to identify patterns that may warrant closer review.",
  },
} as const;

export const EXPLORER_MAP_SECTION_HEADING = "Explore county patterns";

export type PageIntroductionId = keyof typeof PAGE_INTRODUCTION_COPY;
