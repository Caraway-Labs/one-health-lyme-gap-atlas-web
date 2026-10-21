"use client";

import { useQuery } from "@tanstack/react-query";
import type { Ref } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Card } from "@/components/ui/card";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import {
  CountyCompleteness,
  CountyEvidenceDisclosure,
  CountyFingerprint,
  CountyScoreRamp,
  CountySummaryActions,
  CountySummaryHeader,
} from "@/features/ux-reset/review/county-summary-card-parts";
import type { AdjustedCountyScenario } from "@/features/ux-reset/review/explorer-scenario-score";
import { RankingInfluencePanel } from "@/features/ux-reset/review/ranking-influence-panel";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import { CountySummarySurveillance } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";

export { reviewHumanFloorEvidence } from "@/features/ux-reset/review/review-human-floor-evidence";

const UNKNOWN_PREVIEW_RELEASE: Tier1ActiveRelease = { status: "unknown" };

export function ReviewPublishedCountyPreview({
  county,
  compareHref,
  onOpen,
  onViewCountyEvidence,
  openRef,
  release = UNKNOWN_PREVIEW_RELEASE,
  releaseId,
  scenario = null,
}: {
  county: ExploreCountyIdentity;
  compareHref: string;
  onOpen: (fips: string) => void;
  onViewCountyEvidence?: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  release?: Tier1ActiveRelease;
  releaseId: string;
  reviewResultState?: GovernedReviewResultState | null;
  /** Browser what-if for this county. Published values stay the default. */
  scenario?: AdjustedCountyScenario | null;
}) {
  const query = useQuery({
    queryKey: ["ux-reset-review-published-county", releaseId, county.fips],
    queryFn: ({ signal }) =>
      loadInvestigateCountyRecord({ fips: county.fips, releaseId, signal }),
  });
  // Never present cached facts after a failed refresh as current evidence.
  const detail = query.isError ? null : query.data;
  return (
    <Card
      aria-label={`Published county preview for ${county.county}, ${county.stateName}`}
      className="ux-reset-review-preview county-summary-card gap-0 p-4"
      role="region"
      data-testid="review-published-county-preview"
      data-fips={county.fips}
    >
      <CountySummaryHeader
        county={county.county}
        fips={county.fips}
        stateCode={county.state}
        stateName={county.stateName}
      />
      {detail ? (
        <>
          <CountyScoreRamp scenario={scenario} score={detail.score.score} />
          <CountyCompleteness value={detail.evidence_completeness} />
          <CountyFingerprint detail={detail} />
        </>
      ) : null}
      <CountySummarySurveillance fips={county.fips} release={release} />
      <CountySummaryActions
        compareHref={compareHref}
        countyName={county.county}
        fips={county.fips}
        openRef={openRef}
        releaseId={releaseId}
        stateCode={county.state}
        onOpen={onOpen}
        onViewCountyEvidence={onViewCountyEvidence}
      />
      {query.isPending ? (
        <AtlasStatusMessage tone="loading">
          Loading published county evidence…
        </AtlasStatusMessage>
      ) : null}
      {query.isError ? (
        <AtlasStatusMessage tone="error">
          Published county evidence could not be loaded. Reload to retry; this
          is a request failure, not evidence absence.
        </AtlasStatusMessage>
      ) : null}
      {detail === null && !query.isPending && !query.isError ? (
        <AtlasStatusMessage tone="empty">
          No published county record was returned for this release.
        </AtlasStatusMessage>
      ) : null}
      {detail ? (
        <CountyEvidenceDisclosure>
          <ReviewRationalePanel detail={detail} />
          <RankingInfluencePanel detail={detail} />
          <details
            className="ux-reset-explorer-score"
            data-testid="review-sources-methods"
          >
            <summary>Sources & methods</summary>
            <p className="type-small">
              Release {detail.release.release_id}. Methodology{" "}
              {detail.release.methodology_version}.
            </p>
            <p className="type-small">
              Release loaded {detail.release.loaded_at}.
            </p>
            {detail.release.sources.length > 0 ? (
              <ul>
                {detail.release.sources.map((source) => (
                  <li key={source.key}>
                    <p>
                      {source.label}{" "}
                      <span className="type-small">
                        Source id {source.key}
                        {source.vintage ? ` · ${source.vintage}` : ""}
                      </span>
                    </p>
                    {source.note ? (
                      <p className="type-small">{source.note}</p>
                    ) : null}
                    {source.url.trim() ? (
                      <p className="type-small">
                        <a
                          data-source-key={source.key}
                          data-testid="review-source-url"
                          href={source.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open source reference ↗
                        </a>
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-small">
                No source list was returned with this release.
              </p>
            )}
          </details>
        </CountyEvidenceDisclosure>
      ) : null}
    </Card>
  );
}
