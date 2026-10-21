import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import "@/features/ux-reset/ux-reset.css";

import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { CountyScoreSummary } from "@/generated/models";

function county(fips: string, tickStatus: string): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#a9d2db",
    county: "County",
    evidence_completeness: 40,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 12,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: tickStatus,
  };
}

const paint = paintExplorerMapLayer({
  counties: [
    county("08013", "No records"),
    county("08005", "Reported"),
    county("08001", "Established"),
    county("08014", "Unknown"),
  ],
  layerId: "tick_status",
  scoresStatus: "ready",
});

const meta = {
  title: "Atlas/Explorer tick legend",
  component: ExplorerMapLegend,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Blacklegged tick status legend. Categories share one segmented pill, with persistent labels under each segment.",
      },
    },
  },
  args: { paint },
} satisfies Meta<typeof ExplorerMapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Blacklegged: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
