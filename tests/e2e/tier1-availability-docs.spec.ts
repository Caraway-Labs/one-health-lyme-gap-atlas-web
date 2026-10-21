import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { releaseViewportRuns } from "./release-phone-viewport";

test("renders the Tier 1 availability decision guide", async ({
  page,
}, testInfo) => {
  await page.goto("/docs/develop");
  await page
    .locator("main")
    .getByRole("link", { name: "Tier 1 availability", exact: true })
    .click();
  await expect(page).toHaveURL(/\/docs\/develop\/tier1-availability\/?$/);
  await expect(
    page.getByRole("heading", { name: "Tier 1 availability", exact: true })
  ).toBeVisible();
  await expect(page).toHaveTitle(
    /Tier 1 availability \| One Health Atlas documentation/
  );
  await expect(page.locator(".app-shell")).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "When to call each route", exact: true })
  ).toBeVisible();
  await expect(page.getByText("AVAILABLE").first()).toBeVisible();
  await expect(page.getByText("09110").first()).toBeVisible();
  await expect(page.getByText("SUFFICIENT").first()).toBeVisible();
  await expect(page.getByText("INSUFFICIENT").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "NOT_ESTIMABLE abstention", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "UNAVAILABLE and NO_PUBLISHED_MODEL",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText("County is not in the current geography release.").first()
  ).toBeVisible();
  await expect(
    page.getByText(
      "surveillance review priority, not Lyme disease risk, predicted incidence, probability, clinical risk, or diagnosis."
    )
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("tier1-availability-page.png"),
  });
  await page
    .getByRole("table")
    .first()
    .screenshot({
      path: testInfo.outputPath("tier1-availability-decision.png"),
    });
  await page
    .getByRole("table")
    .last()
    .screenshot({
      path: testInfo.outputPath("tier1-availability-states.png"),
    });
});

test("keeps the Tier 1 availability heading reachable at 375px", async ({
  page,
}, testInfo) => {
  test.skip(
    !releaseViewportRuns(testInfo.project.name, 375),
    "Phone-width docs run on the mobile project."
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/docs/develop/tier1-availability");
  await expect(
    page.getByRole("heading", { name: "Tier 1 availability", exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("tier1-availability-phone.png"),
  });
});
