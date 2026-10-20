import { expect, type Locator, type Page } from "@playwright/test";

const PROFESSIONAL_SHELL = ".ux-reset-pro-app";
const STARTING_VIEW_STATUS = "Connecting the data.";

/**
 * The starting-view gate keeps workspace actions unmounted until the profile
 * read classifies the account. Branching on sidebar visibility before that
 * shell exists treats desktop as a closed phone drawer.
 */
export async function expectProfessionalShellReady(page: Page): Promise<void> {
  await expect(page.locator(PROFESSIONAL_SHELL)).toBeVisible();
  await expect(page.getByText(STARTING_VIEW_STATUS)).toHaveCount(0);
}

/**
 * Desktop leaves the sidebar available. A phone viewport shows Ask Atlas only
 * after Open navigation. Click that control only when it is visible, then wait
 * until the requested item can be used.
 */
export async function revealProfessionalNavigationLink(
  page: Page,
  link: Locator
): Promise<Locator> {
  await expectProfessionalShellReady(page);
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  if (await openNavigation.isVisible()) {
    await openNavigation.click();
  }
  await expect(link).toBeVisible();
  return link;
}
