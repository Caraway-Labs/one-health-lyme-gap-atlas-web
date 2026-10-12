import path from "node:path";

import type { StorybookConfig } from "@storybook/nextjs-vite";
import type { Alias, AliasOptions } from "vite";

function existingAliases(alias: AliasOptions | undefined): Alias[] {
  if (!alias) {
    return [];
  }
  if (Array.isArray(alias)) {
    return alias;
  }
  return Object.entries(alias).map(([find, replacement]) => ({
    find,
    replacement,
  }));
}

const storyAliases = [
  {
    find: "@/components/brand-mark",
    replacement: path.resolve("stories/support/brand-mark.tsx"),
  },
  {
    find: "@/features/ux-reset/ask-atlas/ask-atlas-chrome",
    replacement: path.resolve(
      "stories/support/ask-atlas-chrome-substitute.tsx"
    ),
  },
  {
    find: "@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority",
    replacement: path.resolve("stories/support/tier1-hook-substitute.tsx"),
  },
] as const satisfies readonly Alias[];

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs"],
  core: { disableTelemetry: true },
  // Publish only explicit stories, never the application public/ directory.
  staticDirs: [],
  viteFinal: (config) => ({
    ...config,
    base: "./",
    resolve: {
      ...config.resolve,
      alias: [...storyAliases, ...existingAliases(config.resolve?.alias)],
    },
  }),
};

export default config;
