import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("runs the docs API playground for a success and an error", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/docs/develop/quickstart");
  await expect(
    page.getByRole("heading", { name: "Try this request", exact: true })
  ).toBeVisible();

  const playground = page.locator("[data-slot=card]").filter({
    has: page.getByRole("form", { name: "API playground" }),
  });
  await expect(playground).toBeVisible();
  await expect(playground.getByLabel("Measure id")).toHaveValue(
    "case_count_floor_2023"
  );
  await expect(
    playground.getByRole("combobox", { name: "Endpoint" })
  ).toContainText("GET /v1/observations");
  await expect(playground.getByLabel("Geography id")).toHaveValue("36061");
  await expect(playground.getByRole("status")).toHaveText(
    "No request sent yet."
  );

  const idleResults = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    idleResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    )
  ).toEqual([]);

  await playground.getByRole("button", { name: "Send request" }).click();
  await expect(playground.getByRole("status")).toContainText("HTTP 200", {
    timeout: 30_000,
  });
  const success = page.getByRole("region", { name: "API response" });
  await expect(success.getByText("200", { exact: true })).toBeVisible();
  await expect(success).toContainText("Cache-Control");
  await expect(success).toContainText("application/json");
  await expect(success).toContainText("36061");
  await expect(success).toContainText("value_state");

  await playground.getByRole("combobox", { name: "Example" }).click();
  await page
    .getByRole("option", { name: "Unsupported geography type" })
    .click();
  await expect(playground.getByLabel("Geography type")).toHaveValue("tract");
  await playground.getByRole("button", { name: "Send request" }).focus();
  await page.keyboard.press("Enter");
  await expect(playground.getByRole("status")).toContainText("HTTP 400", {
    timeout: 30_000,
  });
  const failure = page.getByRole("region", { name: "API response" });
  await expect(failure.getByText("400", { exact: true })).toBeVisible();
  await expect(failure).toContainText("INVALID_REQUEST");
  await expect(failure).toContainText("application/problem+json");

  const errorResults = await new AxeBuilder({ page }).include("main").analyze();
  expect(
    errorResults.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    )
  ).toEqual([]);
});
