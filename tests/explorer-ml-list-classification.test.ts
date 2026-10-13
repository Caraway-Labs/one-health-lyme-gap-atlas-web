import { describe, expect, it } from "vitest";

import { isLower48CountyFips } from "@/features/ux-reset/review/review-state-fips";
import {
  EXPLORER_ML_PRIORITY_LEGEND,
  EXPLORER_ML_PRIORITY_LOADING_LABEL,
  EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
  explorerMlListClassification,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "./fixtures/tier1-surveillance-priority";

const alignedRelease: Tier1ActiveRelease = {
  releaseId: tier1HighSufficientFixture.release_id,
  status: "ready",
};

function classify(
  result: Tier1CountyPriority | null,
  input?: {
    errorStatus?: number | null;
    fips?: string;
    inLower48?: boolean;
    release?: Tier1ActiveRelease;
    status?: "error" | "loading" | "success";
  }
) {
  const fips = input?.fips ?? result?.county_fips ?? "01001";
  return explorerMlListClassification({
    errorStatus: input?.errorStatus ?? null,
    inLower48: input?.inLower48 ?? isLower48CountyFips(fips),
    release: input?.release ?? alignedRelease,
    requestedFips: fips,
    result,
    status: input?.status ?? "success",
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

  it("keeps a null tier as Not available", () => {
    const notEstimable: Tier1CountyPriority = {
      ...tier1HighSufficientFixture,
      evidence_sufficiency: "NOT_ESTIMABLE",
      priority_percentile: null,
      priority_tier: null,
      raw_model_score: null,
      reasons: [],
    };
    const label = classify(notEstimable).label;
    expect(label).toBe(EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL);
    expect(label).not.toBe("LOW");
  });

  it("does not recode a missing or failed result as LOW", () => {
    expect({
      failed: classify(null, { errorStatus: 503, status: "error" }).label,
      missing: classify(null, { errorStatus: 404, status: "error" }).label,
      stale: classify(
        tier1PriorityForCounty(tier1HighSufficientFixture, "01003"),
        {
          fips: "01001",
        }
      ).label,
    }).toStrictEqual({
      failed: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      missing: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
      stale: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
    });
  });

  it("withholds a tier from a different release", () => {
    const otherRelease = tier1PriorityForRelease(
      tier1HighSufficientFixture,
      "governed-2026-10-06-nlcd-demo-cohort"
    );
    expect(classify(otherRelease).label).toBe(
      EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL
    );
  });

  it("shows Loading only while the release or request is unresolved", () => {
    expect({
      pendingRelease: classify(tier1HighSufficientFixture, {
        release: { status: "pending" },
      }).label,
      request: classify(null, { status: "loading" }).label,
      unknownRelease: classify(tier1HighSufficientFixture, {
        release: { status: "unknown" },
      }).label,
    }).toStrictEqual({
      pendingRelease: EXPLORER_ML_PRIORITY_LOADING_LABEL,
      request: EXPLORER_ML_PRIORITY_LOADING_LABEL,
      unknownRelease: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
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
