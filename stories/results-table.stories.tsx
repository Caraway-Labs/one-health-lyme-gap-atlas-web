import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ResultsTable } from "@/components/results-table";

import {
  boulderCounty,
  districtCounty,
  longNameCounty,
  wakeCounty,
} from "./fixtures/story-counties";

const presets = ["empty", "populated", "long-cell"] as const;

type TablePreset = (typeof presets)[number];

function rowsFor(preset: TablePreset) {
  switch (preset) {
    case "empty": {
      return [];
    }
    case "populated": {
      return [boulderCounty, wakeCounty, districtCounty];
    }
    case "long-cell": {
      return [longNameCounty, boulderCounty];
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function ResultsStory({ preset }: { preset: TablePreset }) {
  return <ResultsPreview key={preset} preset={preset} />;
}

function ResultsPreview({ preset }: { preset: TablePreset }) {
  const counties = rowsFor(preset);
  const [selectedFips, setSelectedFips] = useState("");
  const selected = counties.find((county) => county.fips === selectedFips);
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Synthetic county table. Choosing a county updates the readout and does
        not sort or page the rows.
      </p>
      <p data-testid="results-selection">
        {selected
          ? `Selected ${selected.county} (${selected.fips})`
          : "Selected none"}
      </p>
      <ResultsTable
        counties={counties}
        onSelect={(fips) => {
          setSelectedFips(fips);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Overview/Results table",
  component: ResultsStory,
  parameters: { layout: "padded" },
  args: { preset: "populated" },
  argTypes: { preset: { control: "select", options: presets } },
  excludeStories: ["ResultsStory"],
} satisfies Meta<typeof ResultsStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = { args: { preset: "empty" } };

export const LongCell: Story = { args: { preset: "long-cell" } };
