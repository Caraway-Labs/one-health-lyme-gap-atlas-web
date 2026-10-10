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

  it("keeps experimental routes out of the primary navigation", () => {
    const hrefs = NAVIGATION_ITEMS.map((item) => item.href);

    expect(hrefs).not.toContain("/variant_1");
    expect(hrefs).not.toContain("/variant_7");
    expect(
      NAVIGATION_ITEMS.filter((item) => item.status === "experimental")
    ).toHaveLength(0);
  });

  it("classifies trust, utility, experimental, and technical routes explicitly", () => {
    expect(FOOTER_NAVIGATION_ITEMS.map((item) => item.href)).toStrictEqual([
      "/privacy",
      "/ai-ethics",
    ]);
    expect(findRouteMetadata("/account/settings")?.placement).toBe("utility");
    expect(findRouteMetadata("/variant_1")?.status).toBe("experimental");
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
  });

  it("keeps the UX Reset professional workspace off the legacy analytical shell", () => {
    expect(findRouteMetadata("/app/explore")).toMatchObject({
      auth: "required",
      placement: "none",
      shell: "none",
      status: "hidden",
    });
    expect(getRouteShell("/app/review")).toBe("none");
    expect(getRouteShell("/app/ai-responsible-use")).toBe("none");
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
    expect(isNavigationItemActive(overview, "/variant_1")).toBeFalsy();
    expect(isNavigationItemActive(assistant, "/assistant")).toBeTruthy();
    expect(
      isNavigationItemActive(assistant, "/assistant?conversation=abc")
    ).toBeTruthy();
  });

  it("marks the Investigation Workspace active without query sensitivity", () => {
    const investigate = NAVIGATION_ITEMS.find(
      (item) => item.href === "/investigate"
    )!;

    expect(investigate.group).toBe("explore");
    expect(investigate.label).toBe("Investigation Workspace");
    expect(isNavigationItemActive(investigate, "/investigate")).toBeTruthy();
    expect(
      isNavigationItemActive(investigate, "/investigate?county=08001&eco=70")
    ).toBeTruthy();
    expect(isNavigationItemActive(investigate, "/variant_6")).toBeFalsy();
  });

  it("keeps the legacy wide workspace routable but out of primary navigation", () => {
    expect(findRouteMetadata("/variant_6")).toMatchObject({
      placement: "none",
      status: "hidden",
    });
    expect(getRouteShell("/investigate")).toBe("analytical");
    expect(NAVIGATION_ITEMS.map((item) => item.href)).not.toContain(
      "/variant_6"
    );
  });

  it("matches dynamic route metadata by segment count", () => {
    const dynamic = { href: "/reports/[id]", match: "dynamic" as const };

    expect(isNavigationItemActive(dynamic, "/reports/abc")).toBeTruthy();
    expect(isNavigationItemActive(dynamic, "/reports/abc/details")).toBeFalsy();
  });

  it("assigns shells to public, docs, and direct-link routes", () => {
    expect(getRouteShell("/")).toBe("none");
    expect(getRouteShell("/overview")).toBe("analytical");
    expect(getRouteShell("/privacy")).toBe("public");
    expect(getRouteShell("/docs/evidence-and-uncertainty")).toBe("docs");
    expect(getRouteShell("/variant_1")).toBe("none");
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
