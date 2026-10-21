import { expect, type Page } from "@playwright/test";

/**
 * The Explorer rail shows one panel at a time. Choosing a county opens the
 * County tab, so a spec that picks another county from the list must show
 * the List tab first.
 */
export async function showCountyList(page: Page): Promise<void> {
  const tab = page.getByTestId("explorer-rail-tab-list");
  // A county from the URL opens the County tab once the directory loads, so
  // keep choosing the list until it stays selected.
  await expect(async () => {
    if ((await tab.getAttribute("aria-selected")) !== "true") {
      await tab.click({ timeout: 1000 });
    }
    await expect(tab).toHaveAttribute("aria-selected", "true", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}

export async function showSelectedCounty(page: Page): Promise<void> {
  const tab = page.getByTestId("explorer-rail-tab-county");
  await expect(async () => {
    if ((await tab.getAttribute("aria-selected")) !== "true") {
      await tab.click({ timeout: 1000 });
    }
    await expect(tab).toHaveAttribute("aria-selected", "true", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
}
/** The county summary keeps rationale rows behind one disclosure. */
export async function openEvidenceDisclosure(page: Page): Promise<void> {
  await showSelectedCounty(page);
  const trigger = page.getByRole("button", {
    name: "Evidence behind this review",
  });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
}

/** Opens the Export menu and chooses the county list CSV. */
export async function clickCsvExport(page: Page): Promise<void> {
  await page.getByTestId("explorer-export-menu").click();
  await page.getByTestId("explorer-download-counties").click();
}
