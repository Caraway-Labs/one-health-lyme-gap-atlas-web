import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const sides = ["top", "bottom", "left", "right"] as const;
type HoverCardSide = (typeof sides)[number];

function HoverCardStory({ side }: { side: HoverCardSide }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        render={<Button type="button" variant="outline" />}
      >
        Bullock County
      </HoverCardTrigger>
      <HoverCardContent side={side}>
        <p className="font-semibold">Bullock County, AL</p>
        <p className="type-small">
          Synthetic hover readout. The same facts stay available in the table.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

const meta = {
  title: "Primitives/Hover card",
  component: HoverCardStory,
  args: { side: "bottom" },
  argTypes: { side: { control: "select", options: [...sides] } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: optional hover or focus preview (for example a map readout). Source: src/components/ui/hover-card.tsx. Limitations: content is synthetic. A preview never holds the only copy of a fact, because touch users cannot hover.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof HoverCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bottom: Story = {};
export const Top: Story = { args: { side: "top" } };
