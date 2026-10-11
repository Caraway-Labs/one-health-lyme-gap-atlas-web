import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    size: { control: "select", options: ["default", "sm", "lg", "xs"] },
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
