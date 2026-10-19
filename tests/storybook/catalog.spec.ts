import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const examples = [
  { id: "primitives-button--primary", text: "Review evidence" },
  { id: "primitives-card--information", text: "Evidence overview" },
  { id: "primitives-input--editable", text: "Geography" },
  { id: "atlas-priority-badge--highest", text: "Highest review priority" },
  {
    id: "atlas-response-tier-pill--six-tiers",
    text: "Continue routine surveillance",
  },
  { id: "atlas-status-message--empty", text: "No evidence in this example" },
  { id: "atlas-data-stamp--snapshot", text: "Illustrative snapshot" },
  {
    id: "atlas-explorer-tick-legend--blacklegged",
    text: "(not zero, not confirmed absence)",
  },
  {
    id: "atlas-explorer-pathogen-legend--burgdorferi",
    text: "(not zero, not confirmed absence)",
  },
];

for (const example of examples) {
  test(`${example.id} renders with Atlas styling, refresh and accessibility`, async ({
    page,
  }, testInfo) => {
    const externalRequests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") {
        await route.continue();
      } else {
        externalRequests.push(url.origin);
        await route.abort();
      }
    });
    await page.goto(`iframe.html?id=${example.id}&viewMode=story`);
    await expect(
      page.getByText(example.text, { exact: false }).first()
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(example.text, { exact: false }).first()
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--teal")
          .trim()
      )
    ).toBe("#0f7782");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(externalRequests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("render.png"),
      fullPage: true,
    });
  });
}

test("keyboard editing, focus and disabled variants work", async ({ page }) => {
  await page.goto("iframe.html?id=primitives-input--editable&viewMode=story");
  const input = page.getByRole("textbox", { name: "Geography" });
  await expect(input).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.type("Example county");
  await expect(input).toHaveValue("Example county");
  await expect(input).not.toHaveCSS("box-shadow", "none");
  await page.goto("iframe.html?id=primitives-button--disabled&viewMode=story");
  await expect(
    page.getByRole("button", { name: "Review evidence" })
  ).toBeDisabled();
});

test("generated documentation renders without duplicate page landmarks", async ({
  page,
}) => {
  await page.goto("iframe.html?id=primitives-button--docs&viewMode=docs");
  await expect(
    page.getByRole("heading", { name: "Button", exact: true })
  ).toBeVisible();
  expect(await page.getByRole("main").count()).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByText("Canonical Base UI action.", { exact: false })
  ).toBeVisible();
});

test("Input Autodocs examples keep their own labels and descriptions", async ({
  page,
}) => {
  await page.goto("iframe.html?id=primitives-input--docs&viewMode=docs");
  await expect(page.locator('input[aria-invalid="true"]')).toBeVisible();
  await expect(
    page
      .getByRole("textbox", { name: "Geography" })
      .filter({ visible: true })
      .first()
  ).toBeVisible();
  const inputs = page.getByRole("textbox", { name: "Geography" });
  expect(await inputs.count()).toBeGreaterThanOrEqual(3);
  const ids = await inputs.evaluateAll((elements) =>
    elements.map((element) => element.id)
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const input of await inputs.all()) {
    const id = await input.getAttribute("id");
    // Compare DOM associations directly so React's generated ID needs no CSS escaping.
    const association = await input.evaluate((element) => {
      const inputElement = element as HTMLInputElement;
      return {
        labels: [...(inputElement.labels ?? [])].map((item) => item.htmlFor),
        help: document.getElementById(
          inputElement.getAttribute("aria-describedby") ?? ""
        )?.textContent,
      };
    });
    expect(association.labels).toEqual([id]);
    const invalid = await input.getAttribute("aria-invalid");
    expect(association.help).toContain(
      invalid === "true"
        ? "Enter a geography to continue"
        : "Local demonstration only"
    );
    if (!(await input.isDisabled())) {
      await input.evaluate((element) =>
        (element as HTMLInputElement).labels?.[0]?.click()
      );
      await expect(input).toBeFocused();
    }
  }
});

test("domain and validation variants preserve semantics", async ({ page }) => {
  await page.goto(
    "iframe.html?id=atlas-status-message--loading&viewMode=story"
  );
  await expect(page.getByRole("status")).toContainText("Loading example");
  await page.goto("iframe.html?id=atlas-status-message--error&viewMode=story");
  await expect(page.getByRole("alert")).toContainText(
    "Example request unavailable"
  );
  await page.goto("iframe.html?id=primitives-input--invalid&viewMode=story");
  await expect(page.getByRole("textbox")).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expect(
    page.getByText("Enter a geography to continue", { exact: false })
  ).toBeVisible();
  await page.goto(
    "iframe.html?id=atlas-priority-badge--moderate&viewMode=story"
  );
  await expect(page.getByText("Moderate review priority")).toBeVisible();
});

test("catalog navigation and controls update the actual component", async ({
  page,
}, testInfo) => {
  await page.goto("?path=/story/primitives-button--primary");
  const canvas = page.frameLocator("#storybook-preview-iframe");
  await expect(
    canvas.getByRole("button", { name: "Review evidence" })
  ).toBeVisible();
  if (testInfo.project.name === "mobile") {
    // Small screens use Storybook's dedicated canvas/controls navigation.
    await page.screenshot({
      path: testInfo.outputPath("catalog.png"),
      fullPage: true,
    });
    return;
  }
  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.locator('[id="control-children"]').fill("Inspect fixture");
  await expect(
    canvas.getByRole("button", { name: "Inspect fixture" })
  ).toBeVisible();
  await page.locator('[id="control-variant"]').selectOption("secondary");
  await expect(
    canvas.getByRole("button", { name: "Inspect fixture" })
  ).toHaveCSS("background-color", "rgb(223, 241, 235)");
  await page.reload();
  await expect(canvas.getByRole("button")).toBeVisible();
});
