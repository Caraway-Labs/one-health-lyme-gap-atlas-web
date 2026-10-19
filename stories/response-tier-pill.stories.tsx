import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ResponseTierPill } from "@/components/response-tier-pill";
import type { CountyDetail } from "@/generated/models";
import { REVIEW_SCORE_RAMP_COLORS } from "@/lib/atlas-ui";

import "@/features/ux-reset/ux-reset.css";

const release = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-01-01",
  limitations: "Synthetic limitation. This story does not call the API.",
  loaded_at: "2026-01-01",
  methodology_version: "synthetic",
  release_id: "alpha-2026",
  schema_version: "test",
  scope: "test",
  score_defaults: {} as CountyDetail["release"]["score_defaults"],
  sources: [],
  states: [],
};

function syntheticCounty(color: string, fips: string): CountyDetail {
  return {
    burgdorferi_status: "Present",
    case_count_floor_2023: 4,
    color,
    county: "Example County",
    evidence_completeness: 100,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    incidence_floor_2023: 1,
    pacificus_status: "No records",
    population: 1000,
    priority: "Priority 2 — Review",
    release,
    rucc_2023: 2,
    scapularis_status: "Established",
    score: {
      access_signal: 10,
      community: 10,
      ecological: 10,
      human_weakness: 10,
      pathogen_signal: 10,
      rural_signal: 10,
      score: 40,
      svi_signal: 10,
      tick_signal: 10,
    },
    state: "CO",
    state_name: "Colorado",
    state_unallocated_records_2023: 0,
    svi_percentile: 0.4,
    tick_status: "Established",
    uninsured_percent: 8,
    uninsured_percentile: 0.5,
  };
}

function SixTierGallery() {
  return (
    <ul
      style={{
        display: "grid",
        gap: "0.75rem",
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {REVIEW_SCORE_RAMP_COLORS.map((color, index) => (
        <li key={color}>
          <ResponseTierPill
            detail={syntheticCounty(color, `0800${index + 1}`)}
          />
        </li>
      ))}
      <li>
        <ResponseTierPill detail={syntheticCounty(" ", "08013")} />
      </li>
    </ul>
  );
}

const meta = {
  title: "Atlas/Response tier pill",
  component: ResponseTierPill,
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: the six approved Selected County response-tier lines on the existing map-ramp colors. Source: src/components/response-tier-pill.tsx. Limitations: Example County, Colorado fixtures are synthetic, including the numeric score. Colors are the published ramp tokens, not a new palette. The blank color shows the unavailable state. This gallery does not call the API.",
      },
    },
  },
} satisfies Meta<typeof ResponseTierPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SixTiers: Story = {
  args: {
    detail: syntheticCounty(REVIEW_SCORE_RAMP_COLORS[0], "08001"),
  },
  render: () => <SixTierGallery />,
};

export const Lower: Story = {
  args: {
    detail: syntheticCounty(REVIEW_SCORE_RAMP_COLORS[0], "08001"),
  },
};
