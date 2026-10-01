import { describe, expect, it } from "vitest";

import { atlasReleaseEducationContent } from "@/lib/atlas-release-education-content";

describe("atlas release education content", () => {
  it("records public-health owner review metadata", () => {
    expect(atlasReleaseEducationContent.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(atlasReleaseEducationContent.lastUpdated).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
    expect(atlasReleaseEducationContent.ownerReview.recordedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
    expect(
      atlasReleaseEducationContent.ownerReview.reviewers.length
    ).toBeGreaterThan(0);
    expect(atlasReleaseEducationContent.ownerReview.trackingIssue).toBe("336");
  });

  it("names the timing labels users see in the evidence snapshot", () => {
    const terms = atlasReleaseEducationContent.releaseSemantics.map(
      (entry) => entry.term
    );
    expect(terms).toContain("Source periods");
    expect(terms).toContain("Release generated");
    expect(terms).toContain("Release loaded");
    expect(terms).toContain("Scoring methodology");
  });

  it("keeps surveillance and unavailable language in definitions", () => {
    const combined = atlasReleaseEducationContent.releaseSemantics
      .map((entry) => entry.definition)
      .join(" ");
    expect(combined).toMatch(/not.*surveillance observation/i);
    expect(combined).toMatch(/Unavailable/);
  });

  it("describes scoring without predictive or clinical claims", () => {
    const explainer = atlasReleaseEducationContent.methodologyExplainer.sections
      .map((section) => section.body)
      .join(" ");
    expect(explainer).toMatch(/not a diagnosis/i);
    expect(explainer).toMatch(/Unavailable/);
  });
});
