import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";

import {
  evidenceObjectPreset,
  evidenceObjectPresetIds,
  type EvidenceObjectPresetId,
} from "./fixtures/evidence-presets";

type EvidenceObjectStoryProps = {
  heading: "h3" | "h4" | "h5";
  preset: EvidenceObjectPresetId;
  showReason: boolean;
};

function EvidenceObjectStory({
  heading,
  preset,
  showReason,
}: EvidenceObjectStoryProps) {
  return (
    <section aria-label="Synthetic evidence context">
      <h2 className="sr-only">Synthetic evidence context</h2>
      <EvidenceObject
        claimHeadingLevel={heading}
        model={evidenceObjectPreset(preset)}
        showReason={showReason}
      />
    </section>
  );
}

const meta = {
  title: "Data and Evidence/Evidence object",
  component: EvidenceObjectStory,
  args: {
    heading: "h3",
    preset: "observed-nonzero",
    showReason: false,
  },
  argTypes: {
    heading: {
      control: "select",
      options: ["h3", "h4", "h5"],
    },
    preset: { control: "select", options: [...evidenceObjectPresetIds] },
    showReason: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: shared evidence row for Reset Review, Explore, Investigate, and Compare. Source: src/features/ux-reset/evidence/evidence-object.tsx. Limitations: presets are synthetic and keep availability, value, reason, and provenance together. Zero is a published value; a missing record stays Unavailable even when the payload value is 0. Suppression is Limited, not a number. Use the preset, reason, and heading controls. Open Inspect provenance with the keyboard or pointer.",
      },
    },
  },
} satisfies Meta<typeof EvidenceObjectStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ObservedNonzero: Story = {};
export const PublishedZero: Story = {
  args: { preset: "published-zero", showReason: true },
};
export const Suppressed: Story = {
  args: { preset: "suppressed", showReason: true },
};
export const Missing: Story = { args: { preset: "missing", showReason: true } };
export const PreciseCaveat: Story = { args: { preset: "precise-caveat" } };
