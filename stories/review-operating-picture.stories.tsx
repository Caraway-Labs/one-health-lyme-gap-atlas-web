import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import type { StateReview } from "@/generated/models";

import {
  buildStateReview,
  reviewCandidate,
} from "../tests/fixtures/review-operating-picture-fixtures";
import {
  setStoryGeometryMode,
  storyGeometryModes,
  type StoryGeometryMode,
} from "./support/county-geography-substitute";

import "@/features/ux-reset/ux-reset.css";

const picturePresets = [
  "candidates",
  "candidates-gaps",
  "none",
  "inconsistent",
  "map-unavailable",
  "selected",
] as const;

type PicturePreset = (typeof picturePresets)[number];

const adamsCandidate = reviewCandidate({
  caveat:
    "Synthetic limitation. Not a diagnosis or an individual risk estimate.",
  countyName: "Adams County",
  fips: "08001",
  reasonText:
    "Adams County is included because the synthetic review method returned it.",
});

const adamsGap = {
  code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
  county_fips: "08031",
  detail:
    "Environmental context without an observed candidate stays a data gap.",
};

function reviewFor(preset: PicturePreset): StateReview {
  switch (preset) {
    case "candidates":
    case "map-unavailable":
    case "selected": {
      return buildStateReview({
        candidates: [adamsCandidate],
        state: "CO",
      });
    }
    case "candidates-gaps": {
      return buildStateReview({
        candidates: [adamsCandidate],
        gaps: [adamsGap],
        state: "CO",
      });
    }
    case "none": {
      return buildStateReview({
        resultState: "none_stand_out",
        state: "CO",
      });
    }
    case "inconsistent": {
      return buildStateReview({
        candidates: [],
        resultState: "candidates_found",
        state: "CO",
      });
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function geometryFor(preset: PicturePreset): StoryGeometryMode {
  switch (preset) {
    case "map-unavailable":
    case "none":
    case "inconsistent":
    case "candidates":
    case "candidates-gaps":
    case "selected": {
      return "ready";
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

function OperatingPictureStory({
  geometry,
  preset,
}: {
  geometry: StoryGeometryMode;
  preset: PicturePreset;
}) {
  const resolvedGeometry =
    geometry === "ready" ? geometryFor(preset) : geometry;
  return (
    <OperatingPicturePreview
      geometry={preset === "map-unavailable" ? "ready" : resolvedGeometry}
      key={`${preset}:${geometry}`}
      preset={preset}
    />
  );
}

function OperatingPicturePreview({
  geometry,
  preset,
}: {
  geometry: StoryGeometryMode;
  preset: PicturePreset;
}) {
  setStoryGeometryMode(geometry);
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
  );
  const [county, setCounty] = useState<string | null>(
    preset === "selected" ? "08001" : null
  );
  const review = reviewFor(preset);
  const model =
    preset === "map-unavailable"
      ? { ...review, data_release_version: " " }
      : review;
  return (
    <QueryClientProvider client={client}>
      <div className="grid gap-3">
        <p className="type-small">
          Synthetic Colorado review. Adams County is FIPS 08001. The map is a
          stub and does not request county geometry from the API. Suggestions
          are the review list, not a risk score.
        </p>
        <p data-testid="operating-selected">{`Selected county ${county ?? "none"}`}</p>
        <Suspense fallback={<p>Loading review preview…</p>}>
          <ReviewOperatingPicture
            county={county}
            onCountyChange={(fips) => {
              setCounty(fips);
            }}
            review={model}
            scopeCode="CO"
            stateName="Colorado"
          />
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  title: "Review/Operating picture",
  component: OperatingPictureStory,
  args: { geometry: "ready", preset: "candidates" },
  argTypes: {
    geometry: { control: "select", options: [...storyGeometryModes] },
    preset: { control: "select", options: [...picturePresets] },
  },
  parameters: {
    atlasLayout: "full",
    docs: {
      description: {
        component:
          "Purpose: state review result, candidate list, gaps, and map fallback. Source: src/features/ux-reset/review/review-operating-picture.tsx. Limitations: the result is a synthetic Colorado review for Adams County (08001) on release alpha-2026. An inconsistent payload withholds the candidate list. A release token that is not a dataset id shows the non-map fallback without a geometry request. County geometry and AtlasMap are Storybook stubs. Real MapLibre navigation stays in application tests.",
      },
      story: { inline: false },
    },
  },
} satisfies Meta<typeof OperatingPictureStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Candidates: Story = {};
export const CandidatesAndGaps: Story = { args: { preset: "candidates-gaps" } };
export const None: Story = { args: { preset: "none" } };
export const Inconsistent: Story = { args: { preset: "inconsistent" } };
export const MapUnavailable: Story = { args: { preset: "map-unavailable" } };
export const SelectedCounty: Story = { args: { preset: "selected" } };
export const MapError: Story = { args: { geometry: "error" } };
export const MapEmpty: Story = { args: { geometry: "empty" } };
export const MapLoading: Story = { args: { geometry: "pending" } };
