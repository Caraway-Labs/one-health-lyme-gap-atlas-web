import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";

import {
  evidenceStripPreset,
  evidenceStripPresetIds,
  type EvidenceStripPresetId,
} from "./fixtures/evidence-presets";

type EvidenceStripStoryProps = {
  narrow: boolean;
  preset: EvidenceStripPresetId;
  showReason: boolean;
};

function EvidenceStripStory({
  narrow,
  preset,
  showReason,
}: EvidenceStripStoryProps) {
  const model = evidenceStripPreset(preset);
  return (
    <div className={narrow ? "max-w-80" : undefined}>
      <EvidenceStateStrip model={model} showReason={showReason} />
    </div>
  );
}

const meta = {
  title: "Data and Evidence/Evidence state strip",
  component: EvidenceStripStory,
  args: {
    narrow: false,
    preset: "available-with-vintage",
    showReason: false,
  },
  argTypes: {
    narrow: { control: "boolean" },
    preset: { control: "select", options: [...evidenceStripPresetIds] },
    showReason: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: compact availability, source, period, vintage, evidence type, and caveat beside an evidence value. Source: EvidenceStateStrip in src/features/ux-reset/evidence/evidence-state-strip.tsx. Limitations: vintage, reason, and caveat appear only when that preset returned them. The narrow control is a 20rem frame for reflow. It does not invent freshness.",
      },
    },
  },
} satisfies Meta<typeof EvidenceStripStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AvailableWithVintage: Story = {};
export const AvailableWithoutOptional: Story = {
  args: { preset: "available-without-optional", showReason: true },
};
export const LimitedWithCaveat: Story = {
  args: { preset: "limited-with-caveat", showReason: true },
};
export const UnavailableWithoutOptional: Story = {
  args: { preset: "unavailable-without-optional", showReason: true },
};
export const Narrow: Story = {
  args: { narrow: true, preset: "limited-with-caveat", showReason: true },
};
