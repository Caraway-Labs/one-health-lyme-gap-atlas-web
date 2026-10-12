import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ScatterPlot } from "@/features/geographic-explorer/charts";

import { storyChartCounties } from "./fixtures/story-counties";

const presets = ["none", "adams"] as const;

type ScatterPreset = (typeof presets)[number];

export function ScatterStory({ preset }: { preset: ScatterPreset }) {
  return <ScatterPreview key={preset} preset={preset} />;
}

function ScatterPreview({ preset }: { preset: ScatterPreset }) {
  const [selectedFips, setSelectedFips] = useState(
    preset === "adams" ? "08001" : ""
  );
  const selected = storyChartCounties.find(
    (county) => county.fips === selectedFips
  );
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Boulder and Wake share 50% completeness so their points overlap. Each
        point stays selectable. The scale is 0–100.
      </p>
      <p data-testid="scatter-selection">
        {selected
          ? `Selected ${selected.county} (${selected.fips})`
          : "Selected none"}
      </p>
      <ScatterPlot
        counties={storyChartCounties}
        maximum={100}
        onSelect={setSelectedFips}
        selectedFips={selectedFips}
      />
    </div>
  );
}

const meta = {
  title: "Geographic explorer/Scatter plot",
  component: ScatterStory,
  parameters: { layout: "padded" },
  args: { preset: "none" },
  argTypes: { preset: { control: "select", options: presets } },
  excludeStories: ["ScatterStory"],
} satisfies Meta<typeof ScatterStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Points: Story = {};

export const Adams: Story = { args: { preset: "adams" } };
