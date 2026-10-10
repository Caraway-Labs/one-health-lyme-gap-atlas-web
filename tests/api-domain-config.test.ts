import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { getPublicConfig } from "../src/lib/public-config";

describe("branded API deployment configuration", () => {
  it("keeps the production API URL consistent in the deployment manifest and CI builds", async () => {
    const [manifest, workflow] = await Promise.all([
      readFile(".do/app.yaml", "utf-8"),
      readFile(".github/workflows/quality-deploy.yml", "utf-8"),
    ]);
    const apiUrl = manifest.match(
      /key: NEXT_PUBLIC_API_BASE_URL\s+value: (?<apiUrl>\S+)\s+scope: BUILD_TIME/
    )?.groups?.apiUrl;
    expect(apiUrl).toBe("https://api.onehealthatlas.org");
    expect(workflow).toContain(`NEXT_PUBLIC_API_BASE_URL: ${apiUrl}`);
    expect(workflow).toContain(
      `--build-arg NEXT_PUBLIC_API_BASE_URL=${apiUrl}`
    );
    expect(
      getPublicConfig({
        NEXT_PUBLIC_API_BASE_URL: apiUrl,
        NODE_ENV: "production",
      })
    ).toStrictEqual({ apiBaseUrl: apiUrl });
  });
});
