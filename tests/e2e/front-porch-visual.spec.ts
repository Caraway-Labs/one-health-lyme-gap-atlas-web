import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type TestInfo } from "@playwright/test";

import { FRONT_PORCH_HERO_SUPPORT } from "../../src/features/front-porch/front-porch-copy";

const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 700 },
];

test.use({ deviceScaleFactor: 1, isMobile: false });

async function attachImage(testInfo: TestInfo, name: string, body: Buffer) {
  const imagePath = testInfo.outputPath(`${name}.png`);
  await writeFile(imagePath, body);
  await testInfo.attach(name, { path: imagePath, contentType: "image/png" });
}

for (const viewport of viewports) {
  test(`approved Front Porch composition ${viewport.width}`, async ({
    page,
    context,
  }, testInfo) => {
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
      viewport.width > 850 ? "720px" : "770px"
    );
    await expect(page.locator(".front-porch-bar")).toHaveCSS(
      "position",
      "absolute"
    );
    await expect(page.locator("#front-porch-headline")).toHaveCSS(
      "font-weight",
      "500"
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
    await expect(page.locator(".front-porch-beat").first()).toHaveCSS(
      "padding-top",
      "90px"
    );
    await expect(page.locator(".front-porch-beat h2").first()).toHaveCSS(
      "font-weight",
      "700"
    );
    await page.evaluate(() => window.scrollTo(0, 0));

    const reference = await context.newPage();
    await reference.setViewportSize(viewport);
    await reference.route("**/approved-reference/**", async (route) => {
      const file = new URL(route.request().url()).pathname.split("/").pop()!;
      const files: Record<string, string> = {
        "index.html": "design-references/front-porch/approved-hero.html",
        "one_health_nature_portal.png":
          "design-references/front-porch/one_health_nature_portal.png",
        "manrope.ttf": "src/fonts/manrope-variable.ttf",
        "dm-sans.ttf": "src/fonts/dm-sans-variable.ttf",
      };
      const body = await readFile(path.resolve(files[file]));
      await route.fulfill({
        body,
        contentType: file.endsWith("html")
          ? "text/html"
          : file.endsWith("png")
            ? "image/png"
            : "font/ttf",
      });
    });
    await reference.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({
        contentType: "text/css",
        body: "@font-face{font-family:Manrope;src:url('http://127.0.0.1:3100/approved-reference/manrope.ttf');font-weight:200 800}@font-face{font-family:'DM Sans';src:url('http://127.0.0.1:3100/approved-reference/dm-sans.ttf');font-weight:100 1000}",
      })
    );
    await reference.goto("http://127.0.0.1:3100/approved-reference/index.html");
    await reference.evaluate(() => document.fonts.ready);
    expect(
      await reference.evaluate(() =>
        [...document.fonts].every((font) => font.status === "loaded")
      )
    ).toBeTruthy();
    await reference
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.decode());
    await attachImage(
      testInfo,
      "approved-original",
      await reference.screenshot({ animations: "disabled" })
    );
    // Compare like-for-like approved copy, while retaining the original above.
    await reference
      .locator(".copy > p")
      .first()
      .evaluate((element, copy) => {
        element.textContent = copy;
      }, FRONT_PORCH_HERO_SUPPORT);
    await reference.locator(".cta").evaluate((element) => {
      element.textContent = "Follow the story";
    });
    await reference.locator(".fine").evaluate((element) => {
      element.textContent = "Our opening example: Lyme disease.";
    });
    await reference.locator(".sign").evaluate((element) => {
      element.textContent = "Sign in";
    });
    const normalized = await reference
      .locator(".hero")
      .screenshot({ animations: "disabled" });
    await attachImage(testInfo, "approved-with-final-copy", normalized);
    // Direct live reference comparison cannot be bypassed by updating snapshots.
    const difference = await page.evaluate(
      async ({ actualPng, referencePng }) => {
        const decode = async (png: string) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          return {
            canvas,
            context,
            pixels: context.getImageData(0, 0, image.width, image.height),
          };
        };
        const actualImage = await decode(actualPng);
        const referenceImage = await decode(referencePng);
        if (
          actualImage.canvas.width !== referenceImage.canvas.width ||
          actualImage.canvas.height !== referenceImage.canvas.height
        ) {
          return { ratio: 1, png: actualPng };
        }
        let mismatches = 0;
        const { data } = actualImage.pixels;
        const expected = referenceImage.pixels.data;
        for (let offset = 0; offset < data.length; offset += 4) {
          const mismatch =
            Math.max(
              Math.abs(data[offset] - expected[offset]),
              Math.abs(data[offset + 1] - expected[offset + 1]),
              Math.abs(data[offset + 2] - expected[offset + 2])
            ) > 51;
          if (mismatch) {
            mismatches += 1;
          }
          data[offset] = mismatch ? 255 : expected[offset];
          data[offset + 1] = mismatch ? 0 : expected[offset + 1];
          data[offset + 2] = mismatch ? 80 : expected[offset + 2];
        }
        actualImage.context.putImageData(actualImage.pixels, 0, 0);
        return {
          ratio: mismatches / (data.length / 4),
          png: actualImage.canvas.toDataURL("image/png").split(",")[1],
        };
      },
      {
        actualPng: actual.toString("base64"),
        referencePng: normalized.toString("base64"),
      }
    );
    await attachImage(
      testInfo,
      "highlighted-reference-diff",
      Buffer.from(difference.png, "base64")
    );
    await testInfo.attach("diff-ratio", {
      body: JSON.stringify({ viewport, mismatchRatio: difference.ratio }),
      contentType: "application/json",
    });
    expect(difference.ratio).toBeLessThanOrEqual(0.02);
    // Geometry is checked against the actual reference even on snapshot updates.
    for (const [actualSelector, referenceSelector] of [
      [".front-porch-hero-inner", ".inner"],
      [".front-porch-figure", ".art"],
      [".front-porch-image-frame img", ".art img"],
      ["#front-porch-headline", "h1"],
      [".front-porch-callout", ".mini"],
    ]) {
      const actualBounds = await page.locator(actualSelector).boundingBox();
      const referenceBounds = await reference
        .locator(referenceSelector)
        .boundingBox();
      if (viewport.width <= 360 && actualSelector === ".front-porch-callout") {
        // The prototype clips its panel at 320px. Keep all text inside the art.
        expect(actualBounds!.x).toBeGreaterThanOrEqual(0);
        expect(actualBounds!.x + actualBounds!.width).toBeLessThanOrEqual(
          viewport.width
        );
        continue;
      }
      expect(actualBounds!.width).toBeCloseTo(referenceBounds!.width, 0);
      expect(actualBounds!.height).toBeCloseTo(referenceBounds!.height, 0);
      if (viewport.width > 360) {
        expect(actualBounds!.x).toBeCloseTo(referenceBounds!.x, 0);
        expect(actualBounds!.y).toBeCloseTo(referenceBounds!.y, 0);
      }
    }
    await reference.close();
    expect(runtimeErrors).toEqual([]);
    await expect(hero).toHaveScreenshot(`front-porch-${viewport.width}.png`, {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    });
    await expect(page.locator(".front-porch-beat").first()).toHaveScreenshot(
      `first-transition-${viewport.width}.png`,
      { animations: "disabled", maxDiffPixelRatio: 0.02 }
    );
  });
}

test("signed-in header and responsive boundary widths remain readable", async ({
  page,
}) => {
  await page.goto("/");
  // Same server-rendered account label and href as the signed-in session.
  await page.locator(".front-porch-sign-in").evaluate((element) => {
    element.textContent = "Open Review";
    element.setAttribute("href", "/app/review");
  });
  for (const width of [320, 390, 768, 800, 801, 850, 851, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(width);
    const brand = await page.locator(".front-porch-brand").boundingBox();
    const signIn = await page.locator(".front-porch-sign-in").boundingBox();
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(signIn!.x);
  }
});
