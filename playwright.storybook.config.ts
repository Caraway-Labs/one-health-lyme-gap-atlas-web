import { defineConfig } from "@playwright/test";

import { atlasBrowserProjects } from "./scripts/playwright-projects";

export default defineConfig({
  testDir: "./tests/storybook",
  outputDir: "test-results/storybook",
  timeout: 60_000,
  workers: 1,
  // Desktop Chromium is the release project. Pixel 7 is added only when
  // ATLAS_E2E_MOBILE=1. See docs/ci.md.
  projects: atlasBrowserProjects(),
  use: {
    baseURL: "http://127.0.0.1:6007/one-health-lyme-gap-atlas-web/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve-storybook.mjs",
    url: "http://127.0.0.1:6007/one-health-lyme-gap-atlas-web/",
    reuseExistingServer: false,
  },
});
