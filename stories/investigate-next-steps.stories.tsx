import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useLayoutEffect } from "react";

import { InvestigateNextSteps } from "@/features/ux-reset/investigate/investigate-next-steps";
import type { ResolvedInvestigateFinding } from "@/features/ux-reset/investigate/investigate-visible-summary";

import { actionBriefPreset } from "./fixtures/action-brief-presets";
import {
  syntheticCounty,
  syntheticReleaseId,
} from "./fixtures/synthetic-county";
import { setSyntheticPdfExportMode } from "./support/download-investigate-pdf-substitute";

import "@/features/ux-reset/ux-reset.css";

const nextStepPresets = [
  "not-ready",
  "start-compare",
  "return-compare",
  "inspect-finding",
] as const;

type NextStepPreset = (typeof nextStepPresets)[number];

const finding: ResolvedInvestigateFinding = {
  availability: "available",
  evidence: null,
  inspectHref: "#investigate-observation-obs-cases-08001",
  measureId: "reported-cases",
  measureLabel: "Reported Lyme cases",
  text: "Reported Lyme cases: 12 cases. Available. Period 2023. Source CDC surveillance.",
  title: "Reported Lyme cases",
};

function NextStepsStory({ preset }: { preset: NextStepPreset }) {
  useLayoutEffect(() => {
    setSyntheticPdfExportMode("succeed");
  }, []);
  const bundle =
    preset === "not-ready" ? null : actionBriefPreset("ready").realBundle;
  const ready = preset !== "not-ready";
  return (
    <div className="grid gap-3">
      <p className="type-small">
        {`Synthetic next steps for ${syntheticCounty.name}, ${syntheticCounty.stateName} (${syntheticCounty.fips}), release ${syntheticReleaseId}. Links stay inside the workspace. Export does not download a file.`}
      </p>
      <InvestigateNextSteps
        actionHref="/app/action?county=08001&dataset=alpha-2026"
        bundle={bundle}
        compare={preset === "return-compare" ? ["08001", "08013"] : []}
        compareHref={
          preset === "return-compare"
            ? "/app/compare?compare=08001,08013&dataset=alpha-2026"
            : "/app/compare?county=08001&dataset=alpha-2026"
        }
        countyFips={syntheticCounty.fips}
        finding={preset === "inspect-finding" ? finding : null}
        findingCountyLabel={syntheticCounty.name}
        observationsLoaded={ready ? "loaded" : "withheld"}
        requestedPeriod="2023"
        resolvedCounty={ready ? syntheticCounty.fips : null}
      />
    </div>
  );
}

const meta = {
  title: "County Investigation/Investigate next steps",
  component: NextStepsStory,
  args: { preset: "start-compare" },
  argTypes: {
    preset: { control: "select", options: [...nextStepPresets] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Compare, Action, inspect, and PDF offers for one county. Source: src/features/ux-reset/investigate/investigate-next-steps.tsx. Limitations: the bundle is the synthetic Adams County case record on release alpha-2026. Evidence that is not loaded omits Action, Compare, and the PDF. A two-county pair offers Return to Compare. The PDF control uses the Storybook substitute and does not download a file.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof NextStepsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotReady: Story = { args: { preset: "not-ready" } };
export const StartCompare: Story = {};
export const ReturnCompare: Story = { args: { preset: "return-compare" } };
export const InspectFinding: Story = { args: { preset: "inspect-finding" } };
