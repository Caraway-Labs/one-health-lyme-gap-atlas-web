import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useLayoutEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ActionEvidenceBrief } from "@/features/ux-reset/action/evidence-brief-panel";

import {
  actionBriefPreset,
  actionBriefPresetIds,
  type ActionBriefPresetId,
} from "./fixtures/action-brief-presets";
import {
  syntheticCounty,
  syntheticReleaseId,
} from "./fixtures/synthetic-county";
import {
  setSyntheticPdfExportMode,
  syntheticPdfExportModes,
  type SyntheticPdfExportMode,
} from "./support/download-investigate-pdf-substitute";

import "@/features/ux-reset/ux-reset.css";

type ActionEvidenceBriefStoryProps = {
  exportMode: SyntheticPdfExportMode;
  preset: ActionBriefPresetId;
};

export function ActionEvidenceBriefStory({
  exportMode,
  preset,
}: ActionEvidenceBriefStoryProps) {
  const [session, setSession] = useState(0);
  return (
    <div className="grid gap-4">
      <p className="type-small" data-testid="action-brief-synthetic-notice">
        {`Synthetic ${syntheticCounty.name}, ${syntheticCounty.stateName} (${syntheticCounty.fips}), release ${syntheticReleaseId}. The local note is not governed evidence and is not saved. Export PDF does not download a file.`}
      </p>
      <ActionBriefSession
        exportMode={exportMode}
        key={`${preset}:${exportMode}:${session}`}
        onReset={() => {
          setSession((current) => current + 1);
        }}
        preset={preset}
      />
    </div>
  );
}

function ActionBriefSession({
  exportMode,
  onReset,
  preset,
}: ActionEvidenceBriefStoryProps & { onReset: () => void }) {
  const model = actionBriefPreset(preset);
  const [localContext, setLocalContext] = useState(model.localContext);
  useLayoutEffect(() => {
    setSyntheticPdfExportMode(exportMode);
  }, [exportMode]);
  return (
    <div className="grid gap-4">
      <ActionEvidenceBrief
        catalogFailed={model.catalogFailed}
        countyRecord={model.countyRecord}
        countyRecordError={model.countyRecordError}
        countyRecordLoading={model.countyRecordLoading}
        localContext={localContext}
        measures={model.measures}
        observationOutcome={model.observationOutcome}
        onLocalContextChange={setLocalContext}
        period={model.period}
        realBundle={model.realBundle}
        recovery={model.recovery}
      />
      {model.showsReset ? (
        <Button
          data-testid="action-brief-reset"
          onClick={onReset}
          type="button"
          variant="outline"
        >
          Reset preview
        </Button>
      ) : null}
    </div>
  );
}

const meta = {
  title: "Action/Evidence brief",
  component: ActionEvidenceBriefStory,
  args: {
    exportMode: "succeed",
    preset: "ready",
  },
  argTypes: {
    exportMode: {
      control: "select",
      description:
        "Storybook PDF substitute. Succeed and fail settle without a file. Pending stays on Generating PDF until reset.",
      options: [...syntheticPdfExportModes],
    },
    preset: { control: "select", options: [...actionBriefPresetIds] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Purpose: Action evidence brief for the governed county evidence already read. Source: src/features/ux-reset/action/evidence-brief-panel.tsx. Limitations: fixtures are synthetic Adams County, Colorado (08001) on release alpha-2026, not a live county result. The local note is not governed evidence, is not included in the county PDF, and is not saved. Validation stops at 1,000 characters. Export PDF uses a Storybook substitute that never downloads a file. Reset preview restores the preset note and clears a pending or failed export in this frame only. Changing the preset or export mode remounts the preview. Autodocs opens each story in its own frame so the local-context field id stays unique.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof ActionEvidenceBriefStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const GovernedLimitation: Story = {
  args: { preset: "governed-limitation" },
};
export const BlockedCatalog: Story = { args: { preset: "blocked-catalog" } };
export const BlockedFailed: Story = { args: { preset: "blocked-failed" } };
export const BlockedAbsent: Story = { args: { preset: "blocked-absent" } };
export const BlockedNotLoaded: Story = {
  args: { preset: "blocked-not-loaded" },
};
export const Recovery: Story = { args: { preset: "recovery" } };
export const OverLimit: Story = { args: { preset: "over-limit" } };
export const ExportPending: Story = { args: { exportMode: "pending" } };
export const ExportFailed: Story = { args: { exportMode: "fail" } };
