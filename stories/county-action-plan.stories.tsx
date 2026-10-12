import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CountyActionPlan } from "@/components/county-action-plan";
import type { CountyDetail } from "@/generated/models";

import { missingCounty, publishedCounty } from "./fixtures/story-counties";

const presets = ["priority", "missing-records"] as const;

type PlanPreset = (typeof presets)[number];

function detailFor(preset: PlanPreset): CountyDetail {
  switch (preset) {
    case "priority": {
      return publishedCounty;
    }
    case "missing-records": {
      return missingCounty;
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function PlanStory({ preset }: { preset: PlanPreset }) {
  return <CountyActionPlan detail={detailFor(preset)} />;
}

const meta = {
  title: "County/Action plan",
  component: PlanStory,
  parameters: { layout: "padded" },
  args: { preset: "priority" },
  argTypes: { preset: { control: "select", options: presets } },
} satisfies Meta<typeof PlanStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Priority: Story = {};

export const MissingRecords: Story = { args: { preset: "missing-records" } };
