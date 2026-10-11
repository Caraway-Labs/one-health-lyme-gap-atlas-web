import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";

const meta = {
  title: "Atlas/Priority badge",
  component: AtlasPriorityBadge,
  args: { priority: "Priority 1" },
  argTypes: {
    priority: {
      control: "select",
      options: ["Priority 1", "Priority 2", "Watch", "Lower"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Existing legacy review-priority treatment with text and domain colors. Fixture categories express review priority, never disease risk or a diagnosis.",
      },
    },
  },
} satisfies Meta<typeof AtlasPriorityBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Highest: Story = {};
export const Moderate: Story = { args: { priority: "Priority 2" } };
export const Watch: Story = { args: { priority: "Watch" } };
export const Lower: Story = { args: { priority: "Lower" } };
