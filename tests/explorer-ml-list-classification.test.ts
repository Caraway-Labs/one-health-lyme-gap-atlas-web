import { describe, expect, it } from "vitest";

import { isLower48CountyFips } from "@/features/ux-reset/review/review-state-fips";
import {
  EXPLORER_ML_PRIORITY_FAILED_LABEL,
  EXPLORER_ML_PRIORITY_LEGEND,
  EXPLORER_ML_PRIORITY_LOADING_LABEL,
  EXPLORER_ML_PRIORITY_NOT_ESTIMABLE_LABEL,
  EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
  EXPLORER_ML_PRIORITY_UNVERIFIED_LABEL,
  explorerMlListClassification,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import type { Tier1CountyPriority } from "@/generated/models";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

function classify(
  result: Tier1CountyPriority | null,
  input?: {
    errorStatus?: number | null;
    fips?: string;
    inLower48?: boolean;
    status?: "error" | "loading" | "success";
    unverified?: boolean;
  }
) {
  const fips = input?.fips ?? result?.county_fips ?? "01001";
  return explorerMlListClassification({
    errorStatus: input?.errorStatus ?? null,
    inLower48: input?.inLower48 ?? isLower48CountyFips(fips),
    requestedFips: fips,
    result,
    status: input?.status ?? "success",
    unverified: input?.unverified,
  });
}

describe("Explorer county list ML classification", () => {
  it("uses the returned HIGH, MEDIUM, and LOW labels", () => {
    expect({
      high: classify(tier1HighSufficientFixture).label,
      low: classify(tier1LowInsufficientFixture).label,
      medium: classify(tier1MediumSufficientFixture).label,
    }).toStrictEqual({
      high: "HIGH",
      low: "LOW",
      medium: "MEDIUM",
    });
  });

  it("labels NOT_ESTIMABLE as Not estimable", () => {
    const notEstimable: Tier1CountyPriority = {
      ...tier1HighSufficientFixture,
      evidence_sufficiency: "NOT_ESTIMABLE",
      priority_percentile: null,
      priority_tier: null,
      raw_model_score: null,
      reasons: [],
    };
    const label = classify(notEstimable).label;
    expect(label).toBe(EXPLORER_ML_PRIORITY_NOT_ESTIMABLE_LABEL);
    expect(label).not.toBe("LOW");
    expect(label).not.toBe(EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL);
  });

  it("keeps a missing result Not available and a failed request Could not load", () => {
    const incoherent: Tier1CountyPriority = {
      ...tier1HighSufficientFixture,
      priority_percentile: null,
      priority_tier: null,
      raw_model_score: null,
    };
    expect({
      incoherent: classify(incoherent).label,
      missing: classify(null, { errorStatus: 404, status: "error" }).label,
      network: classify(null, { errorStatus: null, status: "error" }).label,
      rateLimit: classify(null, { errorStatus: 429, status: "error" }).label,
      stale: classify(
        tier1PriorityForCounty(tier1HighSufficientFixture, "01003"),
        {
          fips: "01001",
        }
      ).label,
      unavailableService: classify(null, { errorStatus: 503, status: "error" })
        .label,
    }).toStrictEqual({
      incoherent: EXPLORER_ML_PRIORITY_UNVERIFIED_LABEL,
      missing: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      network: EXPLORER_ML_PRIORITY_FAILED_LABEL,
      rateLimit: EXPLORER_ML_PRIORITY_FAILED_LABEL,
      stale: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      unavailableService: EXPLORER_ML_PRIORITY_FAILED_LABEL,
    });
    expect(
      classify(null, { errorStatus: 503, status: "error" }).label
    ).not.toBe("LOW");
    expect(classify(null, { errorStatus: 503, status: "error" }).tier).toBe(
      "failed"
    );
  });

  it("shows a tier whose model release differs from the page release", () => {
    expect(classify(tier1HighSufficientFixture).label).toBe("HIGH");
  });

  it("shows Loading only while the request is unresolved", () => {
    expect({
      request: classify(null, { status: "loading" }).label,
      retryAfter: classify(null, { errorStatus: 429, status: "loading" }).label,
      returned: classify(tier1HighSufficientFixture).label,
    }).toStrictEqual({
      request: EXPLORER_ML_PRIORITY_LOADING_LABEL,
      retryAfter: EXPLORER_ML_PRIORITY_LOADING_LABEL,
      returned: "HIGH",
    });
  });

  it("does not classify Alaska, Hawaii, or a territory", () => {
    expect({
      alaska: classify(
        tier1PriorityForCounty(tier1MediumSufficientFixture, "02013"),
        {
          fips: "02013",
        }
      ).label,
      dc: classify(tier1PriorityForCounty(tier1HighSufficientFixture, "11001"))
        .label,
      hawaii: classify(
        tier1PriorityForCounty(tier1HighSufficientFixture, "15001"),
        { fips: "15001" }
      ).label,
      puertoRico: isLower48CountyFips("72001"),
    }).toStrictEqual({
      alaska: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      dc: "HIGH",
      hawaii: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      puertoRico: false,
    });
  });

  it("keeps the surveillance-priority legend wording", () => {
    expect(EXPLORER_ML_PRIORITY_LEGEND).toBe(
      "ML surveillance priority — counties flagged for review, not personal Lyme disease risk"
    );
  });
});
