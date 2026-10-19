import { describe, expect, it } from "vitest";

import {
  parseUxResetSharedContext,
  sharedContextToSearchParams,
} from "@/features/ux-reset/context-params";
import { buildReviewScopePresentation } from "@/features/ux-reset/review/build-review-presentation";
import {
  hasExplicitReviewLocation,
  hasExplicitReviewScopeParam,
  isReviewStartingScopeUnresolved,
  resolveStartingReviewScope,
  reviewScopeMatchesPresentation,
  reviewScopeQueryCanonicalRewrite,
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
    expect(resolveStartingReviewScope(true, "NY", "CO", stateOptions)).toBe(
      "NY"
    );
  });

  it("applies profile default when scope is omitted from the URL", () => {
    expect(resolveStartingReviewScope(false, "ALL", "CO", stateOptions)).toBe(
      "CO"
    );
  });

  it("falls back to national scope when profile default is missing or invalid", () => {
    expect(resolveStartingReviewScope(false, "ALL", null, stateOptions)).toBe(
      "ALL"
    );
    expect(resolveStartingReviewScope(false, "ALL", "ZZ", stateOptions)).toBe(
      "ALL"
    );
  });

  it("detects explicit scope params", () => {
    expect(
      hasExplicitReviewScopeParam(new URLSearchParams("scope=CO"))
    ).toBeTruthy();
    expect(
      hasExplicitReviewScopeParam(new URLSearchParams("scope=ALL"))
    ).toBeTruthy();
    expect(hasExplicitReviewScopeParam(new URLSearchParams())).toBeFalsy();
  });

  it("treats a valid national focus as an explicit location", () => {
    expect({
      alaska: hasExplicitReviewLocation(new URLSearchParams("focus=AK")),
      focus: hasExplicitReviewLocation(new URLSearchParams("focus=ID")),
      repeat: hasExplicitReviewLocation(
        new URLSearchParams("focus=ID&focus=WY")
      ),
      starting: resolveStartingReviewScope(
        hasExplicitReviewLocation(new URLSearchParams("focus=ID")),
        "ALL",
        "CO",
        stateOptions
      ),
    }).toStrictEqual({
      alaska: false,
      focus: true,
      repeat: false,
      starting: "ALL",
    });
  });

  it("treats a county in the URL as an explicit location", () => {
    expect({
      both: hasExplicitReviewLocation(
        new URLSearchParams("scope=NY&county=36001")
      ),
      county: hasExplicitReviewLocation(new URLSearchParams("county=08001")),
      empty: hasExplicitReviewLocation(new URLSearchParams()),
      starting: resolveStartingReviewScope(
        hasExplicitReviewLocation(new URLSearchParams("county=08001")),
        "ALL",
        "CO",
        stateOptions
      ),
    }).toStrictEqual({
      both: true,
      county: true,
      empty: false,
      starting: "ALL",
    });
  });

  it("rewrites malformed scope queries to the canonical token", () => {
    expect({
      conflict: reviewScopeQueryCanonicalRewrite(
        new URLSearchParams("scope=CO&scope=NY")
      ),
      explicit: reviewScopeQueryCanonicalRewrite(
        new URLSearchParams("scope=CO")
      ),
      malformed: reviewScopeQueryCanonicalRewrite(
        new URLSearchParams("scope=NOT")
      ),
      national: reviewScopeQueryCanonicalRewrite(
        new URLSearchParams("scope=ALL")
      ),
      omitted: reviewScopeQueryCanonicalRewrite(new URLSearchParams()),
      padded: reviewScopeQueryCanonicalRewrite(
        new URLSearchParams("scope=%20CO%20")
      ),
    }).toStrictEqual({
      conflict: "ALL",
      explicit: null,
      malformed: "ALL",
      national: null,
      omitted: null,
      padded: "CO",
    });
  });

  it("keeps startup readiness on the one-time resolution", () => {
    const awaitingCommit = {
      arrivalExplicitScope: false,
      metadataError: false,
      metadataReady: true,
      profileFetched: true,
      startupSettled: false,
      stateOptions,
      userChoseScope: false,
    };
    expect({
      awaitingCommit: isReviewStartingScopeUnresolved(awaitingCommit),
      emptyStates: isReviewStartingScopeUnresolved({
        ...awaitingCommit,
        stateOptions: [],
      }),
      explicitArrival: isReviewStartingScopeUnresolved({
        ...awaitingCommit,
        arrivalExplicitScope: true,
      }),
      loadingProfile: isReviewStartingScopeUnresolved({
        ...awaitingCommit,
        profileFetched: false,
      }),
      settled: isReviewStartingScopeUnresolved({
        ...awaitingCommit,
        startupSettled: true,
      }),
      userChoice: isReviewStartingScopeUnresolved({
        ...awaitingCommit,
        userChoseScope: true,
      }),
    }).toStrictEqual({
      awaitingCommit: true,
      emptyStates: false,
      explicitArrival: false,
      loadingProfile: true,
      settled: false,
      userChoice: false,
    });
  });

  it("round-trips explicit national scope in shared URL context", () => {
    const context = parseUxResetSharedContext(
      new URLSearchParams("scope=ALL&dataset=alpha-2026")
    );
    expect(context.scope).toBe("ALL");
    const serialized = sharedContextToSearchParams(context);
    expect(serialized.get("scope")).toBe("ALL");
    expect(parseUxResetSharedContext(serialized).scope).toBe("ALL");
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
    expect(presentation.orientationRows).toStrictEqual([
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
    expect(presentation.stateCounties.map((entry) => entry.fips)).toStrictEqual(
      ["08001"]
    );
  });

  it("limits map counties to the active state scope", () => {
    const presentation = buildReviewScopePresentation("CO", [
      county("08001", "CO", 90),
      county("36001", "NY", 80),
    ]);
    expect(presentation.mapCounties.map((entry) => entry.fips)).toStrictEqual([
      "08001",
    ]);
  });

  it("guards rendered presentation against scope drift", () => {
    expect(reviewScopeMatchesPresentation("CO", "CO")).toBeTruthy();
    expect(reviewScopeMatchesPresentation("CO", "NY")).toBeFalsy();
    expect(reviewScopeMatchesPresentation("CO", "CO")).not.toBe(
      reviewScopeMatchesPresentation("CO", "NY")
    );
  });
});

describe("Review scope generation guard", () => {
  it("drops late microtasks for a previous scope", async () => {
    let generation = 0;
    const rendered: string[] = [];
    const schedule = (scope: string) => {
      generation += 1;
      const token = generation;
      queueMicrotask(() => {
        if (token === generation) {
          rendered.push(scope);
        }
      });
    };

    schedule("CO");
    generation += 1;
    schedule("NY");
    await Promise.resolve();
    await Promise.resolve();
    expect(rendered).toStrictEqual(["NY"]);
  });
});
