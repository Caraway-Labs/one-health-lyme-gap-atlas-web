import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    env: {
      NEXT_PUBLIC_ATLAS_ASSISTANT_DEMO_ENABLED: "true",
      NEXT_PUBLIC_KG_CHAT_ENABLED: "true",
    },
    reuseExistingServer: false,
    url: "http://127.0.0.1:3100",
  },
});
