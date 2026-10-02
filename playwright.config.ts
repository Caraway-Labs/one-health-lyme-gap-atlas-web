import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Playwright deletes outputDir at the start of each run. Keep traces here so
  // JUnit files in test-results/ survive the hard and soft e2e steps.
  outputDir: "test-results/playwright",
  timeout: 60_000,
  workers: 1,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    env: {
      ATLAS_E2E: "1",
      NEXT_PUBLIC_AMPLITUDE_API_KEY: "00000000000000000000000000000000",
      NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET: "development",
      NEXT_PUBLIC_KG_CHAT_ENABLED: "true",
    },
    reuseExistingServer: false,
    timeout: 180_000,
    url: "http://127.0.0.1:3100",
  },
});
