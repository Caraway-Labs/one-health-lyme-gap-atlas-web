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
} from "@/generated/models";
import type { Score } from "@/generated/models/score";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
} from "../../tests/fixtures/tier1-surveillance-priority";
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
] as const;

export type ReviewPreviewPresetId = (typeof reviewPreviewPresetIds)[number];

export type ReviewPreviewStoryModel = {
  compareHref: string;
  droppedNotes: readonly string[];
  href: string;
  preview: ReviewCountyPreviewModel;
  query: Tier1StoryQuery;
  release: Tier1ActiveRelease;
};

const alignedRelease: Tier1ActiveRelease = {
  releaseId: tier1HighSufficientFixture.release_id,
  status: "ready",
};

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

export function reviewPreviewPreset(
  preset: ReviewPreviewPresetId
): ReviewPreviewStoryModel {
  switch (preset) {
    case "rationale": {
      return {
        ...keptContext,
        preview: buildReviewCountyPreview(scoreCounty({})),
        query: {
          data: tier1PriorityForCounty(
            tier1HighSufficientFixture,
            syntheticCounty.fips
          ),
          status: "success",
        },
        release: alignedRelease,
      };
    }
    case "limited-qualification": {
      return {
        ...keptContext,
        preview: buildReviewCountyPreview(
          scoreCounty({
            evidence_completeness: 40,
            human_status: ValueState.SUPPRESSED,
          })
        ),
        query: {
          data: tier1PriorityForCounty(
            tier1LowInsufficientFixture,
            syntheticCounty.fips
          ),
          status: "success",
        },
        release: alignedRelease,
      };
    }
    case "missing-metadata": {
      return {
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
        release: alignedRelease,
      };
    }
    case "long-references": {
      return {
        ...keptContext,
        preview: buildReviewCandidatePreview({
          candidate: longReferenceCandidate(),
          methodologyId: "synthetic-method",
          methodologyVersion: "1.0.0",
          stateCode: syntheticCounty.stateCode,
          stateName: syntheticCounty.stateName,
        }),
        query: {
          data: {
            ...tier1HighSufficientFixture,
            county_fips: syntheticCounty.fips,
            evidence_sufficiency: "NOT_ESTIMABLE",
            priority_percentile: null,
            priority_tier: null,
            raw_model_score: null,
            reasons: [],
          },
          status: "success",
        },
        release: alignedRelease,
      };
    }
    case "dropped-context": {
      return {
        ...droppedContext,
        preview: buildReviewCountyPreview(scoreCounty({})),
        query: {
          data: tier1PriorityForCounty(
            tier1HighSufficientFixture,
            syntheticCounty.fips
          ),
          status: "success",
        },
        release: { releaseId: syntheticReleaseId, status: "ready" },
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}
