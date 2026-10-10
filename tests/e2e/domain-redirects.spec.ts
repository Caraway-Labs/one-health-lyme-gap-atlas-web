import { expect, test } from "@playwright/test";

for (const host of [
  "www.onehealthatlas.org",
  "onehealthatlas.com",
  "www.onehealthatlas.com",
  "onehealthatlas.ai",
  "www.onehealthatlas.ai",
]) {
  test(`${host} preserves deep-link paths and queries`, async ({ request }) => {
    const response = await request.get(
      "/docs/evidence-and-uncertainty?migration=354",
      {
        headers: { host },
        maxRedirects: 0,
      }
    );
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "https://onehealthatlas.org/docs/evidence-and-uncertainty?migration=354"
    );
  });
}

test("canonical host serves docs without a host redirect", async ({
  request,
}) => {
  const response = await request.get("/docs", {
    headers: { host: "onehealthatlas.org" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(200);
});
