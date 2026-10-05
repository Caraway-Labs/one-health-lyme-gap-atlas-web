import { describe, expect, it } from "vitest";

import {
  AI_RESPONSIBLE_USE_PATH,
  capabilityClaims,
  capabilityMaturities,
  documentationLinks,
  governanceBoundaries,
  maturityLabel,
  workKinds,
} from "../src/features/ux-reset/ai-responsible-use/content";
import { UX_RESET_DESTINATION_IDS } from "../src/features/ux-reset/routes";

describe("AI / Responsible Use content", () => {
  it("keeps the trust page on the authenticated route without making it a workspace destination", () => {
    expect(AI_RESPONSIBLE_USE_PATH).toBe("/app/ai-responsible-use");
    expect(UX_RESET_DESTINATION_IDS).not.toContain("ai-responsible-use");
  });

  it("uses the four maturity categories and records a support citation for each claim", () => {
    const used = new Set(capabilityClaims.map((claim) => claim.maturity));
    expect([...used].sort()).toStrictEqual([...capabilityMaturities].sort());
    expect(
      capabilityClaims.every(
        (claim) =>
          claim.support.trim().length > 20 &&
          claim.statusBasis.trim().length > 20 &&
          maturityLabel(claim.maturity) !== "Available"
      )
    ).toBeTruthy();
  });

  it("records governance support separately from evidence availability", () => {
    expect(governanceBoundaries.maturity).toBe("current");
    expect(governanceBoundaries.support).toContain("issue 432");
  });

  it("keeps modeled forecasts, mixed Ask Atlas, and dataset approval off the current list", () => {
    const currentTitles = capabilityClaims
      .filter((claim) => claim.maturity === "current")
      .map((claim) => claim.title);
    expect(currentTitles).toStrictEqual(["County review priority"]);
    expect(
      capabilityClaims.find((claim) => claim.id === "ask-atlas-literature")
    ).toMatchObject({
      maturity: "experimental",
    });
    expect(
      capabilityClaims.find((claim) => claim.id === "ask-atlas-literature")
        ?.boundary
    ).toMatch(/no Structured mode/i);
    expect(
      capabilityClaims.find((claim) => claim.id === "ask-atlas-structured")
        ?.maturity
    ).toBe("planned");
    expect(
      capabilityClaims.find((claim) => claim.id === "ml-prioritization")
        ?.maturity
    ).toBe("planned");
  });

  it("keeps dataset discovery as in-development human review", () => {
    const discovery = capabilityClaims.find(
      (claim) => claim.id === "dataset-discovery"
    );
    expect(discovery?.maturity).toBe("in-development");
    expect(discovery?.boundary).toMatch(/investigate this source/i);
    expect(discovery?.boundary).toMatch(/does not approve the source/i);
  });

  it("distinguishes observed, derived, modeled, AI-generated, and human-reviewed work", () => {
    expect(workKinds.map((kind) => kind.term)).toStrictEqual([
      "Observed",
      "Derived",
      "Modeled",
      "AI-generated",
      "Human-reviewed",
    ]);
  });

  it("links to existing Docs and preserves the public AI Ethics route", () => {
    const hrefs = documentationLinks.map((link) => link.href);
    expect(hrefs).toContain("/docs/ai-enabled-decision-intelligence");
    expect(hrefs).toContain("/docs/evidence-and-uncertainty");
    expect(hrefs).toContain("/ai-ethics");
    expect(hrefs).not.toContain("/app/ai-responsible-use");
  });
});
