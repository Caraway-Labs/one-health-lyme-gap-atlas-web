import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import {
  RELEASE_TRENDS_PREREQUISITE,
  VIEW_LABELS,
  type View,
} from "@/features/geographic-explorer/model";

import "@/features/geographic-explorer/explorer.css";
import { GeographicExplorerViewSelector } from "@/features/geographic-explorer/view-selector";

const presets = ["tiles", "trends"] as const;

type ViewPreset = (typeof presets)[number];

export function ViewStory({ preset }: { preset: ViewPreset }) {
  return <ViewPreview key={preset} preset={preset} />;
}

function ViewPreview({ preset }: { preset: ViewPreset }) {
  const [activeView, setActiveView] = useState<View>(preset);
  return (
    <div className="grid gap-3">
      <p className="type-small">
        Supported views only. Release trends stays unavailable until comparable
        release history exists: {RELEASE_TRENDS_PREREQUISITE}
      </p>
      <p data-testid="active-view">{`Active view ${VIEW_LABELS[activeView]}`}</p>
      <GeographicExplorerViewSelector
        activeView={activeView}
        onViewChange={setActiveView}
      />
    </div>
  );
}

const meta = {
  title: "Geographic explorer/View selector",
  component: ViewStory,
  parameters: { layout: "padded", docs: { story: { inline: false } } },
  args: { preset: "tiles" },
  argTypes: { preset: { control: "select", options: presets } },
  excludeStories: ["ViewStory"],
} satisfies Meta<typeof ViewStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tiles: Story = {};

export const Trends: Story = { args: { preset: "trends" } };
