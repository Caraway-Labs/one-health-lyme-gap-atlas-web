import type { CanonicalGeographyAvailabilityView } from "@/features/ux-reset/geography/canonical-geography-availability";
import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import {
  buildReviewCompareHandoff,
  buildReviewCountyPreview,
  buildReviewInvestigateHandoff,
  type ReviewCountyPreviewModel,
} from "@/features/ux-reset/review/review-county-preview";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import {
  ValueState,
  type Candidate,
  type CountyScoreSummary,
  type Tier1CountyPriority,
} from "@/generated/models";
import type { Score } from "@/generated/models/score";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "../../tests/fixtures/tier1-surveillance-priority";
import {
  storyGeographyError,
  storyGeographyLoading,
  storyGeographyUnpublished,
} from "../support/canonical-geography-availability-notice-substitute";
import type { Tier1StoryQuery } from "../support/tier1-hook-substitute";
import {
  syntheticCounty,
  syntheticPeriod,
  syntheticReleaseId,
} from "./synthetic-county";

export const reviewPreviewPresetIds = [
  "rationale",
  "limited-qualification",
  "missing-metadata",
  "long-references",
  "dropped-context",
  "geography-unpublished",
  "geography-loading",
  "geography-error",
] as const;

export type ReviewPreviewPresetId = (typeof reviewPreviewPresetIds)[number];

export type ReviewPreviewStoryModel = {
  availability: CanonicalGeographyAvailabilityView;
  compareHref: string;
  droppedNotes: readonly string[];
  href: string;
  preview: ReviewCountyPreviewModel;
  query: Tier1StoryQuery;
  release: Tier1ActiveRelease;
};

const storyRelease: Tier1ActiveRelease = {
  releaseId: syntheticReleaseId,
  status: "ready",
};

export const syntheticReviewSourceUrl =
  "https://example.com/synthetic-review-source";

function alignedPriority(result: Tier1CountyPriority): Tier1CountyPriority {
  return tier1PriorityForRelease(
    tier1PriorityForCounty(result, syntheticCounty.fips),
    syntheticReleaseId
  );
}

function withSyntheticSourceLink(
  preview: ReviewCountyPreviewModel
): ReviewCountyPreviewModel {
  const qualification = preview.qualification;
  if (!qualification) {
    return preview;
  }
  return {
    ...preview,
    qualification: {
      ...qualification,
      provenance: {
        ...qualification.provenance,
        sourceUrl: syntheticReviewSourceUrl,
      },
    },
  };
}

const reviewScore = {
  access_signal: 50,
  community: 50,
  ecological: 50,
  human_weakness: 50,
  pathogen_signal: 50,
  rural_signal: 50,
  score: 70,
  svi_signal: 50,
  tick_signal: 50,
} as const satisfies Score;

function scoreCounty(partial: Partial<CountyScoreSummary>): CountyScoreSummary {
  return {
    burgdorferi_status: "observed",
    color: "#55a8a3",
    county: syntheticCounty.name,
    evidence_completeness: 100,
    fips: syntheticCounty.fips,
    human_status: "observed",
    in_contiguous_tick_scope: true,
    priority: "Priority 1 — Highest",
    score: reviewScore,
    state: syntheticCounty.stateCode,
    state_name: syntheticCounty.stateName,
    tick_status: "observed",
    ...partial,
  };
}

function handoff(search: string): {
  compareHref: string;
  droppedNotes: readonly string[];
  href: string;
} {
  const searchParams = new URLSearchParams(search);
  const investigate = buildReviewInvestigateHandoff({
    period: syntheticPeriod,
    releaseId: syntheticReleaseId,
    scopeCode: syntheticCounty.stateCode,
    searchParams,
    selectedFips: syntheticCounty.fips,
  });
  return {
    compareHref: buildReviewCompareHandoff({
      period: syntheticPeriod,
      releaseId: syntheticReleaseId,
      scopeCode: syntheticCounty.stateCode,
      searchParams,
      selectedFips: syntheticCounty.fips,
    }),
    droppedNotes: investigate.droppedNotes,
    href: investigate.href,
  };
}

const keptContext = handoff(`scope=${syntheticCounty.stateCode}`);
const droppedContext = handoff(
  `scope=${syntheticCounty.stateCode}&page=2&sort=score`
);

