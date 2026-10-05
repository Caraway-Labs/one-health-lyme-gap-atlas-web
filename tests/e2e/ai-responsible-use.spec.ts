import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function focusByTab(page: Page, control: Locator) {
  for (let step = 0; step < 80; step += 1) {
    if (
      await control.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("control was not reached by keyboard");
}

test("opens AI / Responsible Use from the professional footer and keeps the shell", async ({
  page,
}, testInfo) => {
  await page.goto("/app/review");
  const footer = page.getByRole("contentinfo");
  const entry = footer.getByRole("link", { name: "AI / Responsible Use" });
  await expect(entry).toHaveAttribute("href", "/app/ai-responsible-use");
  await entry.click();

  await expect(page).toHaveURL(/\/app\/ai-responsible-use$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "AI / Responsible Use" })
  ).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Professional workspace" })
  ).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/app\/ai-responsible-use$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "AI / Responsible Use" })
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);

  for (const label of [
    "Current",
    "Experimental",
    "In development",
    "Planned",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Available now")).toHaveCount(0);
  await expect(
    page.getByText(
      /separate from the evidence labels Available, Limited, and Unavailable/i
    )
  ).toBeVisible();

  const docs = page.getByRole("navigation", { name: "Deeper documentation" });
  const methods = docs.getByRole("link", {
    name: "AI-enabled decision intelligence (opens in a new tab)",
  });
  await docs.scrollIntoViewIfNeeded();
  await focusByTab(page, methods);
  await expect(methods).toBeFocused();
  await expect(methods).toHaveAttribute(
    "href",
    "/docs/ai-enabled-decision-intelligence"
  );

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.screenshot({
    path: testInfo.outputPath("ai-responsible-use-authenticated.png"),
  });
});
