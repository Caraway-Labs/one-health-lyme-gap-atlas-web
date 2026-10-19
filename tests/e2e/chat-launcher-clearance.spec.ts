import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

test("retired public analytical bookmarks do not open the assistant drawer", async ({
  page,
}) => {
  await fulfillCompletedStartingView(page);
  for (const start of [
    "/geographic_explorer?state=CA&county=06085&view=maps",
    "/geographic_explorer?state=CA&county=06085",
    "/overview",
  ]) {
    await page.goto(start);
    await expect(page).toHaveURL(/\/explore/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore potential Lyme surveillance gaps",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Atlas Assistant" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Atlas Assistant" })
    ).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("view")).toBeNull();
  }
});

test("account keeps the public assistant drawer off the retired explorer routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
  const launcher = page.getByRole("button", { name: "Atlas Assistant" });
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(
    page.getByRole("dialog", { name: "Atlas Assistant" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Close Atlas Assistant" }).click();
  await expect(launcher).toBeFocused();
  await expect(page).toHaveURL(/\/account$/);
});
