import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";

function SignalBar({ value }: { value: number }) {
  return (
    <div className="grid max-w-sm gap-2">
      <p className="type-small">
        Synthetic signal bar for a ranking influence. Not a disease-risk score
        and not a live county result.
      </p>
      <Progress aria-label="Illustrative signal" value={value}>
        <ProgressLabel>Illustrative signal</ProgressLabel>
        <ProgressValue />
      </Progress>
      <p data-testid="progress-value">{`Signal value ${value}`}</p>
    </div>
  );
}

const meta = {
  title: "Primitives/Progress",
  component: SignalBar,
  args: { value: 40 },
  argTypes: { value: { control: { max: 100, min: 0, type: "number" } } },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: numeric signal bar used beside a label. Source: src/components/ui/progress.tsx. Limitations: the value is a synthetic 0–100 illustration. There is no loading or error API on this primitive.",
      },
    },
  },
} satisfies Meta<typeof SignalBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyBar: Story = { args: { value: 0 } };
export const Mid: Story = {};
export const Full: Story = { args: { value: 100 } };
