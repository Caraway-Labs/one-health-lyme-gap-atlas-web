import type { Tier1CountyPriority } from "@/generated/models";

/**
 * Production `GET /v1/counties/{fips}/tier1-surveillance-priority` bodies
 * captured from https://api.carawaylabs.com on 2026-10-08. Tests reuse these
 * returned values and do not derive tiers, percentiles, or reasons.
 */
const productionBatch = {
  generated_at_utc: "2026-10-07T02:14:24Z",
  limitation_ref: "docs/contracts/tier1-persisted-output-v1.md",
  model_version: "tier1-statistical-reference-v1",
  prediction_batch_version: "tier1-review-priority-5536b5caad95cf47",
  release_id: "governed-2026-09-18-unknown-coverage",
  source_commit: "024bbbf74a7da8e54566bd60e8e762d85a51e24f",
  tier_policy_version: "tier1-review-percentile-v1",
} as const;

export const tier1HighSufficientFixture: Tier1CountyPriority = {
  ...productionBatch,
  county_fips: "09110",
  evidence_sufficiency: "SUFFICIENT",
  priority_percentile: 98.56824689786828,
  priority_tier: "HIGH",
  raw_model_score: 2.0739835966635036,
  reasons: [
    {
      code: "PUBLISHED_HUMAN_FLOOR",
      text: "Published county-linked human count-floor signal is present; its magnitude is a lower bound.",
    },
    {
      code: "PATHOGEN_PRESENT",
      text: "Publisher reports pathogen Present.",
    },
  ],
};

export const tier1MediumSufficientFixture: Tier1CountyPriority = {
  ...productionBatch,
  county_fips: "01003",
  evidence_sufficiency: "SUFFICIENT",
  priority_percentile: 75.94654788418708,
  priority_tier: "MEDIUM",
  raw_model_score: 1.0870527819718128,
  reasons: [
    {
      code: "PUBLISHED_HUMAN_FLOOR",
      text: "Published county-linked human count-floor signal is present; its magnitude is a lower bound.",
    },
    {
      code: "PATHOGEN_NO_RECORDS",
      text: "Publisher reports No records; this is not evidence of absence.",
    },
  ],
};

export const tier1LowInsufficientFixture: Tier1CountyPriority = {
  ...productionBatch,
  county_fips: "01001",
  evidence_sufficiency: "INSUFFICIENT",
  priority_percentile: 30.734966592427615,
  priority_tier: "LOW",
  raw_model_score: 0.6000441944790827,
  reasons: [
    {
      code: "NO_COUNTY_HUMAN_RECORD",
      text: "No county-linked human record is available; the model uses an explicit placeholder.",
    },
    {
      code: "PATHOGEN_NO_RECORDS",
      text: "Publisher reports No records; this is not evidence of absence.",
    },
  ],
};

export function tier1PriorityForCounty(
  result: Tier1CountyPriority,
  countyFips: string
): Tier1CountyPriority {
  return { ...result, county_fips: countyFips };
}
