import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

test.describe("Investigate bookmarks open Atlas Explorer", () => {
  test.beforeEach(async ({ page }) => {
    await fulfillCompletedStartingView(page);
  });

  test("a valid county opens county evidence", async ({ page }) => {
    await page.goto("/app/investigate?county=08001&scope=CO");
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/mode=evidence/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("investigate-header")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore potential Lyme surveillance gaps",
      })
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("county")).not.toBe("06037");
  });

  test("an invalid county stays on browse and is not replaced", async ({
    page,
  }) => {
    await page.goto("/app/investigate?county=not-a-county&scope=CO");
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page).not.toHaveURL(/county=/);
    await expect(page).toHaveURL(/selection=required/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page.getByTestId("investigate-header")).toHaveCount(0);
  });
});
