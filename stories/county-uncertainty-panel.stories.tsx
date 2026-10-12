import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CountyUncertaintyPanel } from "@/components/county-evidence-panel";
import type { CountyDetail } from "@/generated/models";

import { missingCounty, publishedZeroCounty } from "./fixtures/story-counties";

const presets = ["complete", "limited"] as const;

type UncertaintyPreset = (typeof presets)[number];

function detailFor(preset: UncertaintyPreset): CountyDetail {
  switch (preset) {
    case "complete": {
      return publishedZeroCounty;
    }
    case "limited": {
      return missingCounty;
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function UncertaintyStory({ preset }: { preset: UncertaintyPreset }) {
  return (
    <div className="max-w-xl">
      <CountyUncertaintyPanel detail={detailFor(preset)} />
    </div>
  );
}

const meta = {
  title: "County/Uncertainty panel",
  component: UncertaintyStory,
  parameters: {
    atlasLandmark: "story",
    layout: "padded",
    docs: {
      description: {
        component:
          "CountyUncertaintyPanel from src/components/county-evidence-panel.tsx shows data-dependent uncertainty cues and the release limitation for synthetic complete and limited counties.",
      },
    },
  },
  args: { preset: "complete" },
  argTypes: { preset: { control: "select", options: presets } },
} satisfies Meta<typeof UncertaintyStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Complete: Story = {};

export const Limited: Story = { args: { preset: "limited" } };
