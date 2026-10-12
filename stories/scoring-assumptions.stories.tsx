import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ScoringAssumptions } from "@/components/experiment-atlas";
import type { ScoreSettings } from "@/lib/atlas-ui";

import { publishedCounty } from "./fixtures/story-counties";

const presets = ["open", "collapsible"] as const;

type ScorePreset = (typeof presets)[number];

const initialSettings: ScoreSettings = {
  ecological_share: 60,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 70,
};

function ScoringStory({ preset }: { preset: ScorePreset }) {
  const [settings, setSettings] = useState(initialSettings);
  return (
    <div className="grid max-w-3xl gap-3">
      <p className="type-small">
        Synthetic scoring assumptions for Adams County, Colorado. The ranges
        stay in this preview. MapLibre is not mounted.
      </p>
      <p data-testid="score-share">
        {`Tick and pathogen share ${settings.ecological_share}%`}
      </p>
      <button
        onClick={() => {
          setSettings(initialSettings);
        }}
        type="button"
      >
        Reset assumptions
      </button>
      <ScoringAssumptions
        collapsible={preset === "collapsible"}
        detail={publishedCounty}
        onChange={setSettings}
        settings={settings}
      />
    </div>
  );
}

const meta = {
  title: "Investigation/Scoring assumptions",
  component: ScoringStory,
  parameters: { layout: "padded", docs: { story: { inline: false } } },
  args: { preset: "open" },
  argTypes: { preset: { control: "select", options: presets } },
} satisfies Meta<typeof ScoringStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Collapsible: Story = { args: { preset: "collapsible" } };
