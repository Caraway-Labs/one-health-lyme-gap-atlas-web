import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CountyEvidencePanel } from "@/components/county-evidence-panel";
import type { CountyDetail } from "@/generated/models";

import {
  missingCounty,
  publishedCounty,
  publishedZeroCounty,
} from "./fixtures/story-counties";

const presets = ["published", "published-zero", "missing", "compact"] as const;

type EvidencePreset = (typeof presets)[number];

function detailFor(preset: EvidencePreset): CountyDetail {
  switch (preset) {
    case "published":
    case "compact": {
      return publishedCounty;
    }
    case "published-zero": {
      return publishedZeroCounty;
    }
    case "missing": {
      return missingCounty;
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function EvidenceStory({ preset }: { preset: EvidencePreset }) {
  return (
    <CountyEvidencePanel
      compact={preset === "compact"}
      detail={detailFor(preset)}
    />
  );
}

const meta = {
  title: "County/Evidence panel",
  component: EvidenceStory,
  parameters: { layout: "padded", docs: { story: { inline: false } } },
  args: { preset: "published" },
  argTypes: { preset: { control: "select", options: presets } },
} satisfies Meta<typeof EvidenceStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Published: Story = {};

export const PublishedZero: Story = { args: { preset: "published-zero" } };

export const Missing: Story = { args: { preset: "missing" } };

export const Compact: Story = { args: { preset: "compact" } };
