import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

test.describe("Explore bookmarks open Atlas Explorer browse", () => {
  test("keeps jurisdiction, county, and period and drops the measure browser", async ({
    page,
  }) => {
    await fulfillCompletedStartingView(page);
    await page.goto(
      "/app/explore?scope=CO&county=08001&period=2025-01-01&metric=reported-cases"
    );
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/period=2025-01-01/);
    await expect(page).not.toHaveURL(/metric=/);
    await expect(page.getByTestId("explore-measure-select")).toHaveCount(0);
    await expect(page.getByTestId("explore-workspace")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore potential Lyme surveillance gaps",
      })
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("county")).not.toBe("06037");
  });
});
