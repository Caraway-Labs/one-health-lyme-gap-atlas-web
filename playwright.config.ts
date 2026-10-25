import { defineConfig } from "@playwright/test";

import { atlasBrowserProjects } from "./scripts/playwright-projects";
import { SYNTHETIC_AMPLITUDE_API_KEY } from "./src/lib/amplitude-deployment";

const productionVisuals = process.env.ATLAS_VISUAL_PRODUCTION === "1";

export default defineConfig({
  // Playwright deletes outputDir at the start of each run. Keep traces here so
  // JUnit files in test-results/ survive the hard and soft e2e steps.
  outputDir: productionVisuals
    ? "test-results/front-porch-visual"
    : "test-results/playwright",
  timeout: 60_000,
  workers: 1,
  // Desktop Chromium is the release project. Pixel 7 is added only when
  // ATLAS_E2E_MOBILE=1. See docs/ci.md.
  projects: atlasBrowserProjects(),
  testDir: "./tests/e2e",
  testIgnore: productionVisuals ? undefined : "**/front-porch-visual.spec.ts",
  testMatch: productionVisuals ? "**/front-porch-visual.spec.ts" : undefined,
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: productionVisuals
      ? "npm run build && npx next start --hostname 127.0.0.1 --port 3100"
      : "npm run dev -- --hostname 127.0.0.1 --port 3100",
    env: {
      ATLAS_E2E: "1",
      NEXT_PUBLIC_AMPLITUDE_API_KEY: SYNTHETIC_AMPLITUDE_API_KEY,
      NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET: "development",
      NEXT_PUBLIC_KG_CHAT_ENABLED: "true",
    },
    reuseExistingServer: false,
    timeout: productionVisuals ? 600_000 : 180_000,
    url: "http://127.0.0.1:3100",
  },
});
