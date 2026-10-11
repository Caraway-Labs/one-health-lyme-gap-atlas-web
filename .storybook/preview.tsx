import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <main className="mx-auto w-full max-w-3xl p-4">
        <h1 className="sr-only">
          {context.title}: {context.name}
        </h1>
        <Story />
      </main>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    nextjs: { appDirectory: true },
  },
  tags: ["autodocs"],
};

export default preview;
