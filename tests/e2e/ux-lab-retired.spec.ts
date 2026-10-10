import { expect, test } from "@playwright/test";

const retiredRoutes = [
  "/ux-lab",
  "/ux-lab/persona-gateway",
  "/ux-lab/public-first",
  "/ux-lab/three-lanes",
  "/ux-lab/geography-first",
  "/ux-lab/geography-first-v2",
  "/ux-lab/public-site-pro-app",
  "/ux-lab/people-first-hub",
  "/ux-lab/people-plus-workspace",
  "/ux-lab/persona-gateway/clinician/clinician-resources",
  "/ux-lab/not-a-real-concept",
] as const;

const prototypeMarkers = [
  "Atlas UX Lab",
  "Atlas UX Prototype",
  "Product research only",
  "What this variant is testing",
  "Sample labels for prototype layout only",
] as const;

test.describe("retired UX Lab routes", () => {
  for (const path of retiredRoutes) {
    test(`${path} returns 404 without a redirect or prototype shell`, async ({
      request,
    }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
      const body = await response.text();
      expect(
        prototypeMarkers.filter((marker) => body.includes(marker))
      ).toEqual([]);
    });
  }
});
