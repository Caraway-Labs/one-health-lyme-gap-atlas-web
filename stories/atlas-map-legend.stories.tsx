import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasMapLegend } from "@/components/atlas-map-legend";

const meta = {
  title: "Atlas/Map legend",
  component: AtlasMapLegend,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AtlasMapLegend from src/components/atlas-map-legend.tsx shows the review-priority ramp with synthetic captions, and the colors are not a disease-risk scale.",
      },
    },
  },
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
