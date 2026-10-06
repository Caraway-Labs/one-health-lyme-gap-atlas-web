import { describe, expect, it } from "vitest";

import {
  UX_RESET_HANDOFF_ACCEPTANCE,
  UX_RESET_HANDOFF_EXPORT,
  uxResetContextHandoffSearchParams,
  uxResetDestinationHref,
  uxResetShellHandoffHref,
} from "@/features/ux-reset/context-handoff";
import {
  loadUxResetSharedContext,
  parseCalendarIsoDate,
  parseUxResetSharedContext,
  sharedContextToSearchParams,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";

import {
  FIXTURE_HANDOFF_PAIRS,
  FIXTURE_MALFORMED_HANDOFF_CASES,
  fixtureRichSourceQuery,
  fixtureSourceKeysExpectedDropped,
} from "./fixtures/ux-reset-handoff-contract.fixture";

function querySnapshot(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}

function expectSameContextForUrl(query: string) {
  const params = new URLSearchParams(query);
  expect(loadUxResetSharedContext(params)).toStrictEqual(
    parseUxResetSharedContext(params)
  );
}

describe("UX Reset cross-page context contract", () => {
  it("documents acceptance and export matrix dimensions for every destination", () => {
    expect(Object.keys(UX_RESET_HANDOFF_ACCEPTANCE).sort()).toStrictEqual(
      Object.keys(UX_RESET_ROUTE_PATHS).sort()
    );
    expect(Object.keys(UX_RESET_HANDOFF_EXPORT).sort()).toStrictEqual(
      Object.keys(UX_RESET_ROUTE_PATHS).sort()
    );
  });

  it("aligns nuqs loader and standalone parsing for duplicate and missing keys", () => {
    expectSameContextForUrl("compare=08001&compare=08003");
    expectSameContextForUrl("county=08001&dataset=alpha");
    expect(
      loadUxResetSharedContext(new URLSearchParams()).compare
    ).toStrictEqual([]);
    expect(
      parseUxResetSharedContext(new URLSearchParams()).compare
    ).toStrictEqual([]);
    expect(loadUxResetSharedContext(new URLSearchParams()).county).toBeNull();
  });

  it("rejects invalid calendar period dates", () => {
    expect(parseCalendarIsoDate("2026-02-30")).toBeNull();
    expect(
      parseUxResetSharedContext(new URLSearchParams("period=2026-02-30")).period
    ).toBeNull();
    expect(
      loadUxResetSharedContext(new URLSearchParams("period=2026-02-30")).period
    ).toBeNull();
    expect(parseCalendarIsoDate("2024-02-29")).toBe("2024-02-29");
  });

  it("canonicalizes scope whitespace and preserves it through handoff", () => {
    const source = new URLSearchParams("scope=%20CO%20&county=08001");
    expect(parseUxResetSharedContext(source).scope).toBe("CO");
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.review,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(params.get("scope")).toBe("CO");
    expect(parseUxResetSharedContext(params).scope).toBe("CO");
  });

  it("rejects ambiguous county query values instead of picking a later FIPS", () => {
    const source = new URLSearchParams("county=bad&county=08001&dataset=alpha");
    expect(parseUxResetSharedContext(source).county).toBeNull();
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.review,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(params.has("county")).toBeFalsy();
    expect(params.get("dataset")).toBe("alpha");
  });

  it("canonicalizes compare lists to two unique FIPS on Compare to Action handoff", () => {
    expect(UX_RESET_COMPARE_COUNTY_LIMIT).toBe(2);
    const source = new URLSearchParams(
      "compare=08001,garbage,08001,08003,08005,08007,08009,08011&county=08001"
    );
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.compare,
      UX_RESET_ROUTE_PATHS.action,
      source
    );
    expect(params.get("compare")).toBe("08001,08003");
    expect(params.getAll("compare")).toStrictEqual(["08001,08003"]);
  });

  it("preserves review scope, county, release, and period across Review to Investigate", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&dataset=alpha-2026-08-06&period=2023-01-01&sort=score"
    );
    const { dropped, params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.review,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(querySnapshot(params)).toStrictEqual({
      county: "08001",
      dataset: "alpha-2026-08-06",
      period: "2023-01-01",
      scope: "CO",
    });
    expect(dropped).toContain("sort");
    expect(dropped).not.toContain("county");
  });

  it("maps Explore selected counties into compare when entering Compare (max two)", () => {
    const source = new URLSearchParams(
      "scope=ALL&county=06037&selected=06085,06037,08001&view=compare&metric=score"
    );
    const { dropped, params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.explore,
      UX_RESET_ROUTE_PATHS.compare,
      source
    );
    expect(params.get("compare")).toBe("06085,06037");
    expect(dropped).toContain("view");
    expect(dropped).toContain("selected");
  });

  it("drops the Compare return target and does not copy the pair onto Review", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&compare=08001,08013&dataset=alpha&return=review&metric=score"
    );
    const review = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.compare,
      UX_RESET_ROUTE_PATHS.review,
      source
    );
    const investigate = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.compare,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect({
      investigateCompare: investigate.params.get("compare"),
      investigateDropsReturn: investigate.dropped.includes("return"),
      investigateReturn: investigate.params.has("return"),
      reviewCompare: review.params.has("compare"),
      reviewCounty: review.params.get("county"),
      reviewDropsCompare: review.dropped.includes("compare"),
      reviewDropsReturn: review.dropped.includes("return"),
      reviewReturn: review.params.has("return"),
    }).toStrictEqual({
      investigateCompare: "08001,08013",
      investigateDropsReturn: true,
      investigateReturn: false,
      reviewCompare: false,
      reviewCounty: "08001",
      reviewDropsCompare: true,
      reviewDropsReturn: true,
      reviewReturn: false,
    });
  });

  it("keeps a validated compare pair when opening Investigate", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&compare=08001,08003&dataset=alpha&metric=score"
    );
    const { dropped, params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.compare,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(params.get("compare")).toBe("08001,08003");
    expect(params.get("county")).toBe("08001");
    expect(dropped).not.toContain("compare");
    expect(dropped).toContain("metric");
  });

  it("limits Assistant export to county and dataset on outbound handoff", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&compare=08001,08003&dataset=alpha&period=2023-01-01&conversation=local-1"
    );
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.assistant,
      UX_RESET_ROUTE_PATHS.compare,
      source
    );
    expect(querySnapshot(params)).toStrictEqual({
      county: "08001",
      dataset: "alpha",
    });
  });

  it("does not export context from Feed or Settings even when the URL carries params", () => {
    const source = new URLSearchParams("county=08001&dataset=alpha");
    expect(
      uxResetContextHandoffSearchParams(
        UX_RESET_ROUTE_PATHS.feed,
        UX_RESET_ROUTE_PATHS.review,
        source
      ).params.toString()
    ).toBe("");
    expect(
      uxResetContextHandoffSearchParams(
        UX_RESET_ROUTE_PATHS.settings,
        UX_RESET_ROUTE_PATHS.review,
        source
      ).params.toString()
    ).toBe("");
  });

  it("does not hand off context onto Feed or Settings destinations", () => {
    const source = new URLSearchParams("county=08001&dataset=alpha");
    expect(
      uxResetContextHandoffSearchParams(
        UX_RESET_ROUTE_PATHS.review,
        UX_RESET_ROUTE_PATHS.feed,
        source
      ).params.toString()
    ).toBe("");
  });

  it("builds shell handoff hrefs with canonical query strings", () => {
    const source = new URLSearchParams("scope=IN&county=18097&dataset=alpha");
    expect(
      uxResetDestinationHref("compare", UX_RESET_ROUTE_PATHS.review, source)
    ).toBe("/app/compare?scope=IN&county=18097&dataset=alpha");
    expect(
      uxResetShellHandoffHref(
        "/app/investigate",
        UX_RESET_ROUTE_PATHS.review,
        source
      )
    ).toBe("/app/investigate?scope=IN&county=18097&dataset=alpha");
  });

  it("does not hand off from non-reset routes", () => {
    const source = new URLSearchParams("county=08001");
    expect(
      uxResetContextHandoffSearchParams(
        "/",
        UX_RESET_ROUTE_PATHS.review,
        source
      ).params.toString()
    ).toBe("");
  });

  describe("table-driven handoff contract matrix (fixture policy)", () => {
    it.each(FIXTURE_HANDOFF_PAIRS)(
      "$source → $destination retains canonical shared context per fixture policy",
      ({ destination, retained, source }) => {
        const sourceParams = fixtureRichSourceQuery(source);
        const { dropped, params } = uxResetContextHandoffSearchParams(
          UX_RESET_ROUTE_PATHS[source],
          UX_RESET_ROUTE_PATHS[destination],
          sourceParams
        );
        expect(querySnapshot(params)).toStrictEqual(retained);
        for (const key of fixtureSourceKeysExpectedDropped(
          sourceParams,
          retained
        )) {
          expect(dropped).toContain(key);
        }
      }
    );

    it.each(FIXTURE_MALFORMED_HANDOFF_CASES)(
      "malformed: $label ($source → $destination)",
      ({ destination, mustDrop, query, retained, source }) => {
        const sourceParams = new URLSearchParams(query);
        const { dropped, params } = uxResetContextHandoffSearchParams(
          UX_RESET_ROUTE_PATHS[source],
          UX_RESET_ROUTE_PATHS[destination],
          sourceParams
        );
        expect(querySnapshot(params)).toStrictEqual(retained);
        for (const key of mustDrop) {
          expect(dropped).toContain(key);
        }
      }
    );
  });

  it("round-trips parsed shared context through search params", () => {
    const context = parseUxResetSharedContext(
      new URLSearchParams(
        "scope=CO&county=08001&compare=08001,08003&dataset=alpha&period=2023-01-01"
      )
    );
    const serialized = sharedContextToSearchParams(context);
    expect(parseUxResetSharedContext(serialized)).toStrictEqual(context);
  });
});
