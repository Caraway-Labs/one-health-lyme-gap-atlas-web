import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { GeographicGrid } from "@/features/geographic-explorer/charts";

import "@/features/geographic-explorer/explorer.css";

import { storyChartCounties } from "./fixtures/story-counties";

const gridPresets = ["none", "colorado"] as const;

type GridPreset = (typeof gridPresets)[number];

export function GridStory({
  multiples,
  preset,
}: {
  multiples: boolean;
  preset: GridPreset;
}) {
  return (
    <GridPreview
      key={`${preset}:${String(multiples)}`}
      multiples={multiples}
      preset={preset}
    />
  );
}

function GridPreview({
  multiples,
  preset,
}: {
  multiples: boolean;
  preset: GridPreset;
}) {
  const [state, setState] = useState(preset === "colorado" ? "CO" : "ALL");
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic counties are Adams and Boulder in Colorado and Wake County in
        North Carolina. Empty state tiles stay disabled.
      </p>
      <p data-testid="grid-state">{`Selected state ${state}`}</p>
      <GeographicGrid
        counties={storyChartCounties}
        maximum={100}
        multiples={multiples}
        onState={setState}
        state={state}
      />
    </div>
  );
}

const gridMeta = {
  title: "Geographic explorer/State grid",
  component: GridStory,
  parameters: { layout: "padded" },
  args: { multiples: false, preset: "none" },
  argTypes: { preset: { control: "select", options: gridPresets } },
  excludeStories: ["GridStory"],
} satisfies Meta<typeof GridStory>;

export default gridMeta;

type GridStoryObj = StoryObj<typeof gridMeta>;

export const Tiles: GridStoryObj = {};

export const Multiples: GridStoryObj = { args: { multiples: true } };

export const Colorado: GridStoryObj = { args: { preset: "colorado" } };
