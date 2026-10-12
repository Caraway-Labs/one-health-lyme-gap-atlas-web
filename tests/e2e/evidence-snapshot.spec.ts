import { expect, test } from "@playwright/test";

test("retired overview and geographic explorer bookmarks leave the public evidence snapshot", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/app\/review$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Atlas Explorer" })
  ).toBeVisible();
  await expect(page.locator(".atlas-evidence-snapshot")).toHaveCount(0);

  await page.goto("/geographic_explorer");
  await expect(page).toHaveURL(/\/app\/review$/);
  await expect(
    page.getByRole("heading", { name: "Evidence snapshot" })
  ).toHaveCount(0);
});
