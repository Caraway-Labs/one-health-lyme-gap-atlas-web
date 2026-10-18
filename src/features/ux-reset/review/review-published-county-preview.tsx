"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Ref } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { askAtlasEntryHref } from "@/features/ux-reset/ask-atlas/page-reference";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { formatGovernedEvidenceValue } from "@/features/ux-reset/evidence/value-state-contract";
import type { ExploreCountyIdentity } from "@/features/ux-reset/explore/explore-model";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import {
  mapPublishedRow,
  publishedCountyHierarchy,
  publishedCountyRecordFromDetail,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
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

export function ReviewPublishedCountyPreview({
  county,
  compareHref,
  href,
  onOpen,
  onViewCountyEvidence,
  openRef,
  releaseId,
}: {
  county: ExploreCountyIdentity;
  compareHref: string;
  href: string;
  onOpen: (fips: string) => void;
  onViewCountyEvidence?: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  releaseId: string;
}) {
  const pathname = usePathname() ?? ATLAS_EXPLORER_PATH;
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const askContext = useAskAtlasInheritedContext();
  const askHref = askAtlasEntryHref({
    context: askContext,
    pathname,
    searchParams,
  });
  const query = useQuery({
    queryKey: ["ux-reset-review-published-county", releaseId, county.fips],
    queryFn: ({ signal }) =>
      loadInvestigateCountyRecord({ fips: county.fips, releaseId, signal }),
  });
  // Never present cached facts after a failed refresh as current evidence.
  const detail = query.isError ? null : query.data;
  const floor = detail ? reviewHumanFloorEvidence(detail) : null;
  const rows = detail
    ? publishedCountyHierarchy({
        measures: [],
        observedMeasureIds: [],
        record: publishedCountyRecordFromDetail(detail),
      }).rows.filter((row) =>
        [
          "tick_status",
          "scapularis_status",
          "burgdorferi_status",
          "population_2022",
        ].includes(row.measureId)
      )
    : [];
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
      {detail ? <ReviewRationalePanel detail={detail} /> : null}
      <div className="ux-reset-review-preview-support">
        <p className="type-body">Review category unavailable</p>
        <p className="type-small">
          FIPS {county.fips} · Release {releaseId}
        </p>
        <p className="type-body">
          Published county evidence is available. This selection is not a review
          recommendation, and it is not a disease-risk estimate.
        </p>
        <p className="type-small">
          Review recommendations are unavailable for this jurisdiction in the
          current release.
        </p>
        <div className="ux-reset-review-preview-actions">
          {onViewCountyEvidence ? (
            <Button
              data-county={county.fips}
              data-testid="review-view-county-evidence"
              type="button"
              onClick={() => {
                onViewCountyEvidence(county.fips);
              }}
            >
              View county evidence
            </Button>
          ) : null}
          <Link
            ref={openRef}
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "ux-reset-review-open"
            )}
            data-testid="review-investigate"
            data-variant="secondary"
            href={href}
            onClick={() => onOpen(county.fips)}
          >
            County evidence
          </Link>
          <Link
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "ux-reset-review-open"
            )}
            data-testid="review-compare"
            href={compareHref}
            onClick={() => onOpen(county.fips)}
          >
            Compare this county
          </Link>
          <Link
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "ux-reset-review-open"
            )}
            data-testid="review-ask-atlas"
            href={askHref}
          >
            Ask Atlas
          </Link>
        </div>
      </div>
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
      {detail === null && !query.isError ? (
        <AtlasStatusMessage tone="empty">
          No published county record was returned for this release.
        </AtlasStatusMessage>
      ) : null}
      {detail && floor ? (
        <>
          <p className="type-body">{floor.displayValue}</p>
          <p className="type-small">{floor.valueNote}</p>
          <p className="type-small">
            Pathogen “No records” is not evidence of pathogen absence. Tick
            establishment does not measure abundance.
          </p>
          <details className="ux-reset-explorer-score">
            <summary>Score and methodology</summary>
            {rows.map((row) => (
              <EvidenceObject
                key={row.measureId}
                model={row.evidence}
                showReason
              />
            ))}
            {detail.population === null ? (
              <p>Population was not returned; it is not zero.</p>
            ) : null}
            <p className="type-small">{detail.release.limitations}</p>
            <p className="type-small">
              Release loaded {detail.release.loaded_at}. This is not an
              observation period.
            </p>
          </details>
        </>
      ) : null}
    </Card>
  );
}
