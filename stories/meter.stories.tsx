import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Meter, MeterLabel, MeterValue } from "@/components/ui/meter";

function MeterStory({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid max-w-sm gap-2">
      <p className="type-small">
        Synthetic value inside a 0 to 100 range. Not a disease-risk score and
        not a live county result.
      </p>
      <Meter aria-label={label} max={100} min={0} value={value}>
        <MeterLabel>{label}</MeterLabel>
        <MeterValue />
      </Meter>
    </div>
  );
}

const meta = {
  title: "Primitives/Meter",
  component: MeterStory,
  args: { label: "Gap score (synthetic)", value: 64 },
  argTypes: {
    label: { control: "text" },
    value: { control: { max: 100, min: 0, type: "number" } },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: show a scalar inside a known range, such as a 0 to 100 score or evidence completeness. Source: src/components/ui/meter.tsx. Limitations: values are synthetic. The meter never animates severity. Use Progress for task progress.",
      },
    },
  },
} satisfies Meta<typeof MeterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Score: Story = {};
export const Completeness: Story = {
  args: { label: "Evidence completeness (synthetic)", value: 82 },
};
export const Empty: Story = { args: { value: 0 } };
export const Full: Story = { args: { value: 100 } };
