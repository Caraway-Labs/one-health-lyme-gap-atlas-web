import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";

const variants = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  args: { children: "Available", variant: "default" },
  argTypes: {
    children: { control: "text" },
    variant: { control: "select", options: [...variants] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: short status label. Source: src/components/ui/badge.tsx. Limitations: labels are synthetic. Variants are the six declared styles. This is not the legacy review-priority pill.",
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = {
  args: { children: "Unavailable", variant: "destructive" },
};
export const Link: Story = { args: { variant: "link" } };
export const LongLabel: Story = {
  args: {
    children:
      "Synthetic long label for a governed evidence state in this preview",
  },
};
