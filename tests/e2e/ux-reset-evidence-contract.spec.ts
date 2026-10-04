import { execSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const REVIEWED_HEAD_SHA = execSync("git rev-parse HEAD", {
  encoding: "utf-8",
}).trim();

/**
 * Bounded browser verification for UX Reset evidence provenance on /design-system.
 * Targets the EvidenceObject specimen only (not unrelated gallery controls).
 */
test("ux-reset evidence provenance keyboard, expanded axe, and doc/source links", async ({
  page,
}, testInfo) => {
  await page.goto("/design-system");
  const specimen = page.getByTestId("ux-reset-evidence-object").first();
  await specimen.scrollIntoViewIfNeeded();

  const provenance = specimen.locator("details.ux-reset-evidence-provenance");
  const summary = provenance.locator("summary", {
    hasText: "Inspect provenance",
  });

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(provenance).toHaveAttribute("open", "");

  await summary.focus();
  await page.keyboard.press("Space");
  await expect(provenance).not.toHaveAttribute("open", "");

  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(provenance).toHaveAttribute("open", "");

  await expect(
    specimen.getByText("Governed limitations", { exact: false })
  ).toBeVisible();

  const sourceLink = specimen.getByRole("link", {
    name: /Open source reference/,
  });
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute("href", "https://cdc.gov");

  let focusedSource = false;
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(
      () => document.activeElement?.textContent?.trim() ?? ""
    );
    if (label.includes("Open source reference")) {
      focusedSource = true;
      break;
    }
  }
  expect(focusedSource).toBe(true);

  await specimen.getByText("Technical reproducibility identifiers").click();
  const docsLink = specimen.getByRole("link", { name: /Atlas documentation/ });
  let focusedDocs = false;
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const href = await page.evaluate(
      () => (document.activeElement as HTMLAnchorElement | null)?.href ?? ""
    );
    if (href.includes("/docs/evidence-and-uncertainty")) {
      focusedDocs = true;
      break;
    }
  }
  expect(focusedDocs).toBe(true);
  await expect(docsLink).toHaveAttribute(
    "href",
    /\/docs\/evidence-and-uncertainty$/
  );

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page })
      .include(".ux-reset-evidence-provenance[open]")
      .analyze();
    expect(results.violations).toEqual([]);
  }

  await test.info().attach("ux-reset-evidence-contract-head-sha", {
    body: `surface=/design-system specimen data-testid=ux-reset-evidence-object head=${REVIEWED_HEAD_SHA}`,
    contentType: "text/plain",
  });
});
