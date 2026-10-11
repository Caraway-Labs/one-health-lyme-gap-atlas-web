import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_TRUST_ROUTES = ["/about/caraway-labs", "/ai-ethics", "/privacy"];

test("public trust pages share the unauthenticated footer", async ({
  page,
}, testInfo) => {
  for (const route of PUBLIC_TRUST_ROUTES) {
    await page.goto(route);
    await expect(page).not.toHaveURL(/sign-in/);
    await expect(
      page.getByRole("link", { exact: true, name: "Back to Atlas" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Back to Atlas ↑" })
    ).toHaveCount(0);

    const identity = page.getByRole("banner").getByRole("link", {
      name: "One Health Lyme Gap Atlas home",
    });
    await expect(identity).toBeVisible();
    await expect(identity.locator("img.atlas-brand-mark")).toHaveCount(1);

    const footer = page.locator("footer.ux-reset-trust-footer");
    await expect(footer).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Privacy", exact: true })
    ).toHaveAttribute("href", "/privacy");
    const ethics = footer.getByRole("link", { name: "AI / Responsible Use" });
    await expect(ethics).toHaveAttribute("href", "/ai-ethics");
    await expect(ethics).not.toHaveAttribute("target", "_blank");
    await expect(
      footer.getByRole("button", { name: "Privacy settings" })
    ).toBeVisible();
    await expect(footer.locator("img.atlas-brand-mark")).toHaveCount(0);

    const feedback = footer.getByRole("button", {
      name: "Feedback",
      exact: true,
    });
    if (route === "/about/caraway-labs") {
      await expect(feedback).toHaveCount(0);
    } else {
      await feedback.scrollIntoViewIfNeeded();
      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveAttribute(
        "data-atlas-analytics-control",
        "feedback_footer_open"
      );
      const box = await feedback.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(
        (viewport?.height ?? 0) + 1
      );
      if (testInfo.project.name === "mobile") {
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await feedback.click();
      await expect(
        page.getByRole("dialog", { name: "Send feedback" })
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }

  await page.goto("/privacy");
  const ethicsLink = page
    .locator("footer.ux-reset-trust-footer")
    .getByRole("link", { name: "AI / Responsible Use" });
  await ethicsLink.focus();
  await expect(ethicsLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ai-ethics$/);
  await expect(
    page.getByRole("heading", { name: "How Atlas approaches AI" })
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
