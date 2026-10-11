import { expect, test } from "@playwright/test";

const retiredRoutes = [
  "/variant_1",
  "/variant_1?county=08001",
  "/variant_2",
  "/variant_2?county=08001",
  "/variant_3",
  "/variant_3?county=08001",
  "/variant_4",
  "/variant_4?county=08001",
  "/variant_5",
  "/variant_5?county=08001&compare=06037",
  "/variant_6",
  "/variant_6?state=CO&county=08001&evidence=ecological&eco=70&breakpoint=15&missing=80",
  "/variant_7",
  "/variant_7?view=ranking&county=08001",
] as const;

const retiredCopy = [
  "A clear starting point for county review",
  "Explore a county, one step at a time",
  "Understand what the score means",
  "Compare county evidence before deciding",
  "Explore county evidence in one place",
  "Loading experimental geographic explorer",
  "Loading experiment",
] as const;

test.describe("retired numbered variant routes", () => {
  for (const path of retiredRoutes) {
    test(`${path} returns HTTP 404 without a redirect`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
      const body = await response.text();
      expect(retiredCopy.filter((marker) => body.includes(marker))).toEqual([]);
    });
  }
});
