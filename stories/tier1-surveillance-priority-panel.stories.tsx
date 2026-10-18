import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Tier1SurveillancePriorityPanel } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";

import {
  tier1StoryPresetIds,
  tier1StoryView,
  type Tier1StoryPresetId,
} from "./fixtures/tier1-views";

type Tier1StoryProps = {
  heading: "h2" | "h3";
  preset: Tier1StoryPresetId;
};

function Tier1Story({ heading, preset }: Tier1StoryProps) {
  return (
    <>
      <p className="type-small" data-testid="tier1-synthetic-notice">
        Synthetic catalog example for Adams County, Colorado (08001). Returned
        batch identifiers are a captured payload relabeled to this county and
        synthetic release alpha-2026, not a live result. The release-mismatch
        preset keeps the captured release so the tier stays withheld.
      </p>
      <Tier1SurveillancePriorityPanel
        headingLevel={heading}
        view={tier1StoryView(preset)}
      />
    </>
  );
}

const meta = {
  title: "Surveillance Priority/Tier 1 surveillance priority panel",
  component: Tier1Story,
  args: { heading: "h2", preset: "high-sufficient" },
  argTypes: {
    heading: { control: "select", options: ["h2", "h3"] },
    preset: { control: "select", options: [...tier1StoryPresetIds] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: model-assisted surveillance review priority for one county. Source: Tier1SurveillancePriorityPanel in src/features/ux-reset/surveillance-priority/tier1-surveillance-priority.tsx. This story mounts the presentation panel only. The canvas states that returned batch identifiers are a captured payload relabeled to Adams County, Colorado (08001) and synthetic release alpha-2026. Limitations: a withheld, failed, stale, or unaligned result is not low priority and is not disease risk or predicted incidence. The release-mismatch preset keeps the captured release against alpha-2026 so the tier stays withheld. Batch generated time is the model batch, not the request time. The model-native score is not incidence. Open Model and as-of details on returned views.",
      },
    },
  },
} satisfies Meta<typeof Tier1Story>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighSufficient: Story = {};
export const MediumSufficient: Story = {
  args: { preset: "medium-sufficient" },
};
export const LowInsufficient: Story = { args: { preset: "low-insufficient" } };
export const NotEstimable: Story = { args: { preset: "not-estimable" } };
export const Unavailable: Story = { args: { preset: "unavailable" } };
export const Loading: Story = { args: { preset: "loading" } };
export const Failed: Story = { args: { preset: "failed" } };
export const Stale: Story = { args: { preset: "stale" } };
export const ReleaseUnknown: Story = { args: { preset: "release-unknown" } };
export const ReleaseMismatch: Story = { args: { preset: "release-mismatch" } };
