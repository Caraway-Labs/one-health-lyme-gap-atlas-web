import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  desktopRetainedNarrowWidths,
  feedbackPhoneViewport,
  frontPorchBoundaryWidths,
  frontPorchCompositionViewports,
  isPhoneReleaseViewport,
  phoneReleaseWidths,
  publicTrustViewports,
  releaseViewportRuns,
} from "./e2e/release-phone-viewport";
import { scanPhoneViewportCalls } from "./release-phone-viewport-scan";

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
    expect(releaseViewportRuns("desktop", 375)).toBeFalsy();
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

describe("default E2E and Storybook phone viewport sweep", () => {
  it("treats 375 as a phone width and keeps zoom widths on desktop", () => {
    expect(phoneReleaseWidths).toStrictEqual([320, 375, 390]);
    expect(isPhoneReleaseViewport(375)).toBeTruthy();
    expect(desktopRetainedNarrowWidths).toStrictEqual([640, 740]);
    expect(isPhoneReleaseViewport(640)).toBeFalsy();
    expect(releaseViewportRuns("mobile", 375)).toBeTruthy();
  });

  it("guards every phone setViewportSize in the default specs", () => {
    const calls = scanPhoneViewportCalls();
    const phone = calls.filter((call) => isPhoneReleaseViewport(call.width));
    const retained = calls.filter((call) =>
      desktopRetainedNarrowWidths.some((width) => width === call.width)
    );
    const unknown = calls.filter(
      (call) =>
        !isPhoneReleaseViewport(call.width) &&
        !desktopRetainedNarrowWidths.some((width) => width === call.width)
    );
    const unguarded = phone
      .filter((call) => !call.guarded)
      .map((call) => `${call.file}:${call.line} ${call.width}`);
    const phoneFiles = [...new Set(phone.map((call) => call.file))].sort();
    expect(phoneFiles).toStrictEqual([
      "tests/e2e/assistant-accessibility.spec.ts",
      "tests/e2e/developer-docs.spec.ts",
      "tests/e2e/docs-page-actions.spec.ts",
      "tests/e2e/evidence-chat.spec.ts",
      "tests/e2e/feedback.spec.ts",
      "tests/e2e/front-porch-visual.spec.ts",
      "tests/e2e/professional-navigation.spec.ts",
      "tests/e2e/provenance-evidence-docs.spec.ts",
      "tests/e2e/public-trust-pages.spec.ts",
      "tests/e2e/reset-feedback.spec.ts",
      "tests/e2e/starting-view-onboarding.spec.ts",
      "tests/e2e/tier1-availability-docs.spec.ts",
      "tests/e2e/trust-footer-consent-regression.spec.ts",
      "tests/e2e/ux-reset-ask-atlas.spec.ts",
      "tests/e2e/ux-reset-compare.spec.ts",
      "tests/e2e/ux-reset-data-provenance.spec.ts",
      "tests/e2e/ux-reset-environmental-context.spec.ts",
      "tests/e2e/ux-reset-explorer-history-evidence.spec.ts",
      "tests/e2e/ux-reset-explorer-map-drill.spec.ts",
      "tests/e2e/ux-reset-explorer-map-legend.spec.ts",
      "tests/e2e/ux-reset-explorer-selected-state-outline.spec.ts",
      "tests/e2e/ux-reset-explorer-toolbar.spec.ts",
      "tests/e2e/ux-reset-intelligence-feed-abstracts.spec.ts",
      "tests/e2e/ux-reset-intelligence-feed.spec.ts",
      "tests/e2e/ux-reset-population-rurality.spec.ts",
      "tests/e2e/ux-reset-selected-county-card.spec.ts",
      "tests/e2e/ux-reset-selected-county-response-tier.spec.ts",
      "tests/e2e/ux-reset-settings.spec.ts",
      "tests/e2e/ux-reset-shell-scroll.spec.ts",
      "tests/e2e/ux-reset-typed-availability.spec.ts",
      "tests/e2e/ux-reset-workspace-header.spec.ts",
      "tests/e2e/ux-reset.spec.ts",
      "tests/e2e/workspace-account-menu.spec.ts",
      "tests/storybook/action-brief.spec.ts",
      "tests/storybook/chat-and-primitives.spec.ts",
      "tests/storybook/domain-catalog.spec.ts",
      "tests/storybook/p0-evidence.spec.ts",
      "tests/storybook/p1-catalog.spec.ts",
    ]);
    expect(unguarded).toStrictEqual([]);
    expect(unknown).toStrictEqual([]);
    expect(retained.map((call) => `${call.file} ${call.width}`)).toStrictEqual([
      "tests/e2e/ux-reset-ask-atlas-workspace.spec.ts 740",
      "tests/e2e/ux-reset-ask-atlas-workspace.spec.ts 740",
      "tests/e2e/ux-reset-ask-atlas-workspace.spec.ts 640",
      "tests/e2e/ux-reset-ask-atlas-workspace.spec.ts 640",
      "tests/e2e/ux-reset-selected-county-preview.spec.ts 640",
    ]);
    expect(
      phone.every(
        (call) => releaseViewportRuns("desktop", call.width) === false
      )
    ).toBeTruthy();
  });
});
