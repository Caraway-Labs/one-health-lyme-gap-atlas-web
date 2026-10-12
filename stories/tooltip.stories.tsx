import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const sides = ["top", "bottom", "left", "right"] as const;
type TooltipSide = (typeof sides)[number];

function TooltipStory({ delay, side }: { delay: number; side: TooltipSide }) {
  return (
    <TooltipProvider delay={delay}>
      <Tooltip>
        <TooltipTrigger render={<Button type="button" variant="outline" />}>
          Review
        </TooltipTrigger>
        <TooltipContent side={side}>
          Open Review. The button name stays available without the tooltip.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta = {
  title: "Primitives/Tooltip",
  component: TooltipStory,
  args: { delay: 0, side: "top" },
  argTypes: {
    delay: { control: { min: 0, type: "number" } },
    side: { control: "select", options: [...sides] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: extra label for a control that already has a name. Source: src/components/ui/tooltip.tsx. Limitations: the tooltip repeats guidance. The button name is the essential label. Hover and keyboard focus both open it.",
      },
    },
  },
} satisfies Meta<typeof TooltipStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Focus: Story = {};
export const Bottom: Story = { args: { side: "bottom" } };
