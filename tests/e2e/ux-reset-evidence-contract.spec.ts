import { execSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const REVIEWED_HEAD_SHA = execSync("git rev-parse HEAD", {
  encoding: "utf-8",
}).trim();

const CDC_SOURCE_URL = "https://cdc.gov";
const EVIDENCE_DOCS_HEADING = "Evidence, provenance, and uncertainty";

function hostnameWithoutWww(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

async function tabUntilFocused(
  page: Page,
  isTargetFocused: () => Promise<boolean>,
  maxSteps = 24
): Promise<void> {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await isTargetFocused()) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab navigation did not reach the expected focus target.");
}

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
  await expect(sourceLink).toHaveAttribute("href", CDC_SOURCE_URL);
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");

  await tabUntilFocused(page, async () =>
    sourceLink.evaluate((node) => node === document.activeElement)
  );
  await expect(sourceLink).toBeFocused();

  const sourcePopupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const sourcePopup = await sourcePopupPromise;
  await sourcePopup.waitForLoadState("domcontentloaded");
  expect(hostnameWithoutWww(sourcePopup.url())).toBe(
    hostnameWithoutWww(CDC_SOURCE_URL)
  );

  const technical = specimen.locator(
    "details.ux-reset-evidence-provenance-technical"
  );
  const technicalSummary = technical.locator("summary", {
    hasText: "Technical reproducibility identifiers",
  });
  await technicalSummary.focus();
  await page.keyboard.press("Enter");
  await expect(technical).toHaveAttribute("open", "");

  const docsLink = specimen.getByRole("link", { name: /Atlas documentation/ });
  await expect(docsLink).toHaveAttribute(
    "href",
    /\/docs\/evidence-and-uncertainty\/?$/
  );
  await expect(docsLink).toHaveAttribute("target", "_blank");
  await expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");

  await tabUntilFocused(page, async () =>
    docsLink.evaluate((node) => node === document.activeElement)
  );
  await expect(docsLink).toBeFocused();

  const docsPopupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const docsPopup = await docsPopupPromise;
  await docsPopup.waitForLoadState("domcontentloaded");
  await expect(docsPopup).toHaveURL(/\/docs\/evidence-and-uncertainty\/?$/);
  await expect(
    docsPopup.getByRole("heading", { name: EVIDENCE_DOCS_HEADING })
  ).toBeVisible();

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
