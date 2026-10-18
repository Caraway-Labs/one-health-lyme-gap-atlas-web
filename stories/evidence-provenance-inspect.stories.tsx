import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";

import {
  provenancePreset,
  provenancePresetIds,
  type ProvenancePresetId,
} from "./fixtures/evidence-presets";

type ProvenanceStoryProps = {
  preset: ProvenancePresetId;
};

function ProvenanceStory({ preset }: ProvenanceStoryProps) {
  const props = provenancePreset(preset);
  if (props.stateLabel !== undefined) {
    return (
      <EvidenceProvenanceInspect
        provenance={props.provenance}
        stateLabel={props.stateLabel}
      />
    );
  }
  return (
    <EvidenceProvenanceInspect
      availability={props.availability}
      provenance={props.provenance}
      reasonCode={props.reasonCode}
    />
  );
}

const meta = {
  title: "Data and Evidence/Evidence provenance inspect",
  component: ProvenanceStory,
  args: { preset: "full-reason" },
  argTypes: {
    preset: { control: "select", options: [...provenancePresetIds] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: progressive provenance disclosure for one evidence state. Source: src/features/ux-reset/evidence/evidence-provenance-inspect.tsx. Limitations: use either availability plus reason code, or a state label, never both. Unreadable dates and configuration digests stay Unavailable. Links are synthetic https://example.com references. Opening the disclosure does not send analytics. Use Enter or click on Inspect provenance, then on the nested technical disclosure.",
      },
    },
  },
} satisfies Meta<typeof ProvenanceStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullReason: Story = {};
export const StateLabelMissing: Story = {
  args: { preset: "state-label-missing" },
};
export const TechnicalUnreadable: Story = {
  args: { preset: "technical-unreadable" },
};
