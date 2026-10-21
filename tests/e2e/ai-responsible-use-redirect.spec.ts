import { expect, test } from "@playwright/test";

import { fulfillCompletedStartingView } from "./completed-starting-view";

const RETIRED_PATH = "/app/ai-responsible-use";
const AI_ETHICS_HEADING = "How Atlas uses AI and machine learning";

test.beforeEach(async ({ page }) => {
  await fulfillCompletedStartingView(page);
});

function locationPathname(location: string | undefined): string {
  if (!location) {
    return "";
  }
  return new URL(location, "http://127.0.0.1:3100").pathname;
}

test("permanently redirects signed-out and signed-in visits to AI ethics", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  const signedOut = await page.request.get(RETIRED_PATH, {
    maxRedirects: 0,
  });
  const signedOutLocation = signedOut.headers().location;
  expect(signedOut.status()).toBe(308);
  expect(signedOutLocation?.endsWith("/ai-ethics")).toBeTruthy();
  expect(locationPathname(signedOutLocation)).toBe("/ai-ethics");
  expect(signedOutLocation).not.toContain("sign-in");

  const signedOutQuery = await page.request.get(
    `${RETIRED_PATH}?from=bookmark`,
    { maxRedirects: 0 }
  );
  expect(signedOutQuery.status()).toBe(308);
  expect(locationPathname(signedOutQuery.headers().location)).toBe(
    "/ai-ethics"
  );
  expect(signedOutQuery.headers().location).toContain("from=bookmark");
  expect(signedOutQuery.headers().location).not.toContain("sign-in");

  const trailingSlash = await page.request.get(`${RETIRED_PATH}/`, {
    maxRedirects: 0,
  });
  expect([301, 308]).toContain(trailingSlash.status());
  expect(trailingSlash.headers().location).not.toContain("sign-in");
  const trailingSlashPath = locationPathname(trailingSlash.headers().location);
  const trailingSlashLanded =
    trailingSlashPath === "/ai-ethics"
      ? trailingSlash
      : await page.request.get(trailingSlash.headers().location ?? "", {
          maxRedirects: 0,
        });
  expect([301, 308]).toContain(trailingSlashLanded.status());
  expect(locationPathname(trailingSlashLanded.headers().location)).toBe(
    "/ai-ethics"
  );
  expect(trailingSlashLanded.headers().location).not.toContain("sign-in");

  await context.addCookies([
    {
      name: "sb-access-token",
      url: "http://127.0.0.1:3100",
      value: "signed-in-session",
    },
  ]);
  const signedIn = await page.request.get(`${RETIRED_PATH}?from=workspace`, {
    maxRedirects: 0,
  });
  const signedInLocation = signedIn.headers().location;
  expect(signedIn.status()).toBe(308);
  expect(locationPathname(signedInLocation)).toBe("/ai-ethics");
  expect(signedInLocation).toContain("from=workspace");
  expect(signedInLocation).not.toContain("sign-in");

  await page.goto(`${RETIRED_PATH}/`);
  await expect(page).toHaveURL(/\/ai-ethics$/);
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { level: 1, name: AI_ETHICS_HEADING })
  ).toBeVisible();

  await context.clearCookies();
  await page.goto(RETIRED_PATH);
  await expect(page).toHaveURL(/\/ai-ethics$/);
  await expect(page).not.toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { level: 1, name: AI_ETHICS_HEADING })
  ).toBeVisible();
});

test("does not render an in-app link to the retired AI page", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(page).not.toHaveURL(/sign-in/);
  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByRole("link", { name: "AI / Responsible Use" })
  ).toHaveAttribute("href", "/ai-ethics");

  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? "")
    );
  expect(hrefs.some((href) => href.includes(RETIRED_PATH))).toBeFalsy();
});
