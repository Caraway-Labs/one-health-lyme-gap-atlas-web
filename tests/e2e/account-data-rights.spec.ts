import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

async function installAccountProfile(page: Page) {
  await page.route("**/v1/me/profile", async (route: Route) => {
    await route.fulfill({
      json: {
        profile: {
          job_title: null,
          organization: null,
          role: null,
          starting_view_version: 1,
          state_code: null,
        },
      },
      status: 200,
    });
  });
}

test("privacy policy states that export and deletion ask for a new sign-in", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "How we protect information" })
  ).toBeVisible();
  await expect(
    page.getByText("before an export or deletion runs")
  ).toBeVisible();
  const results = await new AxeBuilder({ page }).include("main").analyze();
  expect(results.violations).toEqual([]);
});

test("confirming export or deletion asks for sign-in before any privacy request", async ({
  page,
}, testInfo) => {
  const privacyCalls: string[] = [];
  await installAccountProfile(page);
  await page.route("**/v1/me/privacy-requests**", async (route) => {
    privacyCalls.push(`${route.request().method()} ${route.request().url()}`);
    await route.fulfill({ json: { detail: "not reached" }, status: 500 });
  });

  await page.goto("/app/settings");
  await expect(
    page.getByRole("button", { name: "Export my data" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Export my data" }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export my data?" });
  await expect(exportDialog).toBeVisible();
  await exportDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  expect(privacyCalls).toEqual([]);

  await page.getByRole("button", { name: "Remove all data" }).click();
  const deletionDialog = page.getByRole("dialog", { name: "Remove all data?" });
  await deletionDialog.getByRole("button", { name: "Remove all data" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fapp%2Fsettings$/);
  await expect(
    page.getByRole("heading", { name: "Sign in or create an account" })
  ).toBeVisible();
  expect(privacyCalls).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("privacy-reauth-sign-in.png"),
  });

  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Export my data" }).click();
  await page
    .getByRole("dialog", { name: "Export my data?" })
    .getByRole("button", { name: "Export my data" })
    .click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fapp%2Fsettings$/);
  expect(privacyCalls).toEqual([]);
});
