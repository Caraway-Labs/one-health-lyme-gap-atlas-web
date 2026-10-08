"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Card } from "@/components/ui/card";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import {
  evidenceAvailabilityValues,
  type EvidenceProvenanceModel,
} from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import {
  buildReviewCompareHandoff,
  buildReviewInvestigateHandoff,
} from "@/features/ux-reset/review/review-county-preview";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import {
  reviewAbstainedOutcomeCopy,
  reviewMapCounties,
  reviewPictureState,
  reviewPictureSummary,
  reviewResultStateLabel,
} from "@/features/ux-reset/review/review-operating-state";
import {
  consumeReviewReturnFocus,
  markReviewReturnFocus,
  reviewReturnFocusMatches,
} from "@/features/ux-reset/review/review-return-focus";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { ValueState, type StateReview } from "@/generated/models";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";
import { formatAtlasTimestamp } from "@/lib/atlas-evidence-metadata";
import {
  countyDisplayGeometryQueryKey,
  fetchCountyDisplayGeometry,
} from "@/lib/county-geography";

const AtlasMap = dynamic(
  async () => {
    const mod = await import("@/components/atlas-map");
    return mod.AtlasMap;
  },
  {
    loading: () => (
      <AtlasStatusMessage className="map-loading" tone="loading">
        Loading map…
      </AtlasStatusMessage>
    ),
    ssr: false,
  }
);

const UNKNOWN_TIER_RELEASE: Tier1ActiveRelease = { status: "unknown" };

type ReviewCountyHistory = "push" | "replace";

type ReviewOperatingPictureProps = {
  county?: string | null;
  onCountyChange?: (fips: string | null, history: ReviewCountyHistory) => void;
  period?: string | null;
  review: StateReview;
  scopeCode: string;
  stateName: string;
  tierRelease?: Tier1ActiveRelease;
};

function gapEvidenceModel(review: StateReview) {
  const firstGap = review.data_gaps[0];
  const caveat =
    firstGap?.detail ??
    review.limitations[0] ??
    "A data gap was returned without further detail.";
  return {
    availability: evidenceAvailabilityValues.unavailable,
    provenance: {
      evidenceType: "Unavailable",
      inspectSummary: caveat,
      limitations:
        review.limitations.length > 0 ? review.limitations : [caveat],
      materialCaveat: caveat,
      observationPeriod: "Unavailable",
      sourceFamily: "Unavailable",
    },
    reasonCode: ValueState.UNAVAILABLE,
  };
}

const RESULT_FIELD_UNAVAILABLE = "Unavailable";

function reviewEvaluatedAt(value: string): { display: string; raw: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      display: RESULT_FIELD_UNAVAILABLE,
      raw: RESULT_FIELD_UNAVAILABLE,
    };
  }
  const formatted = formatAtlasTimestamp(trimmed);
  if (formatted === RESULT_FIELD_UNAVAILABLE) {
    return { display: RESULT_FIELD_UNAVAILABLE, raw: trimmed };
  }
  return { display: `${formatted} UTC`, raw: trimmed };
}

function reviewResultProvenance(review: StateReview): EvidenceProvenanceModel {
  const evaluatedAt = reviewEvaluatedAt(review.evaluated_at);
  return {
    evidenceType: RESULT_FIELD_UNAVAILABLE,
    inspectSummary:
      "Evaluation time and configuration identity for this review result.",
    limitations: review.limitations,
    materialCaveat: null,
    observationPeriod: RESULT_FIELD_UNAVAILABLE,
    sourceFamily: RESULT_FIELD_UNAVAILABLE,
    methodLabel: review.methodology_id,
    methodVersion: review.methodology_version,
    technical: {
      configurationSha256: review.configuration_sha256,
      evaluatedAt: evaluatedAt.display,
      evaluatedAtRaw: evaluatedAt.raw,
    },
  };
}

