import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import "@/features/ux-reset/ux-reset.css";

import { paintExplorerMapLayer } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import type { CountyScoreSummary } from "@/generated/models";

function county(
  fips: string,
  patch: Partial<CountyScoreSummary> = {}
): CountyScoreSummary {
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
    tick_status: "No records",
    ...patch,
  };
}

const pathogen = paintExplorerMapLayer({
  counties: [
    county("08013", { burgdorferi_status: "No records" }),
    county("08001", { burgdorferi_status: "Present" }),
  ],
  layerId: "pathogen_status",
  scoresStatus: "ready",
});

const tick = paintExplorerMapLayer({
  counties: [
    county("08013", { tick_status: "No records" }),
    county("08005", { tick_status: "Reported" }),
    county("08001", { tick_status: "Established" }),
  ],
  layerId: "tick_status",
  scoresStatus: "ready",
});

const gapScore = paintExplorerMapLayer({
  counties: [county("08001")],
  layerId: "gap_score",
  scoresStatus: "ready",
});

function PillCompare() {
  return (
    <div className="grid max-w-xl gap-4">
      <ExplorerMapLegend paint={pathogen} />
      <ExplorerMapLegend paint={tick} />
      <ExplorerMapLegend paint={gapScore} />
    </div>
  );
}

const meta = {
  title: "Atlas/Explorer legend pill",
  component: PillCompare,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shared Explorer pill. Two pathogen categories and three tick categories are shorter than the seven-color gap-score pill, with the same bar height and rounded outer ends.",
      },
    },
  },
} satisfies Meta<typeof PillCompare>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CategoryWidths: Story = {};
