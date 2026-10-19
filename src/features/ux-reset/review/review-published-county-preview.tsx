"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Ref } from "react";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { mapPublishedRow } from "@/features/ux-reset/investigate/published-county-hierarchy";
import { REVIEW_RATIONALE_SCORE_NOTE } from "@/features/ux-reset/review/review-rationale";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import {
  EXPLORER_MAP_FOLLOW_UP_ID,
  scrollToSuggestedFollowUp,
} from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import type { CountyDetail } from "@/generated/models";
import { cn } from "@/lib/utils";

export function reviewHumanFloorEvidence(
  detail: CountyDetail
): EvidenceObjectModel {
  const source = detail.release.sources.find((entry) => entry.key === "human");
  const floor = detail.case_count_floor_2023;
  const hasFloor =
    detail.human_status === "published_count_floor" &&
    floor !== null &&
    Number.isFinite(floor) &&
    floor >= 0;
  const humanStatus = detail.human_status.trim().toLowerCase();
  const missingStatus = [
    "suppressed",
    "missing",
    "no_county_linked_record",
    "unavailable",
  ].includes(humanStatus)
    ? humanStatus
    : "Unavailable";
  const state = mapPublishedRow({
    claimLabel: "Published 2023 human case-count floor",
    inspectAnchor: "review-human-floor",
    sourceNote: source?.note,
    subject: hasFloor
      ? { kind: "numeric", value: floor }
      : {
          kind: "status",
          status: missingStatus,
        },
  });
  return {
    claimLabel: "Published 2023 human case-count floor",
    availability: state.availability,
    reasonCode: state.reasonCode,
    displayValue: hasFloor
      ? `${floor.toLocaleString("en-US")} (published count floor)`
      : formatGovernedEvidenceValue({
          value: null,
          valueState: state.valueState,
        }),
    valueNote: hasFloor
      ? "A floor, not an exact case total."
      : `Published status: ${detail.human_status.replaceAll("_", " ")}. Missing, suppressed, or unallocated records are not converted to zero.`,
    provenance: {
      sourceFamily: source?.label || "Unavailable",
      sourceUrl: source?.url || null,
      datasetVintage: source?.vintage || null,
      observationPeriod: "2023",
      evidenceType: "Unavailable",
      materialCaveat: state.limitations[0] ?? null,
      limitations: [...state.limitations],
      inspectSummary: source?.note || "Source context was not returned.",
      methodVersion: detail.release.methodology_version,
      technical: {
        releaseId: detail.release.release_id,
        sourceId: source?.key,
      },
    },
  };
}

function publishedReviewPriority(priority: string): string | null {
  const trimmed = priority.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "unavailable") {
    return null;
  }
  return trimmed;
}

export function ReviewPublishedCountyPreview({
  county,
  compareHref,
  onOpen,
  openRef,
  releaseId,
}: {
  county: ExploreCountyIdentity;
  compareHref: string;
  onOpen: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  releaseId: string;
}) {
  const query = useQuery({
    queryKey: ["ux-reset-review-published-county", releaseId, county.fips],
    queryFn: ({ signal }) =>
      loadInvestigateCountyRecord({ fips: county.fips, releaseId, signal }),
  });
  // Never present cached facts after a failed refresh as current evidence.
  const detail = query.isError ? null : query.data;
  const priority = detail ? publishedReviewPriority(detail.priority) : null;
  return (
    <Card
      aria-label={`Published county preview for ${county.county}, ${county.stateName}`}
      className="ux-reset-review-preview gap-0 p-4"
      role="region"
      data-testid="review-published-county-preview"
      data-fips={county.fips}
    >
      <p className="eyebrow">Selected county</p>
      <h2 className="type-card">
        {county.county}, {county.stateName}
      </h2>
      <p className="type-small" data-testid="review-preview-fips">
        FIPS {county.fips}
      </p>
      {detail ? (
        <div data-testid="review-preview-priority">
          {priority ? (
            <>
              <AtlasPriorityBadge priority={priority} />
              <p className="type-small">
                Published review priority for follow-up. This is not a
                disease-risk estimate.
              </p>
            </>
          ) : (
            <p className="type-body">
              Review priority is unavailable for this county. Unavailable is not
              a finding of no risk.
            </p>
          )}
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
            Release loaded {detail.release.loaded_at}. That timestamp is not an
            observation period.
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
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-small">
              No source list was returned with this release.
            </p>
          )}
          <p className="type-small">{REVIEW_RATIONALE_SCORE_NOTE}</p>
          <p className="type-small">{detail.release.limitations}</p>
          {detail.population === null ? (
            <p>Population was not returned; it is not zero.</p>
          ) : null}
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
      </div>
    </Card>
  );
}
