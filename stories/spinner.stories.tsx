import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Spinner } from "@/components/ui/spinner";

function SpinnerStory({ large }: { large: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Spinner className={large ? "size-8" : undefined} />
      <span>Loading synthetic county evidence</span>
    </div>
  );
}

const meta = {
  title: "Primitives/Spinner",
  component: SpinnerStory,
  args: { large: false },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: neutral loading indicator. Source: src/components/ui/spinner.tsx. Limitations: loading and error are not Unavailable, so never show a value-shaped placeholder. The spinner has role status, a Loading name, and stops spinning under reduced motion.",
      },
    },
  },
} satisfies Meta<typeof SpinnerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Large: Story = { args: { large: true } };
