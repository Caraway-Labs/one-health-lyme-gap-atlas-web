import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

function ActivationHarness() {
  const [presses, setPresses] = useState(0);
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        onClick={() => {
          setPresses((count) => count + 1);
        }}
      >
        Review evidence
      </Button>
      <p data-testid="button-presses">{`Pressed ${presses}`}</p>
    </div>
  );
}

const meta = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Review evidence", variant: "default", disabled: false },
  argTypes: {
    children: { control: "text" },
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "ghost",
        "destructive",
        "link",
      ],
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Canonical Base UI action. Use controls to inspect variants, sizes and disabled behavior.",
      },
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Search aria-hidden="true" />
        Search evidence
      </>
    ),
  },
};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const Link: Story = { args: { variant: "link" } };
export const Invalid: Story = { args: { "aria-invalid": true } };
export const Small: Story = { args: { size: "sm" } };
export const Icon: Story = {
  args: {
    "aria-label": "Search evidence",
    children: <Search aria-hidden="true" />,
    size: "icon",
  },
};
export const Activation: Story = { render: () => <ActivationHarness /> };
