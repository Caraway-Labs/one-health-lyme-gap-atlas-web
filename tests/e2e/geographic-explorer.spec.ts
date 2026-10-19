import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const bookmarks = [
  {
    landed: /\/explore$/,
    start: "/geographic_explorer",
  },
  {
    landed:
      /\/explore\?.*county=06085.*scope=CA|\/explore\?.*scope=CA.*county=06085/,
    start: "/geographic_explorer?state=CA&county=06085",
  },
  {
    landed: /\/explore\?.*scope=CA/,
    start: "/geographic_explorer?state=CA&evidence=complete",
  },
  {
    landed: /\/explore\?.*county=08001/,
    start: "/geographic_explorer?view=ranking&county=08001",
  },
  {
    landed: /\/explore\?.*county=08001/,
    start: "/geographic_explorer?view=maps&county=08001",
  },
  {
    landed: /\/explore\?.*dataset=old-release/,
    start: "/geographic_explorer?dataset=old-release",
  },
  {
    landed: /\/explore$/,
    start: "/geographic_explorer?view=maps",
  },
] as const;

test.describe("retired Geographic Explorer bookmarks", () => {
  test.beforeEach(async ({ page }) => {
    await fulfillCompletedStartingView(page);
  });

  for (const bookmark of bookmarks) {
    test(`redirects ${bookmark.start} to Atlas Explorer`, async ({ page }) => {
      await page.goto(bookmark.start);
      await expect(page).toHaveURL(bookmark.landed);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Explore potential Lyme surveillance gaps",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Geographic explorer", exact: true })
      ).toHaveCount(0);
      const params = new URL(page.url()).searchParams;
      expect(params.get("view")).toBeNull();
      expect(params.get("evidence")).toBeNull();
      if (bookmark.start.includes("county=")) {
        expect(params.get("county")).not.toBe("06037");
      } else {
        expect(params.get("county")).toBeNull();
      }
    });
  }
});
