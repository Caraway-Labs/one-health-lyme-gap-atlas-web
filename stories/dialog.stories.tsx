import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function DialogStory({ scrolling }: { scrolling: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <p data-testid="dialog-state">{open ? "Dialog open" : "Dialog closed"}</p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      >
        <DialogTrigger render={<Button type="button" variant="outline" />}>
          Open dialog
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Synthetic dialog</DialogTitle>
            <DialogDescription>
              Local preview. Nothing is submitted.
            </DialogDescription>
          </DialogHeader>
          {scrolling ? (
            <div className="max-h-24 overflow-y-auto">
              {Array.from({ length: 8 }, (_, index) => {
                const paragraph = `Synthetic scrolling paragraph ${index + 1}. This text stays inside the dialog.`;
                return <p key={paragraph}>{paragraph}</p>;
              })}
            </div>
          ) : (
            <p>Short synthetic content.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const meta = {
  title: "Primitives/Dialog",
  component: DialogStory,
  args: { scrolling: false },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Base UI dialog used by workspace confirmations. Source: src/components/ui/dialog.tsx. Limitations: content is synthetic. Open, close, Escape, and reopen stay in this preview. No second modal implementation.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof DialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Scrolling: Story = { args: { scrolling: true } };
