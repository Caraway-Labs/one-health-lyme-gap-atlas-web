import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      exclude: [
        "src/generated/**",
        "**/*.d.ts",
        "**/*.stories.*",
        "**/node_modules/**",
        "**/.next/**",
        "**/source.config.ts",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
    },
    environment: "jsdom",
    exclude: ["node_modules/**", "node_modules.broken-*/**", "tests/e2e/**"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    outputFile: {
      junit: "test-results/vitest-junit.xml",
    },
    reporters: ["default", "junit"],
  },
});
