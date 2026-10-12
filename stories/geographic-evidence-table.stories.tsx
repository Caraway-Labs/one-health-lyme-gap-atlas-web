import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { EvidenceTable } from "@/features/geographic-explorer/charts";

import "@/features/geographic-explorer/explorer.css";

import { storyChartCounties } from "./fixtures/story-counties";

const presets = ["none", "boulder"] as const;

type TablePreset = (typeof presets)[number];

export function EvidenceTableStory({ preset }: { preset: TablePreset }) {
  return <TablePreview key={preset} preset={preset} />;
}

function TablePreview({ preset }: { preset: TablePreset }) {
  const [selectedFips, setSelectedFips] = useState(
    preset === "boulder" ? "08013" : ""
  );
  const selected = storyChartCounties.find(
    (county) => county.fips === selectedFips
  );
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Same synthetic counties as the state grid and scatter plot. Values stay
        exact. This preview does not sort or page the rows.
      </p>
      <p data-testid="evidence-selection">
        {selected
          ? `Selected ${selected.county} (${selected.fips})`
          : "Selected none"}
      </p>
      <EvidenceTable
        counties={storyChartCounties}
        onSelect={setSelectedFips}
        selectedFips={selectedFips}
      />
    </div>
  );
}

const meta = {
  title: "Geographic explorer/Evidence table",
  component: EvidenceTableStory,
  parameters: { layout: "padded" },
  args: { preset: "none" },
  argTypes: { preset: { control: "select", options: presets } },
  excludeStories: ["EvidenceTableStory"],
} satisfies Meta<typeof EvidenceTableStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Boulder: Story = { args: { preset: "boulder" } };
