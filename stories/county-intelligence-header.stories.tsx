import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  CountyIntelligenceHeader,
  type CountyIntelligenceHeaderModel,
} from "@/features/ux-reset/investigate/county-intelligence-header";

import {
  syntheticCounty,
  syntheticReleaseId,
} from "./fixtures/synthetic-county";

import "@/features/ux-reset/ux-reset.css";

const headerPresets = [
  "resolved",
  "fips-fallback",
  "no-county",
  "long-label",
] as const;

type HeaderPreset = (typeof headerPresets)[number];

const RETURN_HREF = "/app/review?scope=CO&dataset=alpha-2026";

export function headerModel(
  preset: HeaderPreset
): CountyIntelligenceHeaderModel {
  switch (preset) {
    case "resolved": {
      return {
        countyLabel: syntheticCounty.name,
        fips: syntheticCounty.fips,
        releaseId: syntheticReleaseId,
        returnHref: RETURN_HREF,
        scopeLabel: "Colorado",
        stateLabel: syntheticCounty.stateName,
      };
    }
    case "fips-fallback": {
      return {
        countyLabel: null,
        fips: syntheticCounty.fips,
        releaseId: syntheticReleaseId,
        returnHref: RETURN_HREF,
        scopeLabel: "Colorado",
        stateLabel: null,
      };
    }
    case "no-county": {
      return {
        countyLabel: null,
        fips: null,
        releaseId: null,
        returnHref: "/app/review?scope=ALL",
        scopeLabel: "United States",
        stateLabel: null,
      };
    }
    case "long-label": {
      return {
        countyLabel:
          "Adams County public-health investigation workspace for a long synthetic label",
        fips: syntheticCounty.fips,
        releaseId: syntheticReleaseId,
        returnHref: RETURN_HREF,
        scopeLabel: "North Carolina",
        stateLabel: "North Carolina",
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function HeaderStory({ preset }: { preset: HeaderPreset }) {
  return (
    <main className="ux-reset-pro-main grid gap-3">
      <p className="type-small">
        Synthetic Investigate header for Adams County, Colorado (08001), release
        alpha-2026. Return to Atlas Explorer stays inside the workspace.
      </p>
      <CountyIntelligenceHeader model={headerModel(preset)} />
    </main>
  );
}

const meta = {
  title: "County Investigation/County intelligence header",
  component: HeaderStory,
  excludeStories: ["headerModel"],
  args: { preset: "resolved" },
  argTypes: {
    preset: { control: "select", options: [...headerPresets] },
  },
  parameters: {
    atlasLandmark: "story",
    docs: {
      description: {
        component:
          "Purpose: county identity and the return path for one investigation. Source: src/features/ux-reset/investigate/county-intelligence-header.tsx. Limitations: Adams County, Colorado (08001) is synthetic. A missing name falls back to the FIPS. No county says Choose a county. The return link is an in-app Review path.",
      },
    },
  },
} satisfies Meta<typeof HeaderStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resolved: Story = {};
export const FipsFallback: Story = { args: { preset: "fips-fallback" } };
export const NoCounty: Story = { args: { preset: "no-county" } };
export const LongLabel: Story = { args: { preset: "long-label" } };
