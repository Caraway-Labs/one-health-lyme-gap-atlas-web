import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";

const meta = {
  title: "Atlas/Data stamp",
  component: AtlasDataStamp,
  args: {
    label: "Illustrative snapshot — fixture only",
    variant: "card",
    children:
      "Source: synthetic fixture · Retrieved: 2026-10-11 · Geography: example only · Method: demo-v1 · Limitation: not research evidence",
  },
  argTypes: {
    variant: { control: "select", options: ["card", "inline"] },
    children: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Existing snapshot/version composition. Sample provenance is synthetic and explicitly labeled; no actual release or source-backed score is represented.",
      },
    },
  },
} satisfies Meta<typeof AtlasDataStamp>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Snapshot: Story = {};
export const Inline: Story = { args: { variant: "inline" } };
