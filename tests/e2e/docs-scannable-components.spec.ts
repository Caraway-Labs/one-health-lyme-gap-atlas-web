import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const match = /rgba?\((?<red>\d+),\s*(?<green>\d+),\s*(?<blue>\d+)/u.exec(
      color
    );
    if (!match?.groups) {
      throw new Error(`Unparsed color ${color}`);
    }
    const channel = (value: string): number => {
      const scaled = Number(value) / 255;
      return scaled <= 0.040_45
        ? scaled / 12.92
        : ((scaled + 0.055) / 1.055) ** 2.4;
    };
    const red = channel(match.groups.red);
    const green = channel(match.groups.green);
    const blue = channel(match.groups.blue);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function textContrast(
  page: Page,
  sampleText: string
): Promise<{ background: string; color: string; ratio: number }> {
  const sample = page.getByText(sampleText, { exact: false }).first();
  const colors = await sample.evaluate((element) => {
    const style = getComputedStyle(element);
    let background = style.backgroundColor;
    let node: Element | null = element;
    while (
      node &&
      (background === "transparent" || background === "rgba(0, 0, 0, 0)")
    ) {
      node = node.parentElement;
      if (node) background = getComputedStyle(node).backgroundColor;
    }
    return { background, color: style.color };
  });
  return { ...colors, ratio: contrastRatio(colors.color, colors.background) };
}

async function expectNoBlockingAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).include("main").analyze();
  const blockingViolations = results.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? "")
  );
  expect(blockingViolations).toEqual([]);
}

test("guide cards are named links and open from the keyboard", async ({
  page,
}) => {
  await page.goto("/docs/develop");
  const card = page.locator("main").getByRole("link", {
    name: "Quickstart Finish one county observation read",
  });
  await expect(card).toBeVisible();
  await card.evaluate((element) => {
    if (!(element instanceof HTMLElement)) return;
    element.focus({ focusVisible: true } as FocusOptions);
  });
  await expect(card).toBeFocused();
  const outline = await card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).not.toBe("0px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/develop\/quickstart\/?$/);
  await expectNoBlockingAxeViolations(page);
});

test("availability accordions expand and collapse from the keyboard", async ({
  page,
}) => {
  await page.goto("/docs/develop/tier1-availability");
  const trigger = page.getByRole("button", {
    name: "Membership and a published model, or not",
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText(
      "GET /v1/counties/{fips}/tier1-surveillance-priority/availability"
    )
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByText(
      "GET /v1/counties/{fips}/tier1-surveillance-priority/availability"
    )
  ).toBeHidden();
  await expectNoBlockingAxeViolations(page);
});

test("Interpret with care callout text meets 4.5:1 contrast", async ({
  page,
}) => {
  await page.goto("/docs/develop");
  const title = await textContrast(page, "Interpret with care");
  const body = await textContrast(
    page,
    "Atlas results are not a diagnosis. Atlas results are not an estimate of an individual's risk."
  );
  expect(title.ratio).toBeGreaterThanOrEqual(4.5);
  expect(body.ratio).toBeGreaterThanOrEqual(4.5);

  await page.goto("/docs/develop/mcp-clients");
  const guardrail = await textContrast(page, "Missing is not zero.");
  expect(guardrail.ratio).toBeGreaterThanOrEqual(4.5);
  await expectNoBlockingAxeViolations(page);
});
