/**
 * Product-owner copy for Atlas Explorer and Compare, approved October 12, 2026.
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
    headline: "Explore the evidence behind every county.",
    stripBody:
      "Atlas brings human, tick, and environmental evidence into one view to support public health surveillance—not to predict personal disease risk.",
    stripHeading: "From data to better decisions",
    supporting:
      "Discover geographic patterns, investigate available surveillance data, and understand where the evidence is strong, limited, or missing.",
  },
} as const;

export type PageIntroductionId = keyof typeof PAGE_INTRODUCTION_COPY;
