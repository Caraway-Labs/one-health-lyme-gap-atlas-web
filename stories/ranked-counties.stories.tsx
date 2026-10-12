import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { RankedCounties } from "@/components/ranked-counties";

import {
  boulderCounty,
  districtCounty,
  storyRankedCounties,
  wakeCounty,
} from "./fixtures/story-counties";

const shortList = [boulderCounty, wakeCounty, districtCounty];

const presets = ["empty", "short", "selected", "long-list"] as const;

type RankPreset = (typeof presets)[number];

function countiesFor(preset: RankPreset) {
  switch (preset) {
    case "empty": {
      return [];
    }
    case "short":
    case "selected": {
      return shortList;
    }
    case "long-list": {
      return storyRankedCounties(41);
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function RankedStory({ preset }: { preset: RankPreset }) {
  return <RankedPreview key={preset} preset={preset} />;
}

function RankedPreview({ preset }: { preset: RankPreset }) {
  const counties = countiesFor(preset);
  const [selectedFips, setSelectedFips] = useState(
    preset === "selected" ? boulderCounty.fips : ""
  );
  const [showTable, setShowTable] = useState(false);
  const selected = counties.find((county) => county.fips === selectedFips);
  return (
    <div className="grid max-w-xl gap-3">
      <p className="type-small">
        Synthetic ranked counties. Selection and the full-list toggle stay in
        this preview.
      </p>
      <p data-testid="ranked-selection">
        {selected
          ? `Selected ${selected.county} (${selected.fips})`
          : "Selected none"}
      </p>
      <p data-testid="ranked-table">
        {showTable ? "Full list open" : "Shortlist only"}
      </p>
      <RankedCounties
        counties={counties}
        onSelect={(fips) => {
          setSelectedFips(fips);
        }}
        onToggleTable={() => {
          setShowTable((current) => !current);
        }}
        selectedFips={selectedFips}
        showTable={showTable}
      />
    </div>
  );
}

const meta = {
  title: "Overview/Ranked counties",
  component: RankedStory,
  parameters: { layout: "padded" },
  args: { preset: "short" },
  argTypes: { preset: { control: "select", options: presets } },
  excludeStories: ["RankedStory"],
} satisfies Meta<typeof RankedStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Short: Story = {};

export const Empty: Story = { args: { preset: "empty" } };

export const Selected: Story = { args: { preset: "selected" } };

export const LongList: Story = { args: { preset: "long-list" } };