export function ReviewOperatingPicture({
  county = null,
  onCountyChange,
  period = null,
  review,
  scopeCode,
  stateName,
  tierRelease = UNKNOWN_TIER_RELEASE,
}: ReviewOperatingPictureProps) {
  const candidates = review.review_candidates;
  const candidateFips = useMemo(
    () => new Set(candidates.map((entry) => entry.county_fips)),
    [candidates]
  );
  const pictureState = reviewPictureState(review);
  const selectedFips = useMemo(() => {
    if (county && candidateFips.has(county)) {
      return county;
    }
    return candidates[0]?.county_fips ?? "";
  }, [candidateFips, candidates, county]);
  const [latchedReturnFips, setLatchedReturnFips] = useState<string | null>(
    null
  );
  const releaseId = review.data_release_version;

  usePublishExploreCommittedNavigation({
    county: selectedFips || null,
    dataset: review.data_release_version,
    period: period ?? null,
  });
  useEffect(() => {
    if (selectedFips) {
      if (county === selectedFips) {
        return;
      }
      onCountyChange?.(selectedFips, "replace");
      return;
    }
    if (county) {
      onCountyChange?.(null, "replace");
    }
  }, [county, onCountyChange, selectedFips]);

  const geometryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async () => fetchCountyDisplayGeometry(releaseId),
    queryKey: countyDisplayGeometryQueryKey("atlas-home", releaseId),
    staleTime: Infinity,
  });
  const geometryFips = useMemo(
    () =>
      geometryQuery.data?.features.flatMap((feature) =>
        feature.properties.fips ? [feature.properties.fips] : []
      ) ?? [],
    [geometryQuery.data]
  );
  const mapCounties = useMemo(
    () =>
      reviewMapCounties({
        candidateFips: candidates.map((entry) => entry.county_fips),
        geometryFips,
        scopeCode,
      }),
    [candidates, geometryFips, scopeCode]
  );
  const selectCounty = useCallback(
    (fips: string, _surface: GeographySelectionSurface) => {
      if (!candidateFips.has(fips)) {
        return;
      }
      onCountyChange?.(fips, "push");
    },
    [candidateFips, onCountyChange]
  );
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const layoutRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLAnchorElement>(null);
  const selected = candidates.find(
    (entry) => entry.county_fips === selectedFips
  );
  const preview = selected
    ? buildReviewCandidatePreview({
        candidate: selected,
        methodologyId: review.methodology_id,
        methodologyVersion: review.methodology_version,
        stateCode: scopeCode,
        stateName,
      })
    : null;
  const handoff = useMemo(() => {
    if (!selectedFips) {
      return null;
    }
    const source = {
      period,
      releaseId,
      scopeCode,
      searchParams: new URLSearchParams(searchKey),
      selectedFips,
    };
    return {
      compareHref: buildReviewCompareHandoff(source),
      ...buildReviewInvestigateHandoff(source),
    };
  }, [period, releaseId, scopeCode, searchKey, selectedFips]);
  const returnFocusMatches =
    /^\d{5}$/.test(selectedFips) && reviewReturnFocusMatches(selectedFips);
  if (returnFocusMatches && latchedReturnFips !== selectedFips) {
    setLatchedReturnFips(selectedFips);
  } else if (
    !returnFocusMatches &&
    latchedReturnFips !== null &&
    latchedReturnFips !== selectedFips
  ) {
    setLatchedReturnFips(null);
  }
  const focusReturnedCounty =
    returnFocusMatches || latchedReturnFips === selectedFips;
  useLayoutEffect(() => {
    if (!(focusReturnedCounty && selectedFips)) {
      return;
    }
    const row = layoutRef.current?.querySelector<HTMLButtonElement>(
      `button[data-fips="${selectedFips}"]`
    );
    if (row) {
      const list = row.closest(".ux-reset-review-candidate-list");
      if (list instanceof HTMLElement) {
        const rowBox = row.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        const visible =
          rowBox.top >= listBox.top && rowBox.bottom <= listBox.bottom;
        if (!visible) {
          row.scrollIntoView({ block: "nearest" });
        }
      }
      row.focus({ preventScroll: true });
    } else {
      openRef.current?.focus({ preventScroll: true });
    }
    consumeReviewReturnFocus(selectedFips);
  }, [focusReturnedCounty, selectedFips]);

  const geometryError = Boolean(geometryQuery.isError);
  const geometryReady = Boolean(geometryQuery.data);
  const hasMapCounties = mapCounties.length > 0;
  const gapModel =
    review.data_gaps.length > 0 ? gapEvidenceModel(review) : null;

  return (
    <div
      ref={layoutRef}
      className="ux-reset-review-operating"
      data-configuration-sha256={review.configuration_sha256}
      data-methodology-id={review.methodology_id}
      data-methodology-version={review.methodology_version}
      data-result-state={pictureState}
      data-testid="review-state-panel"
    >
      <div className="ux-reset-review-result">
        <h2 className="type-card">Review result</h2>
        <p data-testid="review-result-summary">
          {reviewPictureSummary(pictureState)}
        </p>
        <p data-testid="review-methodology">
          Method {review.methodology_id} {review.methodology_version}. Release{" "}
          {review.data_release_version}. {review.effective_observation_context}.
        </p>
        <div data-testid="review-result-provenance">
          <EvidenceProvenanceInspect
            provenance={reviewResultProvenance(review)}
            stateLabel={reviewResultStateLabel(review.result_state)}
          />
        </div>
        <p data-testid="review-backend-result">
          Backend result: {reviewResultStateLabel(review.result_state)}.{" "}
          {review.coverage.assessed_counties} assessed,{" "}
          {review.coverage.eligible_counties} eligible,{" "}
          {review.coverage.abstained_counties} abstained,{" "}
          {review.coverage.evaluated_counties} evaluated.
        </p>
        {review.limitations.length > 0 ? (
          <ul data-testid="review-limitations">
            {review.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <Card className="ux-reset-review-operating-map map-card gap-0 py-0">
        <AtlasSectionHeader
          className="card-title-row"
          eyebrow="State review scope"
          headingLevel="h2"
          title={`Counties in ${stateName}`}
        />
        <div className="map-wrap" data-testid="review-state-map-region">
          {geometryReady && hasMapCounties ? (
            <AtlasMap
              ariaLabel={`Map of ${stateName}. Review suggestions are in the county list.`}
              cameraFrameState={scopeCode}
              geometry={geometryQuery.data as never}
              scores={mapCounties}
              selectedFips={selectedFips}
              selectedState={scopeCode}
              onSelect={selectCounty}
            />
          ) : geometryError ? (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-error"
              tone="error"
            >
              <p>
                The map is temporarily unavailable. Use the county list to
                inspect the same review result.
              </p>
            </AtlasStatusMessage>
          ) : !hasMapCounties && !geometryQuery.isPending ? (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-empty"
              tone="empty"
            >
              <p>No county shapes were returned to draw for this result.</p>
            </AtlasStatusMessage>
          ) : (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-loading"
              tone="loading"
            >
              Loading map…
            </AtlasStatusMessage>
          )}
        </div>
        <p className="type-small">
          The map shows place. It does not color counties by a risk score.
          Suggestions are the review list.
        </p>
      </Card>

      <div className="ux-reset-review-operating-side">
        <Card className="gap-0 py-0">
          <AtlasSectionHeader
            className="card-title-row compact"
            eyebrow="Authoritative suggestions"
            headingLevel="h3"
            title="Counties to inspect"
          />
          {candidates.length === 0 ? (
            <p data-testid="review-no-candidates">
              No counties were returned in review candidates.
            </p>
          ) : (
            <div
              aria-label="Counties suggested for review"
              className="ux-reset-review-candidate-list"
              role="list"
            >
              {candidates.map((candidate) => (
                <div key={candidate.county_fips} role="listitem">
                  <button
                    aria-current={
                      candidate.county_fips === selectedFips
                        ? "true"
                        : undefined
                    }
                    className="ux-reset-review-candidate"
                    data-fips={candidate.county_fips}
                    data-testid="review-candidate"
                    type="button"
                    onClick={() =>
                      selectCounty(candidate.county_fips, "ranked_list")
                    }
                  >
                    <strong>
                      {candidate.county_name}, {scopeCode}
                    </strong>
                    <small>{candidate.reason_text}</small>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
        {pictureState === "candidates_found" &&
        review.coverage.abstained_counties > 0 ? (
          <section
            aria-label="Abstained counties"
            className="ux-reset-review-gaps"
            data-testid="review-abstained-outcomes"
          >
            <h3 className="type-card">Abstained counties</h3>
            <p className="type-body">
              {reviewAbstainedOutcomeCopy(review.coverage.abstained_counties)}
            </p>
            <p className="type-small">Rule coverage</p>
            <ul className="ux-reset-review-gap-list">
              {Object.entries(review.coverage.rule_coverage)
                .toSorted(([left], [right]) => left.localeCompare(right))
                .map(([rule, status]) => (
                  <li key={rule} data-rule={rule} data-status={status}>
                    {rule}: {status}
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
        {preview && handoff ? (
          <ReviewCountyPreviewPanel
            compareHref={handoff.compareHref}
            droppedNotes={handoff.droppedNotes}
            href={handoff.href}
            openRef={openRef}
            preview={preview}
            release={tierRelease}
            onOpen={markReviewReturnFocus}
          />
        ) : null}
      </div>

      {gapModel ? (
        <section
          aria-label="Data gaps"
          className="ux-reset-review-gaps"
          data-testid="review-data-gaps"
        >
          <h3 className="type-card">Data gaps</h3>
          <p className="type-body">These records are not review candidates.</p>
          <EvidenceStateStrip model={gapModel} showReason />
          <EvidenceProvenanceInspect
            availability={gapModel.availability}
            provenance={gapModel.provenance}
            reasonCode={gapModel.reasonCode}
          />
          <ul className="ux-reset-review-gap-list">
            {review.data_gaps.map((gap) => (
              <li
                key={`${gap.county_fips}-${gap.code}`}
                data-code={gap.code}
                data-fips={gap.county_fips}
                data-testid="review-data-gap"
              >
                <strong>FIPS {gap.county_fips}</strong> {gap.code}. {gap.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
