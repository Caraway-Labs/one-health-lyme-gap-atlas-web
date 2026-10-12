import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AtlasSectionHeader } from "@/components/atlas-section-header";

const meta = {
  title: "Atlas/Section header",
  component: AtlasSectionHeader,
  parameters: { layout: "padded" },
  args: {
    eyebrow: "County review",
    title: "Adams County, Colorado",
    description:
      "Synthetic section for this preview. Not a live county result.",
    headingLevel: "h2",
  },
} satisfies Meta<typeof AtlasSectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithAside: Story = {
  args: {
    aside: <span className="result-count">3</span>,
  },
};

export const TitleOnly: Story = {
  args: {
    aside: undefined,
    description: undefined,
    eyebrow: undefined,
    headingLevel: "h3",
    title: "Evidence used for this county",
  },
};

export const LongTitle: Story = {
  args: {
    aside: <span className="result-count">District of Columbia</span>,
    description:
      "A long description stays with the heading when the aside wraps on a narrow preview.",
    headingLevel: "h4",
    title:
      "Synthetic county with a long heading that wraps beside the aside on a narrow layout",
  },
};
