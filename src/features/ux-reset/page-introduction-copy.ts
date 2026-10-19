/**
 * Product-owner copy for Atlas Explorer and Compare.
 * Explorer introduction copy was approved October 19, 2026.
 * The optional secondary eyebrow is omitted so the banner stays compact.
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
    headline: "Explore potential Lyme surveillance gaps",
    scoreBody:
      "The Gap Score (0–100) helps prioritize counties for review. Higher scores indicate a stronger combination of data signals suggesting a possible surveillance gap—not necessarily more Lyme disease or greater personal risk.",
    scoreHeading: "What does the Gap Score mean?",
    supporting:
      "The Atlas highlights counties where reported Lyme disease cases may not align with tick, pathogen, and community data. Explore these patterns to help identify where additional public health review may be useful.",
  },
} as const;

export const EXPLORER_MAP_SECTION_HEADING = "Explore county patterns";

export type PageIntroductionId = keyof typeof PAGE_INTRODUCTION_COPY;
