import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const SIDEBAR_STORAGE_KEY = "ux-reset-pro-sidebar";
const CHAT_STORAGE_KEY = "one-health-lyme-gap-atlas:knowledge-chat:v1";

function clearStoragePrefix(prefix: string): void {
  const keys = Object.keys(window.localStorage);
  for (const key of keys) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      window.localStorage.removeItem(key);
    }
  }
}

function storyParameter(
  parameters: Preview["parameters"],
  key: "atlasLandmark" | "atlasLayout"
): string | undefined {
  const value = parameters?.[key];
  return typeof value === "string" ? value : undefined;
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // Autodocs owns the page heading/landmark; inline examples must not duplicate it.
      const isDocs = context.viewMode === "docs";
      const storyOwnsLandmark =
        storyParameter(context.parameters, "atlasLandmark") === "story";
      const fullWidth =
        storyParameter(context.parameters, "atlasLayout") === "full";
      const Container = isDocs || storyOwnsLandmark ? "div" : "main";
      return (
        <Container
          className={`bg-background text-foreground mx-auto w-full font-sans ${fullWidth ? "max-w-none p-0" : "max-w-3xl p-4"}`}
        >
          {isDocs || storyOwnsLandmark ? null : (
            <h1 className="sr-only">
              {context.title}: {context.name}
            </h1>
          )}
          <Story />
        </Container>
      );
    },
  ],
  loaders: [
    async () => {
      clearStoragePrefix(SIDEBAR_STORAGE_KEY);
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    nextjs: { appDirectory: true },
  },
  tags: ["autodocs"],
};

export default preview;
