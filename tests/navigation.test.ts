import { describe, expect, it } from "vitest";

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
      "/",
      "/geographic_explorer",
      "/knowledge-graph",
      "/assistant",
      "/docs",
    ]);
    expect(hrefs).not.toContain("/design-system");
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
    expect(findRouteMetadata("/variant_6")?.status).toBe("experimental");
    expect(findRouteMetadata("/design-system")?.shell).toBe("none");
    expect(findRouteMetadata("/auth/callback")?.shell).toBe("none");
  });

  it("matches exact and nested routes without query sensitivity", () => {
    const overview = NAVIGATION_ITEMS.find((item) => item.href === "/")!;
    const evidenceLibrary = NAVIGATION_ITEMS.find(
      (item) => item.href === "/knowledge-graph"
    )!;

    expect(isNavigationItemActive(overview, "/")).toBeTruthy();
    expect(isNavigationItemActive(overview, "/variant_1")).toBeFalsy();
    expect(
      isNavigationItemActive(evidenceLibrary, "/knowledge-graph/abc")
    ).toBeTruthy();
    expect(
      isNavigationItemActive(
        evidenceLibrary,
        "/knowledge-graph?conversation=abc"
      )
    ).toBeTruthy();
  });

  it("matches dynamic route metadata by segment count", () => {
    const dynamic = { href: "/reports/[id]", match: "dynamic" as const };

    expect(isNavigationItemActive(dynamic, "/reports/abc")).toBeTruthy();
    expect(isNavigationItemActive(dynamic, "/reports/abc/details")).toBeFalsy();
  });

  it("assigns shells to public, docs, and direct-link routes", () => {
    expect(getRouteShell("/privacy")).toBe("public");
    expect(getRouteShell("/docs/evidence-and-uncertainty")).toBe("docs");
    expect(getRouteShell("/variant_1")).toBe("none");
  });

  it("renders active development capabilities consistently without inventing a feature guard", () => {
    const research = navigationItemsForGroup("research");
    expect(research.map((item) => [item.href, item.status])).toStrictEqual([
      ["/knowledge-graph", "inDevelopment"],
      ["/assistant", "inDevelopment"],
    ]);
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
