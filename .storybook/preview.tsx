import type { Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // Autodocs owns the page heading/landmark; inline examples must not duplicate it.
      const isDocs = context.viewMode === "docs";
      const Container = isDocs ? "div" : "main";
      return (
        <Container className="bg-background text-foreground mx-auto w-full max-w-3xl p-4 font-sans">
          {isDocs ? null : (
            <h1 className="sr-only">
              {context.title}: {context.name}
            </h1>
          )}
          <Story />
        </Container>
      );
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
