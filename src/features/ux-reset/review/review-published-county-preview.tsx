"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Ref } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import { RankingInfluencePanel } from "@/features/ux-reset/review/ranking-influence-panel";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import {
  EXPLORER_MAP_FOLLOW_UP_ID,
  scrollToSuggestedFollowUp,
} from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import { CountySummarySurveillance } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";
import { cn } from "@/lib/utils";

export { reviewHumanFloorEvidence } from "@/features/ux-reset/review/review-human-floor-evidence";

const UNKNOWN_PREVIEW_RELEASE: Tier1ActiveRelease = { status: "unknown" };

export function ReviewPublishedCountyPreview({
  county,
  compareHref,
  onOpen,
  openRef,
  release = UNKNOWN_PREVIEW_RELEASE,
  releaseId,
}: {
  county: ExploreCountyIdentity;
  compareHref: string;
  onOpen: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  release?: Tier1ActiveRelease;
  releaseId: string;
  reviewResultState?: GovernedReviewResultState | null;
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
      className="ux-reset-review-preview gap-0 p-4"
      role="region"
      data-testid="review-published-county-preview"
      data-fips={county.fips}
    >
      <header className="ux-reset-selected-county-header">
        <div className="ux-reset-selected-county-identity">
          <p className="eyebrow">Selected county</p>
          <h2 className="type-card">
            {county.county}, {county.stateName}
          </h2>
          <p className="type-small" data-testid="review-preview-fips">
            FIPS {county.fips}
          </p>
        </div>
      </header>
      <CountySummarySurveillance fips={county.fips} release={release} />
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
      {detail ? <ReviewRationalePanel detail={detail} /> : null}
      {detail ? <RankingInfluencePanel detail={detail} /> : null}
      {detail ? (
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
      ) : null}
      <div className="ux-reset-review-preview-actions">
        <Button
          {...analyticsControlAttributes("explorer_view_follow_up")}
          aria-controls={EXPLORER_MAP_FOLLOW_UP_ID}
          data-county={county.fips}
          data-testid="review-view-county-follow-up"
          type="button"
          onClick={() => {
            scrollToSuggestedFollowUp(
              document.querySelector(`#${EXPLORER_MAP_FOLLOW_UP_ID}`)
            );
          }}
        >
          View County Follow-Up
        </Button>
        <Link
          {...analyticsControlAttributes("explorer_compare")}
          ref={openRef}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "ux-reset-review-open"
          )}
          data-testid="review-compare"
          data-variant="outline"
          href={compareHref}
          onClick={() => onOpen(county.fips)}
        >
          Compare This County
        </Link>
        <DownloadCountyPdfButton
          countyName={county.county}
          fips={county.fips}
          releaseId={releaseId}
          stateCode={county.state}
        />
      </div>
    </Card>
  );
}
