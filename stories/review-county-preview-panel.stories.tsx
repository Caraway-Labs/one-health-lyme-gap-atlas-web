import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";

import {
  reviewPreviewPreset,
  reviewPreviewPresetIds,
  type ReviewPreviewPresetId,
} from "./fixtures/review-preview-presets";
import { CanonicalGeographyAvailabilityStoryProvider } from "./support/canonical-geography-availability-notice-substitute";
import { reviewPreviewQueryClient } from "./support/review-preview-query-client";
import { Tier1StoryQueryProvider } from "./support/tier1-hook-substitute";

import "@/features/ux-reset/ux-reset.css";

type PreviewStoryProps = {
  preset: ReviewPreviewPresetId;
};

function PreviewStory({ preset }: PreviewStoryProps) {
  return <PreviewFrame key={preset} preset={preset} />;
}

function PreviewFrame({ preset }: PreviewStoryProps) {
  const [client] = useState(reviewPreviewQueryClient);
  const [opened, setOpened] = useState<{ count: number; fips: string } | null>(
    null
  );
  const model = reviewPreviewPreset(preset);
  const action = opened
    ? `Opened county ${opened.fips} (${String(opened.count)})`
    : "None";
  return (
    <QueryClientProvider client={client}>
      <CanonicalGeographyAvailabilityStoryProvider value={model.availability}>
        <Tier1StoryQueryProvider value={model.query}>
          <div className="ux-reset-pro-main">
            <p data-testid="preview-action">Last preview action: {action}</p>
            <ReviewCountyPreviewPanel
              compareHref={model.compareHref}
              droppedNotes={model.droppedNotes}
              href={model.href}
              preview={model.preview}
              release={model.release}
              releaseId={
                model.release.status === "ready" ? model.release.releaseId : ""
              }
              onOpen={(fips) => {
                setOpened((current) => ({
                  count: (current?.count ?? 0) + 1,
                  fips,
                }));
              }}
            />
          </div>
        </Tier1StoryQueryProvider>
      </CanonicalGeographyAvailabilityStoryProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: "Review/County preview panel",
  component: PreviewStory,
  args: { preset: "rationale" },
  argTypes: {
    preset: { control: "select", options: [...reviewPreviewPresetIds] },
  },
  parameters: {
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Purpose: selected-county preview on Review. Source: src/features/ux-reset/review/review-county-preview-panel.tsx. Limitations: Adams County, Colorado (08001) fixtures are synthetic and use release alpha-2026, including handoff dataset parameters. Qualification comes from the score or candidate builder. The long-reference example adds a synthetic source link so a provenance click can be distinguished from a county open. ML review priority uses a deterministic substitute. The published gap score is the synthetic score 70.0 for this county, and both situation classes stay unpublished. None of those results request the API. This preview does not render the canonical geography availability notice. Review priority is not disease risk. Investigate and Compare call onOpen with the county FIPS, and this preview counts only that callback. A provenance source reference does not. Dropped Review list controls stay listed when the source URL contained them.",
      },
    },
  },
} satisfies Meta<typeof PreviewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rationale: Story = {};
export const LimitedQualification: Story = {
  args: { preset: "limited-qualification" },
};
export const MissingMetadata: Story = { args: { preset: "missing-metadata" } };
export const LongReferences: Story = { args: { preset: "long-references" } };
export const DroppedContext: Story = { args: { preset: "dropped-context" } };
export const GeographyUnpublished: Story = {
  args: { preset: "geography-unpublished" },
};
export const GeographyLoading: Story = {
  args: { preset: "geography-loading" },
};
export const GeographyError: Story = { args: { preset: "geography-error" } };
