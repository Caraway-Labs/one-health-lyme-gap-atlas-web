import { describe, expect, it } from "vitest";

import {
  UX_RESET_HANDOFF_ACCEPTANCE,
  uxResetContextHandoffSearchParams,
  uxResetDestinationHref,
  uxResetNavigationHref,
} from "@/features/ux-reset/context-handoff";
import {
  parseUxResetSharedContext,
  sharedContextToSearchParams,
} from "@/features/ux-reset/context-params";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";

function querySnapshot(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}

describe("UX Reset cross-page context contract", () => {
  it("documents acceptance matrix dimensions for every destination", () => {
    expect(Object.keys(UX_RESET_HANDOFF_ACCEPTANCE).sort()).toStrictEqual(
      Object.keys(UX_RESET_ROUTE_PATHS).sort()
    );
  });

  it("preserves review scope, county, release, and period across Review → Investigate", () => {
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

  it("maps Explore selected counties into compare when entering Compare", () => {
    const source = new URLSearchParams(
      "scope=ALL&county=06037&selected=06085,06037,08001&view=compare&metric=score"
    );
    const { dropped, params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.explore,
      UX_RESET_ROUTE_PATHS.compare,
      source
    );
    expect(params.get("compare")).toBe("06085,06037,08001");
    expect(dropped).toContain("view");
    expect(dropped).toContain("metric");
    expect(dropped).toContain("selected");
  });

  it("drops compare when returning from Compare to Investigate", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&compare=08001,08003&dataset=alpha&metric=score"
    );
    const { dropped, params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.compare,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(params.has("compare")).toBeFalsy();
    expect(dropped).toContain("compare");
    expect(dropped).toContain("metric");
  });

  it("limits Assistant handoff to county and release", () => {
    const source = new URLSearchParams(
      "scope=CO&county=08001&dataset=alpha&conversation=local-1&eco=70"
    );
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.investigate,
      UX_RESET_ROUTE_PATHS.assistant,
      source
    );
    expect(querySnapshot(params)).toStrictEqual({
      county: "08001",
      dataset: "alpha",
    });
  });

  it("does not hand off context onto Feed or Settings", () => {
    const source = new URLSearchParams("county=08001&dataset=alpha");
    expect(
      uxResetContextHandoffSearchParams(
        UX_RESET_ROUTE_PATHS.review,
        UX_RESET_ROUTE_PATHS.feed,
        source
      ).params.toString()
    ).toBe("");
    expect(
      uxResetContextHandoffSearchParams(
        UX_RESET_ROUTE_PATHS.review,
        UX_RESET_ROUTE_PATHS.settings,
        source
      ).params.toString()
    ).toBe("");
  });

  it("skips invalid FIPS instead of substituting a default county", () => {
    const source = new URLSearchParams("county=bad-fips&dataset=alpha");
    const { params } = uxResetContextHandoffSearchParams(
      UX_RESET_ROUTE_PATHS.review,
      UX_RESET_ROUTE_PATHS.investigate,
      source
    );
    expect(params.has("county")).toBeFalsy();
    expect(params.get("dataset")).toBe("alpha");
  });

  it("builds navigation hrefs for shell links", () => {
    const source = new URLSearchParams("scope=IN&county=18097&dataset=alpha");
    expect(
      uxResetDestinationHref("compare", UX_RESET_ROUTE_PATHS.review, source)
    ).toBe("/app/compare?scope=IN&county=18097&dataset=alpha");
    expect(
      uxResetNavigationHref(
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

  it("round-trips parsed shared context through search params", () => {
    const context = parseUxResetSharedContext(
      new URLSearchParams(
        "scope=CO&county=08001&compare=08001,08003&dataset=alpha&period=2023-01-01"
      )
    );
    const serialized = sharedContextToSearchParams(context);
    expect(parseUxResetSharedContext(serialized)).toStrictEqual(context);
  });

  it("simulates forward navigation and browser back across Investigate and Compare", () => {
    const reviewUrl = new URL(
      uxResetDestinationHref(
        "review",
        UX_RESET_ROUTE_PATHS.review,
        new URLSearchParams("scope=CO&county=08001&dataset=alpha")
      ),
      "http://localhost"
    );
    const investigateUrl = new URL(
      uxResetNavigationHref(
        UX_RESET_ROUTE_PATHS.investigate,
        reviewUrl.pathname,
        reviewUrl.searchParams
      ),
      "http://localhost"
    );
    const compareSource = new URLSearchParams(investigateUrl.searchParams);
    compareSource.set("compare", "08001,08003");
    const compareUrl = new URL(
      uxResetNavigationHref(
        UX_RESET_ROUTE_PATHS.compare,
        investigateUrl.pathname,
        compareSource
      ),
      "http://localhost"
    );
    const backHref = uxResetNavigationHref(
      UX_RESET_ROUTE_PATHS.investigate,
      compareUrl.pathname,
      compareUrl.searchParams
    );

    expect({
      backHref: new URL(backHref, "http://localhost").href,
      compareQuery: querySnapshot(compareUrl.searchParams),
      investigateHref: investigateUrl.href,
    }).toStrictEqual({
      backHref: investigateUrl.href,
      compareQuery: {
        compare: "08001,08003",
        county: "08001",
        dataset: "alpha",
        scope: "CO",
      },
      investigateHref:
        "http://localhost/app/investigate?scope=CO&county=08001&dataset=alpha",
    });
  });
});
