import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";

import "@/features/ux-reset/ux-reset.css";

function FooterStory() {
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic professional trust footer. The brand opens the public About
        route in a new tab. Privacy and AI / Responsible Use open the public
        trust pages. Privacy settings stays on the workspace settings path. The
        mark is the Storybook asset, not a remote image.
      </p>
      <ProfessionalTrustFooter />
    </div>
  );
}

const meta = {
  title: "Navigation and layout/Professional trust footer",
  component: FooterStory,
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: signed-in trust footer. Source: src/features/ux-reset/professional-trust-footer.tsx. Limitations: links are the approved fixed destinations. Privacy and AI / Responsible Use open the public pages. The footer does not accept a long custom link. Narrow reflow is the same component in a narrow viewport. The brand mark is the local Storybook substitute.",
      },
    },
  },
} satisfies Meta<typeof FooterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
