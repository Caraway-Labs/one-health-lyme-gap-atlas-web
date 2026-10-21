import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const sides = ["right", "left", "top", "bottom"] as const;
type SheetSide = (typeof sides)[number];

function SheetStory({ side }: { side: SheetSide }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" />}>
        <SlidersHorizontalIcon aria-hidden="true" />
        Scenario
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Scenario</SheetTitle>
          <SheetDescription>
            Synthetic side panel. Nothing is saved and published results do not
            change.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

const meta = {
  title: "Primitives/Sheet",
  component: SheetStory,
  args: { side: "right" },
  argTypes: { side: { control: "select", options: [...sides] } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: edge-anchored secondary panel (for example scenario controls) built on the Base UI dialog. Source: src/components/ui/sheet.tsx. Limitations: content is synthetic. Focus is trapped while open, Escape and Close dismiss it, and focus returns to the trigger.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof SheetStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {};
export const Left: Story = { args: { side: "left" } };
export const Bottom: Story = { args: { side: "bottom" } };
