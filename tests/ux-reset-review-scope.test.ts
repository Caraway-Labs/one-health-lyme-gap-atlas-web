import { describe, expect, it } from "vitest";

import { buildReviewScopePresentation } from "@/features/ux-reset/review/build-review-presentation";
import {
  hasExplicitReviewScopeParam,
  resolveStartingReviewScope,
  reviewScopeMatchesPresentation,
} from "@/features/ux-reset/review/resolve-review-scope";
import type { CountyScoreSummary } from "@/generated/models";

const stateOptions = [
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
];

function county(
  fips: string,
  state: string,
  score: number
): CountyScoreSummary {
  return {
    burgdorferi_status: "observed",
    color: "#ccc",
    county: `County ${fips}`,
    evidence_completeness: 50,
    fips,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state,
    state_name: state,
    tick_status: "observed",
  };
}

describe("Review scope resolution", () => {
  it("treats an explicit scope query param as authoritative over profile default", () => {
    expect(
      resolveStartingReviewScope(true, "NY", "CO", stateOptions)
    ).toBe("NY");
  });

  it("applies profile default when scope is omitted from the URL", () => {
    expect(
      resolveStartingReviewScope(false, "ALL", "CO", stateOptions)
    ).toBe("CO");
  });

  it("falls back to national scope when profile default is missing or invalid", () => {
    expect(
      resolveStartingReviewScope(false, "ALL", null, stateOptions)
    ).toBe("ALL");
    expect(
      resolveStartingReviewScope(false, "ALL", "ZZ", stateOptions)
    ).toBe("ALL");
  });

  it("detects explicit scope params", () => {
    expect(
      hasExplicitReviewScopeParam(new URLSearchParams("scope=CO"))
    ).toBe(true);
    expect(hasExplicitReviewScopeParam(new URLSearchParams())).toBe(false);
  });
});

describe("Review scope presentation", () => {
  it("builds state orientation rows for national scope without a county leaderboard", () => {
    const presentation = buildReviewScopePresentation("ALL", [
      county("08001", "CO", 90),
      county("08013", "CO", 70),
      county("36001", "NY", 80),
    ]);
    expect(presentation.scope).toBe("ALL");
    expect(presentation.stateCounties).toHaveLength(0);
    expect(presentation.orientationRows).toEqual([
      {
        code: "CO",
        countyCount: 2,
        topPriorityLabel: "Priority 3 — Review",
      },
      {
        code: "NY",
        countyCount: 1,
        topPriorityLabel: "Priority 3 — Review",
      },
    ]);
  });

  it("filters ranked counties for state scope", () => {
    const presentation = buildReviewScopePresentation("CO", [
      county("08001", "CO", 90),
      county("36001", "NY", 80),
    ]);
    expect(presentation.stateCounties.map((entry) => entry.fips)).toEqual([
      "08001",
    ]);
  });

  it("guards rendered presentation against scope drift", () => {
    expect(reviewScopeMatchesPresentation("CO", "CO")).toBe(true);
    expect(reviewScopeMatchesPresentation("CO", "NY")).toBe(false);
    expect(reviewScopeMatchesPresentation("CO", undefined)).toBe(false);
  });
});

describe("Review scope generation guard", () => {
  it("drops late microtasks for a previous scope", async () => {
    let generation = 0;
    const rendered: string[] = [];
    const schedule = (scope: string) => {
      const token = ++generation;
      queueMicrotask(() => {
        if (token === generation) {
          rendered.push(scope);
        }
      });
    };

    schedule("CO");
    generation += 1;
    schedule("NY");
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
    expect(rendered).toEqual(["NY"]);
  });
});
