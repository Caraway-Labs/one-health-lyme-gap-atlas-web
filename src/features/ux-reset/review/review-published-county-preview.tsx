"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Ref } from "react";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { ResponseTierPill } from "@/components/response-tier-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import {
  formatGapScore,
  publishedGapScore,
} from "@/features/ux-reset/review/explorer-ranked-counties";
import { RankingInfluencePanel } from "@/features/ux-reset/review/ranking-influence-panel";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import {
  EXPLORER_MAP_FOLLOW_UP_ID,
  scrollToSuggestedFollowUp,
} from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import type { CountyDetail } from "@/generated/models";
import { recognizedPlainPriority } from "@/lib/atlas-ui";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";
import { cn } from "@/lib/utils";

export { reviewHumanFloorEvidence } from "@/features/ux-reset/review/review-human-floor-evidence";

type PublishedReviewPriority =
  | { kind: "neutral"; value: string }
  | { kind: "recognized"; value: string }
  | { kind: "unavailable" };

function publishedReviewPriority(priority: string): PublishedReviewPriority {
  const trimmed = priority.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "unavailable") {
    return { kind: "unavailable" };
  }
  if (recognizedPlainPriority(trimmed)) {
    return { kind: "recognized", value: trimmed };
  }
  return { kind: "neutral", value: trimmed };
}

function PublishedReviewPriorityReadout({
  priority,
}: {
  priority: PublishedReviewPriority;
}) {
  switch (priority.kind) {
    case "recognized": {
      return <AtlasPriorityBadge priority={priority.value} />;
    }
    case "neutral": {
      return (
        <>
          <p className="type-body" data-testid="review-preview-priority-text">
            {priority.value}
          </p>
          <p className="type-small">
            This published priority is not a recognized review category.
          </p>
        </>
      );
    }
    case "unavailable": {
      return (
        <p className="type-body">
          Review priority is unavailable for this county.
        </p>
      );
    }
    default: {
      const exhaustive: never = priority;
      return exhaustive;
    }
  }
}

function publishedPreviewScore(detail: CountyDetail): number | null {
  if (!detail.in_contiguous_tick_scope) {
    return null;
  }
  return publishedGapScore(detail.score.score);
}

function SelectedCountyScoreLockup({
  detail,
  reviewResultState,
}: {
  detail: CountyDetail;
  reviewResultState: GovernedReviewResultState | null;
}) {
  const score = publishedPreviewScore(detail);
  return (
    <div
      className="ux-reset-selected-county-score"
      data-testid="selected-county-score-lockup"
    >
      <ResponseTierPill
        context={reviewResultState ? { reviewResultState } : undefined}
        detail={detail}
      />
      {score === null ? (
        <p
          className="ux-reset-selected-county-gap-score"
          data-testid="selected-county-gap-score"
        >
          Atlas gap score unavailable
        </p>
      ) : (
        <p
          className="ux-reset-selected-county-gap-score"
          data-testid="selected-county-gap-score"
        >
          <span className="sr-only">Atlas gap score </span>
          <strong>{formatGapScore(score)}</strong>
          <span>/100</span>
        </p>
      )}
    </div>
  );
}

export function ReviewPublishedCountyPreview({
  county,
  compareHref,
  onOpen,
  openRef,
  releaseId,
  reviewResultState = null,
}: {
  county: ExploreCountyIdentity;
  compareHref: string;
  onOpen: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
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
      {detail ? (
        <SelectedCountyScoreLockup
          detail={detail}
          reviewResultState={reviewResultState}
        />
      ) : null}
      <p className="eyebrow">Selected county</p>
      <h2 className="type-card">
        {county.county}, {county.stateName}
      </h2>
      <p className="type-small" data-testid="review-preview-fips">
        FIPS {county.fips}
      </p>
      {detail ? (
        <div data-testid="review-preview-priority">
          <PublishedReviewPriorityReadout
            priority={publishedReviewPriority(detail.priority)}
          />
        </div>
      ) : null}
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
