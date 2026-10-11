import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storybook",
  outputDir: "test-results/storybook",
  timeout: 60_000,
  workers: 1,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
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
