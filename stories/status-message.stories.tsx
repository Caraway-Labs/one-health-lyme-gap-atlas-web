import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";

function StatusWithAction() {
  const [retried, setRetried] = useState(false);
  return (
    <AtlasStatusMessage
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setRetried(true);
          }}
        >
          Retry example
        </Button>
      }
      title="Example request unavailable"
      titleAs="h2"
      tone="error"
    >
      {retried
        ? "Local retry recorded. No service was called."
        : "Deterministic fixture. No live service is connected."}
    </AtlasStatusMessage>
  );
}

const meta = {
  title: "Atlas/Status message",
  component: AtlasStatusMessage,
  args: {
    title: "No evidence in this example",
    titleAs: "h2",
    tone: "empty",
    children: "Deterministic fixture. No live service is connected.",
  },
  argTypes: {
    tone: { control: "select", options: ["empty", "loading", "error"] },
    title: { control: "text" },
    children: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Shared empty, loading and error messages. Loading uses a status announcement; errors use an alert.",
      },
    },
  },
} satisfies Meta<typeof AtlasStatusMessage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Loading: Story = {
  args: { tone: "loading", title: "Loading example" },
};
export const Error: Story = {
  args: { tone: "error", title: "Example request unavailable" },
};
export const WithAction: Story = { render: () => <StatusWithAction /> };
