import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { aiEthicsContent } from "@/lib/ai-ethics-content";

import {
  publicTrustViewports,
  releaseViewportRuns,
} from "./release-phone-viewport";

const TRUST_ROUTES = [
  {
    heading: "About Caraway Labs",
    path: "/about/caraway-labs",
  },
  {
    heading: "Privacy without the fine print.",
    path: "/privacy",
  },
  {
    heading: "How Atlas approaches AI",
    path: "/ai-ethics",
  },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("public trust pages keep one h1, landmarks, and axe-clean chrome", async ({
  page,
}) => {
  for (const route of TRUST_ROUTES) {
    await page.goto(route.path);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      route.heading
    );
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("link", { name: /Back to Atlas/ })).toHaveCount(
      0
    );
    await expect(page.locator(".privacy-hero, .ethics-hero")).toHaveCount(0);
    await expect(page.locator("main.public-trust-page")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("public trust pages reflow at narrow, mobile, and wide widths", async ({
  page,
}, testInfo) => {
  for (const viewport of publicTrustViewports) {
    if (!releaseViewportRuns(testInfo.project.name, viewport.width)) {
      continue;
    }
    await page.setViewportSize(viewport);
    for (const route of TRUST_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const stacked = viewport.width < 1024;
      if (route.path === "/about/caraway-labs") {
        const tops = await page
          .getByRole("main")
          .getByRole("list")
          .locator(":scope > li")
          .evaluateAll((items) =>
            items.map((item) => item.getBoundingClientRect().top)
          );
        expect(tops).toHaveLength(3);
        if (stacked) {
          expect(tops[1]).toBeGreaterThan(tops[0] ?? 0);
        } else {
          expect(Math.abs((tops[0] ?? 0) - (tops[1] ?? 0))).toBeLessThanOrEqual(
            2
          );
        }
      }
    }
  }
});

async function keyboardFocus(page: Page, control: Locator) {
  for (let step = 0; step < 20; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Disclosure summary was not reached by keyboard");
}

test("AI Ethics status text and disclosures work from the keyboard", async ({
  page,
}) => {
  await page.goto("/ai-ethics");
  await expect(
    page.locator("[data-slot='badge'][data-status='current']")
  ).toHaveText("What Atlas does today");
  await expect(
    page.locator("[data-slot='badge'][data-status='approved-architecture']")
  ).toHaveText("Approved direction; release pending");
  await expect(
    page.locator("[data-slot='badge'][data-status='pending-decision']")
  ).toHaveText("Commitment in development");

  const summaries = page.locator("summary", {
    hasText: "Technical detail and source",
  });
  await expect(summaries).toHaveCount(aiEthicsContent.statements.length);

  for (const [index, statement] of aiEthicsContent.statements.entries()) {
    const summary = summaries.nth(index);
    const panel = summary.locator("xpath=ancestor::details[1]");
    await expect(panel).toHaveJSProperty("open", false);
    await keyboardFocus(page, summary);
    await expect(summary).toBeFocused();
    const focusCue = await summary.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusCue.outlineStyle).toBe("solid");
    expect(focusCue.outlineWidth).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Enter");
    await expect(panel).toHaveJSProperty("open", true);
    await expect(panel.getByText(statement.detail)).toBeVisible();
    await expect(panel.getByText(`Basis: ${statement.evidence}`)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(panel).toHaveJSProperty("open", false);
    await expect(panel.getByText(statement.detail)).toBeHidden();
  }
});

test("trust pages keep policy text and reflow at 200% zoom", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByText(
      "We do not sell, rent, or share personal data for advertising, audience targeting, or commercial behavioral profiling."
    )
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to the Atlas" })
  ).toHaveAttribute("href", "/overview#atlas");

  await page.goto("/ai-ethics");
  await expect(
    page.getByText(
      "A pending decision is not a policy, safeguard, or promise. Atlas will update this page after each substantive decision is made and reviewed."
    )
  ).toHaveCount(1);

  for (const route of TRUST_ROUTES) {
    await page.goto(route.path);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    const zoomOverflow = await page.locator("main").evaluate((main) => {
      const box = main.getBoundingClientRect();
      return box.width > document.documentElement.clientWidth + 1;
    });
    expect(zoomOverflow).toBeFalsy();
    await page.evaluate(() => {
      document.documentElement.style.zoom = "";
    });
  }
});
