import { expect, test } from "@playwright/test";

test.describe("Action bookmarks open Atlas Explorer follow-up", () => {
  test("one valid county opens suggested follow-up", async ({ page }) => {
    await page.goto("/app/action?county=08001&scope=CO&dataset=alpha-2026");
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(/mode=follow-up/);
    await expect(page).toHaveURL(/county=08001/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page).toHaveURL(/dataset=alpha-2026/);
    await expect(page.getByTestId("action-workspace")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Action" })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("county")).not.toBe("06037");
  });

  test("an evidence brief stays on Action", async ({ page }) => {
    await page.goto(
      "/app/action?county=08001&scope=CO&dataset=alpha-2026&plan=evidence-brief"
    );
    await expect(page).toHaveURL(/\/app\/action/);
    await expect(page).toHaveURL(/plan=evidence-brief/);
    await expect(page).not.toHaveURL(/\/app\/review/);
    await expect(page.getByTestId("action-evidence-brief")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("county")).toBe("08001");
  });

  test("a bookmark without one county stays on browse", async ({ page }) => {
    await page.goto("/app/action?scope=CO");
    await expect(page).toHaveURL(/\/app\/review/);
    await expect(page).toHaveURL(/scope=CO/);
    await expect(page).not.toHaveURL(/mode=/);
    await expect(page.getByTestId("action-workspace")).toHaveCount(0);
  });
});
