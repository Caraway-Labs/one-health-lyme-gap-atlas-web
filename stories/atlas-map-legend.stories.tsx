import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasMapLegend } from "@/components/atlas-map-legend";

const meta = {
  title: "Atlas/Map legend",
  component: AtlasMapLegend,
  parameters: { layout: "padded" },
  args: {
    caption:
      "County Review Priority for this synthetic release. The ramp is not a disease-risk scale.",
    highLabel: "Higher review priority",
    lowLabel: "Lower review priority",
  },
} satisfies Meta<typeof AtlasMapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReviewPriority: Story = {};

export const Narrow: Story = {
  args: {
    caption: "Narrow legend. Colors keep their review-priority meaning.",
    highLabel: "Higher review priority",
    lowLabel: "Lower review priority",
  },
  decorators: [
    (Story) => (
      <div className="max-w-48">
        <Story />
      </div>
    ),
  ],
};
