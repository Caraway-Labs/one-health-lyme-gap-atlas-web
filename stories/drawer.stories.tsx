import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListChecksIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const directions = ["down", "up", "left", "right"] as const;
type DrawerDirection = (typeof directions)[number];

function DrawerStory({ swipeDirection }: { swipeDirection: DrawerDirection }) {
  return (
    <Drawer showSwipeHandle swipeDirection={swipeDirection}>
      <DrawerTrigger render={<Button type="button" variant="outline" />}>
        <ListChecksIcon aria-hidden="true" />
        Shortlist
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Shortlist</DrawerTitle>
          <DrawerDescription>
            Synthetic mobile bottom sheet. Swipe, Escape, or Close dismisses it.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose render={<Button type="button" variant="outline" />}>
            Close
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const meta = {
  title: "Primitives/Drawer",
  component: DrawerStory,
  args: { swipeDirection: "down" },
  argTypes: {
    swipeDirection: { control: "select", options: [...directions] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: touch-friendly swipe-to-dismiss panel for mobile shortlist or provenance. Source: src/components/ui/drawer.tsx. Limitations: content is synthetic. Every drawer keeps a Close button so swiping is never the only dismissal path.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof DrawerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bottom: Story = {};
export const Right: Story = { args: { swipeDirection: "right" } };
