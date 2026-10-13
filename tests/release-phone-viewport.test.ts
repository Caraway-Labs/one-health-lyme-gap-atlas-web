import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  feedbackPhoneViewport,
  frontPorchBoundaryWidths,
  frontPorchCompositionViewports,
  isPhoneReleaseViewport,
  publicTrustViewports,
  releaseViewportRuns,
} from "./e2e/release-phone-viewport";

function widths(viewports: readonly { width: number }[]): number[] {
  return viewports.map((viewport) => viewport.width);
}

function phoneWidths(values: readonly number[]): number[] {
  return values.filter((width) => isPhoneReleaseViewport(width));
}

function desktopWidths(values: readonly number[]): number[] {
  return values.filter((width) => !isPhoneReleaseViewport(width));
}

describe("phone viewport release gate", () => {
  it("classifies Front Porch phone widths separately from desktop widths", () => {
    expect(phoneWidths(widths(frontPorchCompositionViewports))).toStrictEqual([
      390, 320,
    ]);
    expect(desktopWidths(widths(frontPorchCompositionViewports))).toStrictEqual(
      [1440, 1280]
    );
    expect(phoneWidths(frontPorchBoundaryWidths)).toStrictEqual([320, 390]);
    expect(desktopWidths(frontPorchBoundaryWidths)).toStrictEqual([
      768, 800, 801, 850, 851, 1024, 1440,
    ]);
  });

  it("classifies public trust and feedback phone widths", () => {
    expect(phoneWidths(widths(publicTrustViewports))).toStrictEqual([320, 390]);
    expect(desktopWidths(widths(publicTrustViewports))).toStrictEqual([
      768, 1280, 1440,
    ]);
    expect(feedbackPhoneViewport).toStrictEqual({ height: 844, width: 390 });
    expect(isPhoneReleaseViewport(768)).toBeFalsy();
  });

  it("keeps phone widths off the desktop project", () => {
    expect(releaseViewportRuns("desktop", 320)).toBeFalsy();
    expect(releaseViewportRuns("desktop", 390)).toBeFalsy();
    expect(releaseViewportRuns("desktop", 768)).toBeTruthy();
    expect(releaseViewportRuns("desktop", 1440)).toBeTruthy();
  });

  it("keeps desktop widths off the mobile project", () => {
    expect(releaseViewportRuns("mobile", 320)).toBeTruthy();
    expect(releaseViewportRuns("mobile", 390)).toBeTruthy();
    expect(releaseViewportRuns("mobile", 768)).toBeFalsy();
    expect(releaseViewportRuns("mobile", 1440)).toBeFalsy();
  });

  it("skips phone Front Porch compositions before setting the viewport", () => {
    const source = readFileSync(
      "tests/e2e/front-porch-visual.spec.ts",
      "utf-8"
    );
    const guard = source.indexOf(
      "releaseViewportRuns(testInfo.project.name, viewport.width)"
    );
    const viewport = source.indexOf("page.setViewportSize(viewport)");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("test.skip(")).toBeLessThan(guard);
    expect(viewport).toBeGreaterThan(guard);
  });

  it("continues past phone widths in the Front Porch boundary loop", () => {
    const source = readFileSync(
      "tests/e2e/front-porch-visual.spec.ts",
      "utf-8"
    );
    const guard = source.indexOf(
      "releaseViewportRuns(testInfo.project.name, width)"
    );
    const viewport = source.indexOf(
      "page.setViewportSize({ width, height: 900 })"
    );
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(viewport).toBeGreaterThan(guard);
    expect(source.slice(guard, viewport)).toContain("continue;");
  });

  it("guards the public trust width loop and the feedback phone test", () => {
    const trust = readFileSync("tests/e2e/public-trust-pages.spec.ts", "utf-8");
    const trustGuard = trust.indexOf(
      "releaseViewportRuns(testInfo.project.name, viewport.width)"
    );
    const trustViewport = trust.indexOf("page.setViewportSize(viewport)");
    const feedback = readFileSync("tests/e2e/feedback.spec.ts", "utf-8");
    const feedbackGuard = feedback.indexOf(
      "releaseViewportRuns(testInfo.project.name, feedbackPhoneViewport.width)"
    );
    const feedbackViewport = feedback.indexOf(
      "page.setViewportSize(feedbackPhoneViewport)"
    );
    expect(trustGuard).toBeGreaterThanOrEqual(0);
    expect(trust.slice(trustGuard, trustViewport)).toContain("continue;");
    expect(trustViewport).toBeGreaterThan(trustGuard);
    expect(feedbackGuard).toBeGreaterThanOrEqual(0);
    expect(feedbackViewport).toBeGreaterThan(feedbackGuard);
  });
});
