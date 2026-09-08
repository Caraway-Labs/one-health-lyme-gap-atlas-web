import { describe, expect, it } from "vitest";
import {
  NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationItemsForGroup,
} from "@/lib/navigation";

describe("Atlas navigation contract", () => {
  it("keeps primary routes unique and centered on user workflows", () => {
    const hrefs = NAVIGATION_ITEMS.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toContain("/geographic_explorer");
    expect(hrefs).not.toContain("/variant_7");
  });

  it("matches exact workflow routes without a prefix collision", () => {
    const overview = NAVIGATION_ITEMS.find((item) => item.href === "/")!;
    const countyReview = NAVIGATION_ITEMS.find((item) => item.href === "/variant_1")!;

    expect(isNavigationItemActive(overview, "/")).toBe(true);
    expect(isNavigationItemActive(overview, "/variant_1")).toBe(false);
    expect(isNavigationItemActive(countyReview, "/variant_1")).toBe(true);
  });

  it("hides feature-gated research navigation until enabled", () => {
    expect(navigationItemsForGroup("research", false)).toEqual([]);
    expect(navigationItemsForGroup("research", true).map((item) => item.href)).toEqual(["/knowledge-graph"]);
  });
});