function longReferenceCandidate(): Candidate {
  const reference = {
    county_fips: syntheticCounty.fips,
    family: "human",
    limitations: [
      "Synthetic reference limitation. A missing county record is not zero cases.",
    ],
    public_record_ref: "synthetic-record-08001",
    release_id: syntheticReleaseId,
    retrieved_at: "2026-01-15T00:00:00Z",
    source_as_of: "2026-01-15",
    source_product: "Synthetic surveillance extract",
    source_version: "1.0.0",
    status: "Reported",
    target: "Reported Lyme cases",
  };
  return {
    completeness: "limited",
    county_fips: syntheticCounty.fips,
    county_name: syntheticCounty.name,
    county_url: "/app/investigate?county=08001",
    evidence_families: ["human", "pathogen"],
    evidence_references: [
      reference,
      {
        ...reference,
        family: "pathogen",
        limitations: [
          "Synthetic pathogen reference. No record does not establish that the pathogen is absent.",
        ],
        public_record_ref: "synthetic-pathogen-08001",
        source_product: "Synthetic pathogen extract",
        target: "Pathogen detections",
      },
    ],
    freshness_comparability:
      "This synthetic candidate does not assess freshness.",
    limitations: [
      "Synthetic candidate limitation for layout review. This is not a live county ranking.",
    ],
    reason_codes: ["SYNTHETIC_SIGNAL"],
    reason_text:
      "Synthetic review candidate for Adams County. Review priority is not disease risk.",
    suggested_next_check:
      "Read the governed limitations before treating this county as a priority.",
  };
}

function withUnpublishedGeography(
  model: Omit<ReviewPreviewStoryModel, "availability">
): ReviewPreviewStoryModel {
  return { ...model, availability: storyGeographyUnpublished };
}

export function reviewPreviewPreset(
  preset: ReviewPreviewPresetId
): ReviewPreviewStoryModel {
  switch (preset) {
    case "rationale":
    case "geography-unpublished": {
      return withUnpublishedGeography({
        ...keptContext,
        preview: buildReviewCountyPreview(scoreCounty({})),
        query: {
          data: alignedPriority(tier1HighSufficientFixture),
          status: "success",
        },
        release: storyRelease,
      });
    }
    case "geography-loading": {
      return {
        ...withUnpublishedGeography({
          ...keptContext,
          preview: buildReviewCountyPreview(scoreCounty({})),
          query: {
            data: alignedPriority(tier1HighSufficientFixture),
            status: "success",
          },
          release: storyRelease,
        }),
        availability: storyGeographyLoading,
      };
    }
    case "geography-error": {
      return {
        ...withUnpublishedGeography({
          ...keptContext,
          preview: buildReviewCountyPreview(scoreCounty({})),
          query: {
            data: alignedPriority(tier1HighSufficientFixture),
            status: "success",
          },
          release: storyRelease,
        }),
        availability: storyGeographyError,
      };
    }
    case "limited-qualification": {
      return withUnpublishedGeography({
        ...keptContext,
        preview: buildReviewCountyPreview(
          scoreCounty({
            evidence_completeness: 40,
            human_status: ValueState.SUPPRESSED,
          })
        ),
        query: {
          data: alignedPriority(tier1LowInsufficientFixture),
          status: "success",
        },
        release: storyRelease,
      });
    }
    case "missing-metadata": {
      return withUnpublishedGeography({
        ...keptContext,
        preview: buildReviewCountyPreview(
          scoreCounty({
            burgdorferi_status: "missing",
            evidence_completeness: 0,
            human_status: "missing",
            tick_status: "missing",
          })
        ),
        query: { errorStatus: 404, status: "error" },
        release: storyRelease,
      });
    }
    case "long-references": {
      return withUnpublishedGeography({
        ...keptContext,
        preview: withSyntheticSourceLink(
          buildReviewCandidatePreview({
            candidate: longReferenceCandidate(),
            methodologyId: "synthetic-method",
            methodologyVersion: "1.0.0",
            stateCode: syntheticCounty.stateCode,
            stateName: syntheticCounty.stateName,
          })
        ),
        query: {
          data: alignedPriority({
            ...tier1HighSufficientFixture,
            evidence_sufficiency: "NOT_ESTIMABLE",
            priority_percentile: null,
            priority_tier: null,
            raw_model_score: null,
            reasons: [],
          }),
          status: "success",
        },
        release: storyRelease,
      });
    }
    case "dropped-context": {
      return withUnpublishedGeography({
        ...droppedContext,
        preview: buildReviewCountyPreview(scoreCounty({})),
        query: {
          data: alignedPriority(tier1HighSufficientFixture),
          status: "success",
        },
        release: storyRelease,
      });
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
