import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getPublicConfig } from "../src/lib/public-config";

describe("public runtime configuration", () => {
  it("uses a statically analyzable public environment reference for browser bundles", async () => {
    const modulePath = fileURLToPath(
      new URL("../src/lib/public-config.ts", import.meta.url)
    );
    const source = await readFile(modulePath, "utf-8");

    expect(source).toContain("process.env.NEXT_PUBLIC_API_BASE_URL");
    expect(source).not.toContain("= process.env\n");
  });

  it("accepts an HTTPS API URL", () => {
    expect(
      getPublicConfig({
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.test",
        NODE_ENV: "production",
      })
    ).toStrictEqual({ apiBaseUrl: "https://api.example.test" });
  });

  it("uses the intentional localhost default outside production", () => {
    expect(getPublicConfig({ NODE_ENV: "test" })).toStrictEqual({
      apiBaseUrl: "http://localhost:8000",
    });
  });

  it("rejects malformed URLs and missing production configuration", () => {
    expect(() =>
      getPublicConfig({
        NEXT_PUBLIC_API_BASE_URL: "ftp://example.test",
        NODE_ENV: "production",
      })
    ).toThrow("valid HTTP(S) URL");
    expect(() => getPublicConfig({ NODE_ENV: "production" })).toThrow(
      "valid HTTP(S) URL"
    );
  });
});
