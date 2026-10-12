import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useMemo, useState } from "react";

import { ReviewNationalOrientationView } from "@/features/ux-reset/review/review-national-orientation";
import {
  filterReviewStateNavigationEntries,
  reviewNavigationMapPhaseValues,
  reviewStateContractSummary,
  reviewStateNavigationEntries,
  type ReviewNavigationMapPhase,
  type ReviewStateFeatureCollection,
} from "@/features/ux-reset/review/review-state-navigation";

import { storyReleaseStates } from "./fixtures/story-states";

import "@/features/ux-reset/ux-reset.css";

const phases = [
  reviewNavigationMapPhaseValues.ready,
  reviewNavigationMapPhaseValues.boundaryLoading,
  reviewNavigationMapPhaseValues.boundaryFailed,
  reviewNavigationMapPhaseValues.boundaryEmpty,
  reviewNavigationMapPhaseValues.mapLoading,
  reviewNavigationMapPhaseValues.mapLoadFailed,
  reviewNavigationMapPhaseValues.webglUnavailable,
] as const;

const EMPTY_FEATURES: ReviewStateFeatureCollection = {
  features: [],
  type: "FeatureCollection",
};

const STUB_FEATURES: ReviewStateFeatureCollection = {
  features: [
    {
      geometry: {
        coordinates: [
          [
            [
              [-109.1, 41],
              [-102, 41],
              [-102, 37],
              [-109.1, 37],
              [-109.1, 41],
            ],
          ],
        ],
        type: "MultiPolygon",
      },
      properties: {
        availability: "supported",
        code: "CO",
        name: "Colorado",
      },
      type: "Feature",
    },
  ],
  type: "FeatureCollection",
};

function showsMap(phase: ReviewNavigationMapPhase): boolean {
  return (
    phase === reviewNavigationMapPhaseValues.ready ||
    phase === reviewNavigationMapPhaseValues.mapLoading
  );
}

export function StateOrientationStory({
  phase,
}: {
  phase: ReviewNavigationMapPhase;
}) {
  const catalog = useMemo(
    () => reviewStateNavigationEntries(storyReleaseStates),
    []
  );
  const [query, setQuery] = useState("");
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const entries = filterReviewStateNavigationEntries(catalog, query);
  const features = showsMap(phase) ? STUB_FEATURES : EMPTY_FEATURES;
  return (
    <div className="grid gap-3" key={phase}>
      <p className="type-small">
        Synthetic state orientation from the #562 MapLibre navigation. The map
        frame is a stub. The list is the non-map fallback and only offers states
        in this release. Alaska and Hawaii are not listed.
      </p>
      <p data-testid="orientation-opened">{`Opened state ${opened ?? "none"}`}</p>
      <p data-testid="orientation-retries">{`Map retries ${retries}`}</p>
      <ReviewNationalOrientationView
        catalog={catalog}
        contractSummary={reviewStateContractSummary(catalog)}
        entries={entries}
        features={features}
        focusCode={focusCode}
        hoverCode={hoverCode}
        mapAttempt={retries}
        mapCodes={showsMap(phase) ? ["CO"] : []}
        onActivate={(code) => {
          setSelectedCode(code);
          setOpened(code);
        }}
        onFocusCode={setFocusCode}
        onHoverCode={setHoverCode}
        onLoadFailed={() => {}}
        onQueryChange={setQuery}
        onReady={() => {}}
        onRetry={() => {
          setRetries((count) => count + 1);
        }}
        onWebglUnavailable={() => {}}
        phase={phase}
        query={query}
        selectedCode={selectedCode}
        totalCount={catalog.length}
      />
    </div>
  );
}

const meta = {
  title: "Review/State orientation",
  component: StateOrientationStory,
  args: { phase: reviewNavigationMapPhaseValues.ready },
  argTypes: {
    phase: { control: "select", options: [...phases] },
  },
  parameters: {
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Purpose: national Review state navigation landed in #562 at src/features/ux-reset/review/review-national-orientation.tsx. Stories drive ReviewNationalOrientationView, the presentation behind ReviewNationalOrientation, so county geometry is not requested. The MapLibre map is a Storybook stub. Pending, failed, empty, and WebGL phases keep the state list as the non-map fallback. Activating Colorado updates the opened-state line. Geographic entries are the lower 48 and DC; only Colorado, New York, North Carolina, and DC are supported in this release.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof StateOrientationStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const BoundaryLoading: Story = {
  args: { phase: reviewNavigationMapPhaseValues.boundaryLoading },
};
export const BoundaryFailed: Story = {
  args: { phase: reviewNavigationMapPhaseValues.boundaryFailed },
};
export const BoundaryEmpty: Story = {
  args: { phase: reviewNavigationMapPhaseValues.boundaryEmpty },
};
export const MapLoading: Story = {
  args: { phase: reviewNavigationMapPhaseValues.mapLoading },
};
export const MapLoadFailed: Story = {
  args: { phase: reviewNavigationMapPhaseValues.mapLoadFailed },
};
export const WebglUnavailable: Story = {
  args: { phase: reviewNavigationMapPhaseValues.webglUnavailable },
};
