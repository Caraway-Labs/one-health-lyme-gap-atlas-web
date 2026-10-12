import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasEvidenceSnapshot } from "@/components/atlas-evidence-snapshot";

import { storyRelease, storyReleaseMissing } from "./fixtures/story-counties";

const meta = {
  title: "Atlas/Evidence snapshot",
  component: AtlasEvidenceSnapshot,
  parameters: { layout: "padded", docs: { story: { inline: false } } },
  args: {
    layout: "card",
    metadata: storyRelease,
    methodsHref: "#methods",
  },
} satisfies Meta<typeof AtlasEvidenceSnapshot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Card: Story = {};

export const Banner: Story = {
  args: { layout: "banner" },
};

export const Missing: Story = {
  args: {
    metadata: storyReleaseMissing,
  },
};
