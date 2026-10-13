import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  ATLAS_ROUTES,
  FOOTER_NAVIGATION_ITEMS,
  NAVIGATION_ITEMS,
  findRouteMetadata,
  getRouteShell,
  isNavigationItemActive,
  navigationItemsForGroup,
  pageMetadataForRoute,
} from "@/lib/navigation";

describe("Atlas navigation contract", () => {
  it("keeps primary routes unique, shallow, and centered on released workflows", () => {
    const hrefs = NAVIGATION_ITEMS.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toStrictEqual([
      "/overview",
      "/geographic_explorer",
      "/investigate",
      "/assistant",
      "/docs",
    ]);
    expect(hrefs).not.toContain("/design-system");
    expect(hrefs).not.toContain("/ux-lab");
  });

  it("does not register retired numbered variant routes", () => {
    const retired = [
      "/variant_1",
      "/variant_2",
      "/variant_3",
      "/variant_4",
      "/variant_5",
      "/variant_6",
      "/variant_7",
    ];
    expect(
      ATLAS_ROUTES.filter((route) => retired.includes(route.href))
    ).toStrictEqual([]);
    expect(NAVIGATION_ITEMS.map((item) => item.href)).toStrictEqual(
      expect.not.arrayContaining(retired)
    );
    expect(
      Object.fromEntries(retired.map((href) => [href, findRouteMetadata(href)]))
    ).toStrictEqual({
      "/variant_1": undefined,
      "/variant_2": undefined,
      "/variant_3": undefined,
      "/variant_4": undefined,
      "/variant_5": undefined,
      "/variant_6": undefined,
      "/variant_7": undefined,
    });
    expect(
      Object.fromEntries(retired.map((href) => [href, getRouteShell(href)]))
    ).toStrictEqual({
      "/variant_1": "analytical",
      "/variant_2": "analytical",
      "/variant_3": "analytical",
      "/variant_4": "analytical",
      "/variant_5": "analytical",
      "/variant_6": "analytical",
      "/variant_7": "analytical",
    });
  });

  it("classifies trust, utility, and technical routes explicitly", () => {
    expect(FOOTER_NAVIGATION_ITEMS.map((item) => item.href)).toStrictEqual([
      "/privacy",
      "/ai-ethics",
    ]);
    expect(findRouteMetadata("/account/settings")?.placement).toBe("utility");
    expect(findRouteMetadata("/design-system")?.shell).toBe("none");
    expect(findRouteMetadata("/auth/callback")?.shell).toBe("none");
  });

  it("does not register retired UX Lab routes", () => {
    expect(
      ATLAS_ROUTES.filter(
        (route) => route.href === "/ux-lab" || route.href.startsWith("/ux-lab/")
      )
    ).toStrictEqual([]);
    expect([
      findRouteMetadata("/ux-lab"),
      findRouteMetadata("/ux-lab/persona-gateway"),
      findRouteMetadata("/ux-lab/not-a-real-concept"),
    ]).toStrictEqual([undefined, undefined, undefined]);
  });

  it("does not advertise retired UX Lab paths to crawlers", () => {
    expect(JSON.stringify(robots().rules)).not.toContain("ux-lab");
    expect(
      sitemap().some((entry) => entry.url.includes("/ux-lab"))
    ).toBeFalsy();
    expect(
      sitemap().some((entry) =>
        ["/explore", "/compare", "/askatlas", "/app/review"].some((path) =>
          entry.url.includes(path)
        )
      )
    ).toBeFalsy();
  });

  it("keeps the UX Reset professional workspace off the legacy analytical shell", () => {
    expect(findRouteMetadata("/app/explore")).toMatchObject({
      auth: "required",
      placement: "none",
      shell: "none",
      status: "hidden",
    });
    expect([
      getRouteShell("/app/review"),
      getRouteShell("/explore"),
      getRouteShell("/compare"),
      getRouteShell("/askatlas"),
      getRouteShell("/assistant"),
      getRouteShell("/app/ai-responsible-use"),
    ]).toStrictEqual(["none", "none", "none", "none", "analytical", "none"]);
  });

  it("matches exact and nested routes without query sensitivity", () => {
    const overview = NAVIGATION_ITEMS.find(
      (item) => item.href === "/overview"
    )!;
    const assistant = NAVIGATION_ITEMS.find(
      (item) => item.href === "/assistant"
    )!;

    expect(isNavigationItemActive(overview, "/overview")).toBeTruthy();
    expect(isNavigationItemActive(overview, "/")).toBeFalsy();
    expect(
      isNavigationItemActive(overview, "/not-a-registered-route")
    ).toBeFalsy();
    expect(isNavigationItemActive(assistant, "/assistant")).toBeTruthy();
    expect(
      isNavigationItemActive(assistant, "/assistant?conversation=abc")
    ).toBeTruthy();
  });

  it("marks the Investigation Workspace active without query sensitivity", () => {
    const investigate = NAVIGATION_ITEMS.find(
      (item) => item.href === "/investigate"
    )!;

    expect({
      active: isNavigationItemActive(investigate, "/investigate"),
      group: investigate.group,
      label: investigate.label,
      query: isNavigationItemActive(
        investigate,
        "/investigate?county=08001&eco=70"
      ),
      shell: getRouteShell("/investigate"),
      unknown: isNavigationItemActive(investigate, "/not-a-registered-route"),
    }).toStrictEqual({
      active: true,
      group: "explore",
      label: "Investigation Workspace",
      query: true,
      shell: "analytical",
      unknown: false,
    });
  });

  it("matches dynamic route metadata by segment count", () => {
    const dynamic = { href: "/reports/[id]", match: "dynamic" as const };

    expect(isNavigationItemActive(dynamic, "/reports/abc")).toBeTruthy();
    expect(isNavigationItemActive(dynamic, "/reports/abc/details")).toBeFalsy();
  });

  it("assigns shells to public, docs, and hidden routes", () => {
    expect(getRouteShell("/")).toBe("none");
    expect(getRouteShell("/overview")).toBe("analytical");
    expect(getRouteShell("/privacy")).toBe("public");
    expect(getRouteShell("/docs/evidence-and-uncertainty")).toBe("docs");
    expect(getRouteShell("/design-system")).toBe("none");
  });

  it("keeps About Caraway Labs on the public shell and out of footer navigation", () => {
    expect({
      footer: FOOTER_NAVIGATION_ITEMS.map((item) => item.href),
      route: findRouteMetadata("/about/caraway-labs"),
      shell: getRouteShell("/about/caraway-labs"),
    }).toMatchObject({
      footer: ["/privacy", "/ai-ethics"],
      route: {
        placement: "none",
        shell: "public",
        status: "available",
      },
      shell: "public",
    });
  });

  it("renders active development capabilities consistently without inventing a feature guard", () => {
    const research = navigationItemsForGroup("research");
    expect(research.map((item) => [item.href, item.status])).toStrictEqual([
      ["/assistant", "inDevelopment"],
    ]);
    expect(findRouteMetadata("/knowledge-graph")?.placement).toBe("none");
    expect(
      ATLAS_ROUTES.filter((item) => item.status === "hidden").map(
        (item) => item.href
      )
    ).toContain("/design-system");
  });

  it("provides page metadata from the same route source", () => {
    expect(pageMetadataForRoute("/geographic_explorer")).toStrictEqual({
      description:
        "Explore county-level Lyme surveillance evidence through linked geographic and non-map views.",
      title: "Geographic Explorer | One Health Lyme Gap Atlas",
    });
  });
});
