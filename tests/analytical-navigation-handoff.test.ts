import { describe, expect, it } from "vitest";

import {
  analyticalNavigationHandoffSearchParams,
  analyticalNavigationHref,
  backToAtlasHref,
  legacyAnalyticalOverviewHref,
} from "@/lib/analytical-navigation-handoff";

function expectHrefQuery(href: string, expected: Record<string, string>) {
  const url = new URL(href, "http://localhost");
  for (const [key, value] of Object.entries(expected)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

describe("analytical navigation handoff", () => {
  it("copies shared county and release context between analytical routes", () => {
    const source = new URLSearchParams(
      "dataset=alpha-2026-08-06&county=18097&state=IN"
    );
    expectHrefQuery(
      analyticalNavigationHref("/geographic_explorer", "/overview", source),
      {
        county: "18097",
        dataset: "alpha-2026-08-06",
        state: "IN",
      }
    );
    expect(
      new URL(
        analyticalNavigationHref("/investigate", "/overview", source),
        "http://localhost"
      ).pathname
    ).toBe("/investigate");
    expectHrefQuery(
      analyticalNavigationHref("/investigate", "/overview", source),
      {
        county: "18097",
        dataset: "alpha-2026-08-06",
        state: "IN",
      }
    );
  });

  it("does not fabricate Geographic Explorer-only parameters on other routes", () => {
    const source = new URLSearchParams(
      "county=08001&view=compare&selected=08001%2C06037&metric=completeness&page=2"
    );
    expect(
      analyticalNavigationHandoffSearchParams(
        "/geographic_explorer",
        "/overview",
        source
      ).toString()
    ).toBe("county=08001");
    expect(
      analyticalNavigationHandoffSearchParams(
        "/geographic_explorer",
        "/investigate",
        source
      ).toString()
    ).toBe("county=08001");
  });

  it("keeps explorer-specific parameters when the destination is Geographic Explorer", () => {
    const source = new URLSearchParams(
      "county=08001&view=maps&metric=score&page=3"
    );
    const handoff = analyticalNavigationHandoffSearchParams(
      "/overview",
      "/geographic_explorer",
      source
    );
    expect(handoff.get("county")).toBe("08001");
    expect(handoff.get("view")).toBe("maps");
    expect(handoff.get("metric")).toBe("score");
    expect(handoff.get("page")).toBe("3");
  });

  it("skips invalid county values instead of inventing a replacement", () => {
    const source = new URLSearchParams("county=not-a-fips&dataset=alpha");
    expect(
      analyticalNavigationHandoffSearchParams(
        "/overview",
        "/geographic_explorer",
        source
      ).toString()
    ).toBe("dataset=alpha");
  });

  it("does not hand off analytical state from non-analytical routes", () => {
    const source = new URLSearchParams("county=08001");
    expect(analyticalNavigationHref("/overview", "/privacy", source)).toBe(
      "/overview"
    );
    expect(analyticalNavigationHref("/", "/overview", source)).toBe("/");
  });

  it("leaves external and utility destinations unchanged", () => {
    const source = new URLSearchParams("county=08001");
    expect(analyticalNavigationHref("/docs", "/", source)).toBe("/docs");
    expect(analyticalNavigationHref("/account", "/", source)).toBe("/account");
  });

  it("keeps the current Overview query on a same-page Atlas anchor", () => {
    const source = new URLSearchParams("county=08001&state=CO&eco=70");
    expect(backToAtlasHref("/overview", source)).toBe("#atlas");
    expect(backToAtlasHref("/geographic_explorer", source)).toBe(
      "/overview?county=08001&eco=70&state=CO#atlas"
    );
    expect(backToAtlasHref("/privacy", source)).toBe("/overview#atlas");
  });

  it("sends legacy analytical root queries to Overview", () => {
    expect(
      legacyAnalyticalOverviewHref({
        county: "08001",
        dataset: "alpha-explorer",
        state: "CO",
      })
    ).toBe("/overview?county=08001&dataset=alpha-explorer&state=CO");
    expect(legacyAnalyticalOverviewHref({})).toBeNull();
    expect(legacyAnalyticalOverviewHref({ utm_source: "share" })).toBeNull();
    expect(legacyAnalyticalOverviewHref({ county: "not-a-fips" })).toBeNull();
  });
});
