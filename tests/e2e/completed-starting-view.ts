import type { Page } from "@playwright/test";

/** Workspace specs that do not exercise setup still need a completed read. */
export async function fulfillCompletedStartingView(page: Page) {
  await page.route("**/v1/me/profile", async (route) => {
    await route.fulfill({
      json: { profile: { starting_view_version: 1, state_code: null } },
      status: 200,
    });
  });
}
