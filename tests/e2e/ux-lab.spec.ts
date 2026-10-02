import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const UX_LAB_CONCEPT_COUNT = 7;

const CONCEPT_ROUTES = [
  "/ux-lab/persona-gateway",
  "/ux-lab/public-first",
  "/ux-lab/three-lanes",
  "/ux-lab/geography-first",
  "/ux-lab/geography-first-v2",
  "/ux-lab/public-site-pro-app",
  "/ux-lab/people-first-hub",
] as const;

const GEOGRAPHY_FIRST_V2_WORKSHOP_ROUTES = [
  {
    href: "/ux-lab/geography-first-v2?place=ridge-sample-county",
    label: "Geography-First v2 · Ridge Sample County (public)",
  },
  {
    href: "/ux-lab/geography-first-v2/clinicians?place=ridge-sample-county",
    label: "Geography-First v2 · Ridge Sample County (clinicians)",
  },
  {
    href: "/ux-lab/geography-first-v2/evidence?place=ridge-sample-county",
    label: "Geography-First v2 · Ridge Sample County (evidence)",
  },
  {
    href: "/ux-lab/geography-first-v2?place=meadow-sample-town",
    label: "Geography-First v2 · Meadow Sample Town (public)",
  },
  {
    href: "/ux-lab/geography-first-v2/clinicians?place=meadow-sample-town",
    label: "Geography-First v2 · Meadow Sample Town (clinicians)",
  },
  {
    href: "/ux-lab/geography-first-v2/evidence?place=meadow-sample-town",
    label: "Geography-First v2 · Meadow Sample Town (evidence)",
  },
] as const;

test("loads the UX Lab outside production navigation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /UX Lab/i })).toHaveCount(0);

  await page.goto("/ux-lab");
  await expect(
    page.getByRole("heading", { name: "Atlas UX Lab" })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Prototype status" })
  ).toContainText("Atlas UX Prototype — Product research only");
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" })
  ).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i
  );
  await expect(
    page.getByRole("heading", { name: "Persona Gateway" })
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Shared sample content" })
    .scrollIntoViewIfNeeded();
  const sharedSampleSection = page.locator(
    'section[aria-labelledby="ux-lab-sample"]'
  );
  await expect(
    sharedSampleSection.getByText(/Fictional Sample County stands in/)
  ).toBeVisible();

  await page.getByRole("link", { name: "UX Lab index" }).focus();
  await expect(page.getByRole("link", { name: "UX Lab index" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Production Atlas" })
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);

  await expect(
    page.getByRole("heading", { name: "Comparison guide" })
  ).toBeVisible();
  await expect(page.getByText("What this variant is testing.")).toHaveCount(
    UX_LAB_CONCEPT_COUNT
  );
  await expect(
    page.getByRole("link", { name: "Open Geography-First v2" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open People-First Atlas Hub" })
  ).toBeVisible();
  await expect(page.getByText("Second-round research concept")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Prototype limits" })
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Session routes" })
  ).toBeVisible();
  for (const route of GEOGRAPHY_FIRST_V2_WORKSHOP_ROUTES) {
    await expect(page.getByRole("link", { name: route.label })).toHaveAttribute(
      "href",
      route.href
    );
  }

  for (const route of CONCEPT_ROUTES) {
    await page.goto(route);
    await expect(
      page.getByRole("region", { name: "Prototype status" })
    ).toContainText("Atlas UX Prototype — Product research only");
    await expect(
      page.getByRole("complementary", { name: "What this variant is testing" })
    ).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    if (!testInfo.project.name.includes("mobile")) {
      const conceptResults = await new AxeBuilder({ page }).analyze();
      expect(conceptResults.violations).toEqual([]);
    }
  }

  for (const route of GEOGRAPHY_FIRST_V2_WORKSHOP_ROUTES) {
    await page.goto(route.href);
    await expect(
      page.getByRole("region", { name: "Prototype status" })
    ).toContainText("Atlas UX Prototype — Product research only");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/i
    );
    if (route.href.includes("/clinicians")) {
      await expect(
        page.getByText(/Not clinical care direction/i)
      ).toBeVisible();
    } else if (route.href.includes("/evidence")) {
      await expect(
        page.getByRole("heading", { name: "State / regional review entry" })
      ).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  }

  if (!testInfo.project.name.includes("mobile")) {
    await page.goto("/ux-lab");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});
