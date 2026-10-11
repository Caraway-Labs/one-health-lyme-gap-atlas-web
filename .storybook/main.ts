import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  core: { disableTelemetry: true },
  // Publish only explicit stories, never the application public/ directory.
  staticDirs: [],
  viteFinal: (config) => ({ ...config, base: "./" }),
};

export default config;
