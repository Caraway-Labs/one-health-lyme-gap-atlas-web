import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReleaseEvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";

import {
  releaseEvidencePreset,
  releaseEvidencePresetIds,
  type ReleaseEvidencePresetId,
} from "./fixtures/evidence-presets";

type ReleaseStripStoryProps = {
  narrow: boolean;
  preset: ReleaseEvidencePresetId;
};

function ReleaseStripStory({ narrow, preset }: ReleaseStripStoryProps) {
  const model = releaseEvidencePreset(preset);
  return (
    <div className={narrow ? "max-w-80" : undefined}>
      <ReleaseEvidenceStateStrip
        context={model.context}
        errorMessage={model.errorMessage}
        loadState={model.loadState}
      />
    </div>
  );
}

const meta = {
  title: "Data and Evidence/Release evidence state strip",
  component: ReleaseStripStory,
  args: { narrow: false, preset: "ready-complete" },
  argTypes: {
    narrow: { control: "boolean" },
    preset: { control: "select", options: [...releaseEvidencePresetIds] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: one governed release snapshot shared by Reset pages. Source: ReleaseEvidenceStateStrip in src/features/ux-reset/evidence/evidence-state-strip.tsx. Limitations: loading and request error are transport states and do not show an evidence-availability badge. A ready response without context stays distinct from those states. The preset chooses a coherent context, including the default or synthetic error message. No freshness is invented.",
      },
    },
  },
} satisfies Meta<typeof ReleaseStripStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadyComplete: Story = {};
export const ReadyLimited: Story = { args: { preset: "ready-limited" } };
export const Loading: Story = { args: { preset: "loading" } };
export const ErrorDefault: Story = { args: { preset: "error-default" } };
export const ErrorSynthetic: Story = { args: { preset: "error-synthetic" } };
export const ReadyWithoutContext: Story = {
  args: { preset: "ready-without-context" },
};
export const Narrow: Story = {
  args: { narrow: true, preset: "ready-complete" },
};
