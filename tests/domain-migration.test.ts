// @vitest-environment node
import { describe, expect, it } from "vitest";

import config from "../next.config";

describe("production host redirects", () => {
  it("redirects all five defensive hosts before asset redirects", async () => {
    const redirects = await config.redirects?.();
    expect(redirects?.slice(0, 5)).toStrictEqual(
      [
        "www.onehealthatlas.org",
        "onehealthatlas.com",
        "www.onehealthatlas.com",
        "onehealthatlas.ai",
        "www.onehealthatlas.ai",
      ].map((host) => ({
        destination: "https://onehealthatlas.org/:path*",
        has: [{ type: "host", value: host }],
        permanent: true,
        source: "/:path*",
      }))
    );
  });

  it("keeps the old www redirect and does not redirect the canonical or starter host", async () => {
    const redirects = await config.redirects?.();
    expect(redirects).toContainEqual({
      destination: "https://carawaylabs.com/:path*",
      has: [{ type: "host", value: "www.carawaylabs.com" }],
      permanent: true,
      source: "/:path*",
    });
    expect(
      redirects?.filter((rule) =>
        rule.has?.some(
          (condition) =>
            condition.type === "host" &&
            [
              "onehealthatlas.org",
              "one-health-lyme-gap-atlas-web-yqobn.ondigitalocean.app",
            ].includes(condition.value ?? "")
        )
      )
    ).toStrictEqual([]);
  });
});
