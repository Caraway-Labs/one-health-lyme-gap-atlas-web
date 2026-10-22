import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
    heading: "How Atlas uses AI and machine learning",
    path: "/ai-ethics",
  },
  {
    heading: "Where Atlas evidence comes from",
    path: "/data-provenance",
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
  for (let step = 0; step < 40; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("AI Ethics link was not reached by keyboard");
}

test("Data Provenance filter is operable from the keyboard", async ({
  page,
}) => {
  await page.goto("/data-provenance");
  const bulletins = page.getByRole("button", {
    name: "Public-health bulletins (10)",
  });
  await keyboardFocus(page, bulletins);
  await expect(bulletins).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(bulletins).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Showing 10 of 20 sources")).toBeVisible();
  await expect(page.locator("#source-cdc-mmwr")).toBeVisible();
  await expect(page.locator("#source-human")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Return to the Atlas" })
  ).toHaveAttribute("href", "/overview#atlas");
});

test("AI Ethics copy is public and its links are reachable from the keyboard", async ({
  page,
}) => {
  await page.goto("/ai-ethics");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "How Atlas uses AI and machine learning",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Understand the evidence" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Find patterns worth investigating",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Bring evidence into other workflows",
    })
  ).toBeVisible();
  await expect(page.locator("[data-slot='badge']")).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(0);
  await expect(page.getByText("Commitments in development")).toHaveCount(0);
  await expect(
    page.getByText(
      "It is not a trained machine-learning model, and it does not predict disease."
    )
  ).toBeVisible();

  const methods = page.getByRole("link", { name: "data and methods" });
  await keyboardFocus(page, methods);
  await expect(methods).toBeFocused();
  const focusCue = await methods.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusCue.outlineStyle).toBe("solid");
  expect(focusCue.outlineWidth).toBeGreaterThanOrEqual(2);
  await expect(methods).toHaveAttribute(
    "href",
    "/docs/releases-and-methodology"
  );
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
      "Atlas is not a clinical service. It does not diagnose illness or provide treatment advice."
    )
  ).toBeVisible();
  await expect(
    page.getByText("Ordinary pull-request review for this initial release.")
  ).toHaveCount(0);

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
