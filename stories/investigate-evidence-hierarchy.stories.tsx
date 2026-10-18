import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { Tier1SurveillancePriorityPanel } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";

import {
  hierarchyPreset,
  hierarchyPresetIds,
  type HierarchyPresetId,
} from "./fixtures/investigate-hierarchy-presets";
import { tier1StoryView } from "./fixtures/tier1-views";

import "@/features/ux-reset/ux-reset.css";

type HierarchyStoryProps = {
  preset: HierarchyPresetId;
};

function HierarchyStory({ preset }: HierarchyStoryProps) {
  return <HierarchyPreview key={preset} preset={preset} />;
}

function HierarchyPreview({ preset }: HierarchyStoryProps) {
  const [retries, setRetries] = useState(0);
  const model = hierarchyPreset(preset);
  return (
    <div className="ux-reset-investigate">
      <InvestigateEvidenceHierarchy
        bundle={model.bundle}
        catalogFailed={model.catalogFailed}
        countyRecord={model.countyRecord}
        countyRecordError={model.countyRecordError}
        countyRecordLoading={model.countyRecordLoading}
        countyRecordRefreshError={model.countyRecordRefreshError}
        measures={model.measures}
        modelAssisted={
          model.showModel ? (
            <Tier1SurveillancePriorityPanel
              headingLevel="h3"
              view={tier1StoryView("high-sufficient")}
            />
          ) : null
        }
        retrying={model.retrying}
        onRetryFailures={
          model.showRetry
            ? () => {
                setRetries((count) => count + 1);
              }
            : undefined
        }
      />
      <p data-testid="hierarchy-retry-count">
        Retry requests from this preview: {retries}
      </p>
    </div>
  );
}

const meta = {
  title: "County Investigation/Investigate evidence hierarchy",
  component: HierarchyStory,
  args: { preset: "representative" },
  argTypes: {
    preset: { control: "select", options: [...hierarchyPresetIds] },
  },
  parameters: {
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Purpose: county evidence hierarchy for Investigate. Source: src/features/ux-reset/investigate/investigate-hierarchy.tsx. Limitations: fixtures are synthetic Adams County, Colorado (08001) records. Same-period disagreements stay separate and are not combined. A request failure is not a statement that no evidence was returned. Loaded observations stay visible when a later refresh fails. The optional model block is the presentation panel, not a live request. Retry updates the count in this preview only. Changing the preset remounts the story, so use one story at a time in the canvas. Autodocs opens each story in its own frame so anchors stay unique.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof HierarchyStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Representative: Story = {};
export const ZeroSuppression: Story = { args: { preset: "zero-suppression" } };
export const CoverageLimitation: Story = {
  args: { preset: "coverage-limitation" },
};
export const SamePeriodConflict: Story = {
  args: { preset: "same-period-conflict" },
};
export const PartialFailure: Story = { args: { preset: "partial-failure" } };
export const PartialFailureRetrying: Story = {
  args: { preset: "partial-failure-retrying" },
};
export const CountyPending: Story = { args: { preset: "county-pending" } };
export const CountyError: Story = { args: { preset: "county-error" } };
export const CatalogFailure: Story = { args: { preset: "catalog-failure" } };
export const RefreshFailure: Story = { args: { preset: "refresh-failure" } };
export const WithModel: Story = { args: { preset: "with-model" } };
