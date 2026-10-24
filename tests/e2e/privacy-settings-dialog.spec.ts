import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_WIDTHS = [768, 1024, 1280, 1440] as const;
const PUBLIC_SURFACES = ["/", "/privacy"] as const;
const FOCUS_RING_INSET_PX = 4;

type ContainmentReport = {
  clientWidth: number;
  overflowing: string[];
  scrollWidth: number;
};

async function openPrivacySettings(page: Page): Promise<Locator> {
  const trigger = page.getByRole("button", { name: "Privacy settings" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Privacy settings" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function dialogContainment(dialog: Locator): Promise<ContainmentReport> {
  return dialog.evaluate((element, focusRingInset) => {
    const dialogRect = element.getBoundingClientRect();
    const overflowing: string[] = [];
    const inspect = (node: Element, label: string) => {
      const rect = node.getBoundingClientRect();
      const sticksOut =
        rect.left < dialogRect.left - 1 ||
        rect.right > dialogRect.right + 1 ||
        rect.top < dialogRect.top - 1 ||
        rect.bottom > dialogRect.bottom + 1;
      const clipsText =
        node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1;
      if (sticksOut || clipsText) {
        overflowing.push(label);
      }
    };

    inspect(element, "dialog");
    const footer = element.querySelector("[data-slot='dialog-footer']");
    if (footer) {
      inspect(footer, "footer");
    } else {
      overflowing.push("footer-missing");
    }
    const description = element.querySelector(
      "[data-slot='dialog-description']"
    );
    if (description) {
      inspect(description, "description");
    } else {
      overflowing.push("description-missing");
    }
    for (const paragraph of element.querySelectorAll("p")) {
      inspect(paragraph, `copy:${paragraph.textContent?.slice(0, 32) ?? ""}`);
    }
    const buttons = [...element.querySelectorAll("button")];
    if (buttons.length < 3) {
      overflowing.push("buttons-missing");
    }
    for (const button of buttons) {
      const label = button.textContent?.trim() || "button";
      inspect(button, label);
      const rect = button.getBoundingClientRect();
      const inset = Math.min(
        rect.left - dialogRect.left,
        dialogRect.right - rect.right,
        rect.top - dialogRect.top,
        dialogRect.bottom - rect.bottom
      );
      if (inset < focusRingInset) {
        overflowing.push(`focus-ring:${label}`);
      }
    }

    return {
      clientWidth: element.clientWidth,
      overflowing,
      scrollWidth: element.scrollWidth,
    };
  }, FOCUS_RING_INSET_PX);
}

for (const route of PUBLIC_SURFACES) {
  for (const width of DESKTOP_WIDTHS) {
    test(`privacy settings dialog contains its copy at ${width}px on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(route);
      const dialog = await openPrivacySettings(page);
      const fit = await dialogContainment(dialog);
      expect(fit.overflowing).toEqual([]);
      expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    });
  }
}

test("privacy settings dialog stays keyboard accessible", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Privacy settings" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Privacy settings" });
  await expect(dialog).toBeVisible();

  const decline = dialog.getByRole("button", {
    name: "Keep optional analytics off",
  });
  const allow = dialog.getByRole("button", {
    name: "Allow optional analytics",
  });
  const close = dialog.getByRole("button", { name: "Close" });
  await decline.focus();
  await expect(decline).toBeFocused();
  await allow.focus();
  await expect(allow).toBeFocused();
  await close.focus();
  await expect(close).toBeFocused();

  const violations = await new AxeBuilder({ page })
    .include("[role='dialog']")
    .analyze();
  expect(violations.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
