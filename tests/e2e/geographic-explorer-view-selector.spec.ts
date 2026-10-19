import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

test("retired Geographic Explorer view bookmarks open Atlas Explorer browse", async ({
  page,
}) => {
  await fulfillCompletedStartingView(page);
  for (const start of [
    "/geographic_explorer?county=08001",
    "/geographic_explorer?county=08001&view=maps",
  ]) {
    await page.goto(start);
    await expect(page).toHaveURL(/\/explore\?.*county=08001/);
    expect(new URL(page.url()).searchParams.get("view")).toBeNull();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore county Lyme data",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Geographic tiles" })
    ).toHaveCount(0);
  }
});
