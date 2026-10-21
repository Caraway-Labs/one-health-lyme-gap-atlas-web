import { expect, type Page } from "@playwright/test";

/**
 * The Explorer rail shows one panel at a time. Choosing a county opens the
 * County tab, so a spec that picks another county from the list must show
 * the List tab first.
 */
export async function showCountyList(page: Page): Promise<void> {
  const tab = page.getByTestId("explorer-rail-tab-list");
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await tab.click();
  }
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

export async function showSelectedCounty(page: Page): Promise<void> {
  const tab = page.getByTestId("explorer-rail-tab-county");
  if ((await tab.getAttribute("aria-selected")) !== "true") {
    await tab.click();
  }
  await expect(tab).toHaveAttribute("aria-selected", "true");
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
