import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import "@/features/ux-reset/ux-reset.css";

import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { CountyScoreSummary } from "@/generated/models";

function county(
  fips: string,
  pathogenStatus: string,
  state = "CO",
  stateName = "Colorado"
): CountyScoreSummary {
  return {
    burgdorferi_status: pathogenStatus,
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
    state,
    state_name: stateName,
    tick_status: "Reported",
  };
}

const paint = paintExplorerMapLayer({
  counties: [
    county("08013", "No records"),
    county("08001", "Present"),
    county("11001", "Absent", "DC", "District of Columbia"),
    county("08014", "Unknown"),
    county("36001", "Emerging", "NY", "New York"),
  ],
  layerId: "pathogen_status",
  scoresStatus: "ready",
});

const meta = {
  title: "Atlas/Explorer pathogen legend",
  component: ExplorerMapLegend,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "B. burgdorferi status legend. Swatches use the pathogen-only contract, with persistent category labels. No records stays distinct from Absent and Unknown.",
      },
    },
  },
  args: { paint },
} satisfies Meta<typeof ExplorerMapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Burgdorferi: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};
