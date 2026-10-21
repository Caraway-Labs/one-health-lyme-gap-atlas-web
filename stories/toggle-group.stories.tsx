import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MapIcon, Table2Icon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const variants = ["default", "outline"] as const;
type ToggleVariant = (typeof variants)[number];

function ToggleGroupStory({ variant }: { variant: ToggleVariant }) {
  return (
    <ToggleGroup
      aria-label="Synthetic result view"
      defaultValue={["map"]}
      variant={variant}
    >
      <ToggleGroupItem value="map">
        <MapIcon aria-hidden="true" />
        Map
      </ToggleGroupItem>
      <ToggleGroupItem value="table">
        <Table2Icon aria-hidden="true" />
        Table
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const meta = {
  title: "Primitives/Toggle group",
  component: ToggleGroupStory,
  args: { variant: "outline" },
  argTypes: { variant: { control: "select", options: [...variants] } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: choose one view or filter from a short set. Source: src/components/ui/toggle-group.tsx. Limitations: the choice is local to this preview. Each item pairs an icon with a text label and exposes aria-pressed.",
      },
    },
  },
} satisfies Meta<typeof ToggleGroupStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Outline: Story = {};
export const Default: Story = { args: { variant: "default" } };
