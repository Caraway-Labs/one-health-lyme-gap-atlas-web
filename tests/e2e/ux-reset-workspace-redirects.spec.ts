import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const DESTINATION_LABELS = [
  "Atlas Explorer",
  "Compare",
  "Ask Atlas",
  "Feed",
  "Settings",
  "Docs, opens in a new tab",
] as const;

test.describe("six-destination redirects", () => {
  test("sidebar lists the six destinations and old routes redirect once", async ({
    page,
  }) => {
    await page.goto("/app/review?scope=CO");
    const nav = page.locator("nav[aria-label='Professional workspace']");
    const links = nav.locator("a");
    await expect(links).toHaveCount(6);
    const labels = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label"))
    );
    expect(labels).toEqual([...DESTINATION_LABELS]);

    const brand = page.getByRole("link", {
      exact: true,
      name: "One Health Atlas",
    });
    await expect(brand).toHaveAttribute("href", /\/app\/review/);

    const cases = [
      ["/app", "/app/review"],
      [
        "/app/explore?scope=NY&county=36061",
        "/app/review?scope=NY&county=36061",
      ],
      [
        "/app/investigate?county=08001",
        "/app/review?county=08001&mode=evidence",
      ],
      ["/app/investigate", "/app/review"],
      ["/app/action?county=08001", "/app/review?county=08001&mode=follow-up"],
      ["/overview?state=CO&county=08001", "/app/review?scope=CO&county=08001"],
      ["/investigate?county=not-a-county", "/app/review?selection=required"],
      ["/geographic_explorer?metric=score", "/app/review"],
    ] as const;

    for (const [source, target] of cases) {
      await page.goto(source, { waitUntil: "commit" });
      await expect
        .poll(() => page.url(), { timeout: 15_000 })
        .toContain(target);
      expect(new URL(page.url()).pathname).not.toBe("/app/explore");
      expect(new URL(page.url()).pathname).not.toBe("/app/investigate");
      expect(new URL(page.url()).pathname).not.toBe("/app/action");
      expect(new URL(page.url()).searchParams.get("county")).not.toBe("06037");
    }

    await page.goto("/app/review");
    await page.goto("/app/explore?county=08013&scope=CO", {
      waitUntil: "commit",
    });
    await expect(page).toHaveURL(/\/app\/review\?.*county=08013/);
    await page.goBack();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
      .toBe("/app/review");
    expect(new URL(page.url()).pathname).not.toBe("/app/explore");

    await page.goto("/app/compare?compare=08001,08013");
    await expect(page).toHaveURL(
      /\/app\/compare\?compare=08001%2C08013|08001,08013/
    );
    await page.goto("/app/assistant");
    await expect(page).toHaveURL(/\/app\/assistant\/?$/);
    await page.goto("/app/review");
    const results = await new AxeBuilder({ page })
      .include("#ux-reset-pro-navigation")
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
