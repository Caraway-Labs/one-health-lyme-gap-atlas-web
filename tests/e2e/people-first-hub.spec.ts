import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("people-first hub front door exposes task paths", async ({
  page,
}, testInfo) => {
  await page.goto("/ux-lab/people-first-hub");
  await expect(
    page.getByRole("heading", { name: /Understand Lyme in the Atlas/i })
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Prototype status" })
  ).toContainText("Atlas UX Prototype — Product research only");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/i
  );
  await expect(page.getByText("Featured path")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Living with Lyme" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Clinician resources" })
  ).toBeVisible();

  if (!testInfo.project.name.includes("mobile")) {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }

  await page.getByRole("link", { name: "Open Living with Lyme" }).click();
  await expect(
    page.getByRole("heading", {
      name: /Ongoing concerns and credible next reads/i,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Living with Lyme" })
  ).toHaveAttribute("aria-current", "page");
});
