import { writeFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type TestInfo } from "@playwright/test";

import {
  frontPorchBoundaryWidths,
  frontPorchCompositionViewports,
  releaseViewportRuns,
} from "./release-phone-viewport";

test.use({ deviceScaleFactor: 1, isMobile: false });

async function attachImage(testInfo: TestInfo, name: string, body: Buffer) {
  const imagePath = testInfo.outputPath(`${name}.png`);
  await writeFile(imagePath, body);
  await testInfo.attach(name, { path: imagePath, contentType: "image/png" });
}

for (const viewport of frontPorchCompositionViewports) {
  test(`approved Front Porch composition ${viewport.width}`, async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      !releaseViewportRuns(testInfo.project.name, viewport.width),
      "Phone-width Front Porch checks run on the mobile project."
    );
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.locator(".front-porch-support").evaluate(async (element) => {
      const style = getComputedStyle(element);
      await document.fonts.load(
        `${style.fontSize} ${style.fontFamily.split(",")[0]}`
      );
    });
    await page.evaluate(() => document.fonts.ready);
    const fontSession = await context.newCDPSession(page);
    await fontSession.send("DOM.enable");
    await fontSession.send("CSS.enable");
    const { root } = await fontSession.send("DOM.getDocument");
    const { nodeId } = await fontSession.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: ".front-porch-support",
    });
    const { fonts } = await fontSession.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    await testInfo.attach("rendered-body-font", {
      body: JSON.stringify(fonts),
      contentType: "application/json",
    });
    expect(
      fonts.some(
        (font) => font.isCustomFont && font.familyName.startsWith("DM Sans")
      )
    ).toBeTruthy();
    await fontSession.detach();
    await page
      .locator(".front-porch-image-frame img")
      .evaluate((image: HTMLImageElement) => image.decode());
    const hero = page.locator(".front-porch-hero");
    await expect(hero).toHaveCSS(
      "min-height",
      viewport.width > 850 ? "720px" : "760px"
    );
    await expect(page.locator(".front-porch-bar")).toHaveCSS(
      "position",
      "absolute"
    );
    await expect(page.locator("#front-porch-headline")).toHaveCSS(
      "font-weight",
      "700"
    );
    await expect(page.locator(".front-porch-callout")).toHaveCSS(
      "position",
      "absolute"
    );
    await expect(page.locator(".front-porch-callout")).toHaveCSS(
      "border-radius",
      "7px"
    );
    await expect(page.locator(".front-porch-cta").first()).toHaveCSS(
      "background-color",
      "rgb(189, 226, 211)"
    );
    expect(
      await hero.evaluate(
        (element) => getComputedStyle(element).backgroundImage
      )
    ).toContain("circle at 78% 48%");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(viewport.width);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
    const actual = await hero.screenshot({ animations: "disabled" });
    await attachImage(
      testInfo,
      "implementation-page",
      await page.screenshot({ animations: "disabled" })
    );
    await attachImage(testInfo, "implementation", actual);
    await expect(page.locator(".front-porch-intro")).toHaveCSS(
      "padding-top",
      "115px"
    );
    await expect(page.locator(".front-porch-beat h2").first()).toHaveCSS(
      "font-weight",
      "700"
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    if (viewport.width >= 1100) {
      await expect(page.locator(".front-porch-headline-break")).toHaveCSS(
        "display",
        "inline"
      );
      expect(
        await page.locator("#front-porch-headline").evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return [...range.getClientRects()].filter((rect) => rect.width > 20)
            .length;
        })
      ).toBe(2);
    }
    // The owner-approved redesign replaces the earlier prototype hero.
    // Snapshots below lock this composition; they are not a pixel match to
    // design-references/front-porch/approved-hero.html.

    expect(runtimeErrors).toEqual([]);
    await expect(hero).toHaveScreenshot(`front-porch-${viewport.width}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
    const firstBeat = page.locator(".front-porch-beat").first();
    await expect(firstBeat).toHaveCSS("min-height", "570px");
    await expect(firstBeat.locator("h2")).toHaveText(
      "Start with reported human illness."
    );
    await expect(firstBeat.locator(".front-porch-kicker")).toHaveCSS(
      "text-transform",
      "uppercase"
    );
  });
}

test("signed-in header and responsive boundary widths remain readable", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  // Same server-rendered account label and href as the signed-in session.
  await page.locator(".front-porch-sign-in").evaluate((element) => {
    element.textContent = "Open Atlas Explorer";
    element.setAttribute("href", "/explore");
  });
  for (const width of frontPorchBoundaryWidths) {
    if (!releaseViewportRuns(testInfo.project.name, width)) {
      continue;
    }
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(width);
    const brand = await page.locator(".front-porch-brand").boundingBox();
    const signIn = await page.locator(".front-porch-sign-in").boundingBox();
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(signIn!.x);
  }
});
