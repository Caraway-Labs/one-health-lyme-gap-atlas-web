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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import {
  evidenceAvailabilityValues,
  type EvidenceProvenanceModel,
} from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import {
  buildReviewCandidatePreview,
  reviewCandidateExplanation,
} from "@/features/ux-reset/review/review-candidate-preview";
import {
  buildReviewCompareHandoff,
  buildReviewInvestigateHandoff,
} from "@/features/ux-reset/review/review-county-preview";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import {
  REVIEW_FIELD_UNAVAILABLE,
  reviewDatasetId,
  reviewDatasetText,
  reviewText,
} from "@/features/ux-reset/review/review-governed-values";
import {
  isGovernedReviewResultState,
  reviewCandidateCountyLabel,
  reviewCandidatesWithheld,
  reviewMapCounties,
  reviewPictureState,
  reviewPictureSummary,
  reviewResultStateLabel,
  scopedReviewCandidates,
  scopedReviewGaps,
} from "@/features/ux-reset/review/review-operating-state";
import { ReviewPublishedCountyPreview } from "@/features/ux-reset/review/review-published-county-preview";
import {
  consumeReviewReturnFocus,
  markReviewReturnFocus,
  reviewReturnFocusMatches,
} from "@/features/ux-reset/review/review-return-focus";
import { usePublishedReviewCounties } from "@/features/ux-reset/review/use-published-review-counties";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { DataGap, StateReview } from "@/generated/models";
import type { GeographySelectionSurface } from "@/lib/atlas-analytics";
import {
  formatAtlasTimestamp,
  parseAtlasDateTime,
  parseConfigurationSha256,
} from "@/lib/atlas-evidence-metadata";
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
  /** Keep the map mounted without writing a county into the URL. */
  freezeCountySelection?: boolean;
  onCountyChange?: (fips: string | null, history: ReviewCountyHistory) => void;
  onViewCountyEvidence?: (fips: string) => void;
  period?: string | null;
  review: StateReview;
  scopeCode: string;
  stateName: string;
  tierRelease?: Tier1ActiveRelease;
};

function visibleLines(values: readonly string[]): string[] {
  const lines: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || lines.includes(trimmed)) {
      continue;
    }
    lines.push(trimmed);
  }
  return lines;
}

function gapEvidenceModel(
  gaps: readonly DataGap[],
  limitationLines: readonly string[]
) {
  const limitations = visibleLines(limitationLines);
  const detail = gaps
    .map((gap) => gap.detail.trim())
    .find((value) => value.length > 0);
  const caveat =
    detail ??
    limitations[0] ??
    "A data gap was returned without further detail.";
  return {
    availability: evidenceAvailabilityValues.unavailable,
    provenance: {
      evidenceType: "Unavailable",
      inspectSummary: caveat,
      limitations: limitations.length > 0 ? limitations : [caveat],
      materialCaveat: caveat,
      observationPeriod: "Unavailable",
      sourceFamily: "Unavailable",
    },
  };
}

/**
 * Coverage counts are completeness totals. A negative integer is not a total,
 * so the whole count line is Unavailable instead of an impossible county number.
 * Rule-coverage keys stay a separate list and are not part of this check.
 */
function reviewCoverageCountText(coverage: StateReview["coverage"]): string {
  const counts = [
    coverage.assessed_counties,
    coverage.eligible_counties,
    coverage.abstained_counties,
    coverage.evaluated_counties,
  ];
  const countsAreNonnegative = counts.every(
    (count) => Number.isInteger(count) && count >= 0
  );
  if (!countsAreNonnegative) {
    return `Coverage ${REVIEW_FIELD_UNAVAILABLE}`;
  }
  return `${coverage.assessed_counties} assessed, ${coverage.eligible_counties} eligible, ${coverage.abstained_counties} abstained, ${coverage.evaluated_counties} evaluated`;
}

function reviewRuleCoverage(
  coverage: StateReview["coverage"]
): { rule: string; status: string }[] {
  return Object.entries(coverage.rule_coverage)
    .flatMap(([rule, status]) => {
      const trimmedRule = rule.trim();
      if (!trimmedRule) {
        return [];
      }
      return [
        {
          rule: trimmedRule,
          status: reviewText(status),
        },
      ];
    })
    .toSorted((left, right) => left.rule.localeCompare(right.rule));
}

function omittedGapNote(count: number, stateName: string): string {
  return count === 1
    ? `1 data gap was omitted because its county FIPS is not in ${stateName}.`
    : `${count} data gaps were omitted because their county FIPS is not in ${stateName}.`;
}

function reviewEvaluatedAt(value: string): { display: string; raw: string } {
  const raw = parseAtlasDateTime(value);
  if (!raw) {
    return {
      display: REVIEW_FIELD_UNAVAILABLE,
      raw: REVIEW_FIELD_UNAVAILABLE,
    };
  }
  const formatted = formatAtlasTimestamp(raw);
  if (formatted === REVIEW_FIELD_UNAVAILABLE) {
    return {
      display: REVIEW_FIELD_UNAVAILABLE,
      raw: REVIEW_FIELD_UNAVAILABLE,
    };
  }
  return { display: `${formatted} UTC`, raw };
}

function reviewResultProvenance(review: StateReview): EvidenceProvenanceModel {
  const evaluatedAt = reviewEvaluatedAt(review.evaluated_at);
  return {
    evidenceType: REVIEW_FIELD_UNAVAILABLE,
    inspectSummary:
      "Evaluation time and configuration identity for this review result.",
    limitations: visibleLines(review.limitations),
    materialCaveat: null,
    observationPeriod: REVIEW_FIELD_UNAVAILABLE,
    sourceFamily: REVIEW_FIELD_UNAVAILABLE,
    methodLabel: review.methodology_id.trim() || null,
    methodVersion: review.methodology_version.trim() || null,
    technical: {
      configurationSha256: parseConfigurationSha256(
        review.configuration_sha256
      ),
      methodologyVersion: review.methodology_version.trim() || null,
      evaluatedAt: evaluatedAt.display,
      evaluatedAtRaw: evaluatedAt.raw,
    },
  };
}

export function ReviewOperatingPicture({
  county = null,
  freezeCountySelection = false,
  onCountyChange,
  onViewCountyEvidence,
  period = null,
  review,
  scopeCode,
  stateName,
  tierRelease = UNKNOWN_TIER_RELEASE,
}: ReviewOperatingPictureProps) {
  const scopedCandidates = useMemo(
    () => scopedReviewCandidates(review.review_candidates, scopeCode),
    [review.review_candidates, scopeCode]
  );
  const scopedGaps = useMemo(
    () => scopedReviewGaps(review.data_gaps, scopeCode),
    [review.data_gaps, scopeCode]
  );
  const resultState = isGovernedReviewResultState(review.result_state)
    ? review.result_state
    : null;
  // An ungoverned state still shows returned rows. A governed state that
  // contradicts its candidate list publishes none of them.
  const suppressCandidates = reviewCandidatesWithheld(review);
  const authoritativeResultState = suppressCandidates ? null : resultState;
  const candidates = useMemo(
    () => (suppressCandidates ? [] : scopedCandidates.candidates),
    [scopedCandidates.candidates, suppressCandidates]
  );
  const omittedDuplicateCount = suppressCandidates
    ? 0
    : scopedCandidates.omittedDuplicateCount;
  const omittedOutOfScopeCount = suppressCandidates
    ? 0
    : scopedCandidates.omittedOutOfScopeCount;
  const releaseId = reviewDatasetId(review.data_release_version);
  const mapContext = `${scopeCode}:${releaseId ?? ""}`;
  const [settledMapContext, setSettledMapContext] = useState<string | null>(
    null
  );
  const directory = usePublishedReviewCounties(scopeCode, releaseId);
  const publishedFips = new Set(directory.counties.map((entry) => entry.fips));
  const pictureState = authoritativeResultState
    ? reviewPictureState({
        data_gaps: scopedGaps.gaps.map((entry) => entry.gap),
        result_state: authoritativeResultState,
        review_candidates: review.review_candidates,
      })
    : null;
  const selectedFips = county
    ? publishedFips.has(county)
      ? county
      : ""
    : (candidates.find((entry) => publishedFips.has(entry.countyFips))
        ?.countyFips ?? "");
  const [latchedReturnFips, setLatchedReturnFips] = useState<string | null>(
    null
  );

  usePublishExploreCommittedNavigation({
    county: selectedFips || null,
    dataset: releaseId,
    period: period ?? null,
  });
  useEffect(() => {
    if (freezeCountySelection || !directory.isSuccess) {
      return;
    }
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
  }, [
    county,
    directory.isSuccess,
    freezeCountySelection,
    onCountyChange,
    selectedFips,
  ]);

  const geometryQuery = useQuery({
    enabled: Boolean(releaseId),
    queryFn: async () => {
      if (!releaseId) {
        throw new Error("Review geometry requires a release id.");
      }
      return fetchCountyDisplayGeometry(releaseId);
    },
    queryKey: countyDisplayGeometryQueryKey(
      "atlas-home",
      releaseId ?? undefined
    ),
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
        geometryFips,
        scopeCode,
      }),
    [geometryFips, scopeCode]
  );
  const selectCounty = useCallback(
    (fips: string, _surface: GeographySelectionSurface) => {
      if (!directory.counties.some((entry) => entry.fips === fips)) {
        return;
      }
      onCountyChange?.(fips, "push");
    },
    [directory.counties, onCountyChange]
  );
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const layoutRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<HTMLAnchorElement>(null);
  const selectedPublished = directory.counties.find(
    (entry) => entry.fips === selectedFips
  );
  const selected = candidates.find(
    (entry) => entry.countyFips === selectedFips
  );
  const preview = selected
    ? buildReviewCandidatePreview({
        candidate: selected.candidate,
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
      releaseId: releaseId ?? "",
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
  // County evidence keeps this picture mounted but parked. A focus call there
  // does not move the keyboard, and consuming the target would skip the
  // visible browse surface when the user comes back.
  useLayoutEffect(() => {
    if (freezeCountySelection || !(focusReturnedCounty && selectedFips)) {
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
      layoutRef.current
        ?.querySelector<HTMLButtonElement>(
          '[data-testid="review-published-county-select"]'
        )
        ?.focus({ preventScroll: true });
    }
    consumeReviewReturnFocus(selectedFips);
  }, [focusReturnedCounty, freezeCountySelection, selectedFips]);

  const geometryError = Boolean(geometryQuery.isError);
  const geometryReady = Boolean(geometryQuery.data) && !geometryError;
  // A disabled geometry query stays pending in React Query v5. An unusable
  // release never starts that request, so it is unavailable rather than loading.
  const geometryUnavailable = !releaseId;
  const geometryPending = Boolean(releaseId) && geometryQuery.isPending;
  const hasMapCounties = mapCounties.length > 0;
  const gapModel =
    scopedGaps.gaps.length > 0
      ? gapEvidenceModel(
          scopedGaps.gaps.map((entry) => entry.gap),
          review.limitations
        )
      : null;
  const omittedGapCount = scopedGaps.omittedOutOfScopeCount;
  const resultLimitations = visibleLines(review.limitations);
  const ruleCoverage = reviewRuleCoverage(review.coverage);

  return (
    <div
      ref={layoutRef}
      className="ux-reset-review-operating"
      data-configuration-sha256={
        parseConfigurationSha256(review.configuration_sha256) ?? undefined
      }
      data-methodology-id={review.methodology_id.trim() || undefined}
      data-methodology-version={review.methodology_version.trim() || undefined}
      data-result-state={pictureState ?? "unavailable"}
      data-testid="review-state-panel"
    >
      <div className="ux-reset-review-result">
        <h2 className="type-card">Review result</h2>
        <p data-testid="review-result-summary">
          {pictureState
            ? reviewPictureSummary(pictureState)
            : REVIEW_FIELD_UNAVAILABLE}
        </p>
        <p data-testid="review-methodology">
          Method {reviewText(review.methodology_id)}{" "}
          {reviewText(review.methodology_version)}. Release{" "}
          {reviewDatasetText(review.data_release_version)}.{" "}
          {reviewText(review.effective_observation_context)}.
        </p>
        <div data-testid="review-result-provenance">
          <EvidenceProvenanceInspect
            provenance={reviewResultProvenance(review)}
            stateHeading="Review result"
            stateLabel={
              authoritativeResultState
                ? reviewResultStateLabel(authoritativeResultState)
                : REVIEW_FIELD_UNAVAILABLE
            }
          />
        </div>
        <p data-testid="review-backend-result">
          Backend result:{" "}
          {authoritativeResultState
            ? reviewResultStateLabel(authoritativeResultState)
            : REVIEW_FIELD_UNAVAILABLE}
          . {reviewCoverageCountText(review.coverage)}.
        </p>
        {authoritativeResultState === "unsupported" ? (
          <p className="type-body">
            Review recommendations are unsupported for this scope and release.
            Published county evidence can still be explored; selection does not
            create a recommendation.
          </p>
        ) : null}
        {ruleCoverage.length > 0 ? (
          <section
            aria-label="Rule coverage"
            data-testid="review-rule-coverage"
          >
            <h3 className="type-card">Rule coverage</h3>
            <ul className="ux-reset-review-rule-list">
              {ruleCoverage.map((entry) => (
                <li
                  key={entry.rule}
                  data-rule={entry.rule}
                  data-status={entry.status}
                >
                  {entry.rule}: {entry.status}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {resultLimitations.length > 0 ? (
          <ul data-testid="review-limitations">
            {resultLimitations.map((limitation) => (
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
        <div
          className="map-wrap"
          data-testid="review-state-map-region"
          aria-busy={
            geometryPending ||
            (geometryReady &&
              hasMapCounties &&
              settledMapContext !== mapContext)
          }
        >
          {geometryReady && hasMapCounties ? (
            <AtlasMap
              key={mapContext}
              ariaLabel={`Map of ${stateName}. Select a published county or use the Published county picker.`}
              cameraFrameState={scopeCode}
              geometry={geometryQuery.data as never}
              scores={mapCounties}
              selectedFips={selectedFips}
              selectedState={scopeCode}
              onSelect={selectCounty}
              onIdle={() => setSettledMapContext(mapContext)}
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
          ) : geometryUnavailable ? (
            <AtlasStatusMessage
              className="map-loading"
              data-testid="review-state-map-unavailable"
              tone="empty"
            >
              <p data-testid="review-state-map-unavailable">
                The map is unavailable. This result did not include a release
                Atlas can request.
              </p>
            </AtlasStatusMessage>
          ) : !hasMapCounties && !geometryPending ? (
            <AtlasStatusMessage className="map-loading" tone="empty">
              <p data-testid="review-state-map-empty">
                No county shapes were returned to draw for this result.
              </p>
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
        <Card className="gap-0 p-4">
          <h2 className="type-card">Published county exploration</h2>
          <p className="type-body">
            Factual county evidence is separate from review recommendations.
            Select a county to inspect its published record.
          </p>
          {directory.isLoading ? (
            <AtlasStatusMessage tone="loading">
              Loading published counties…
            </AtlasStatusMessage>
          ) : null}
          {directory.isError ? (
            <AtlasStatusMessage tone="error">
              Published counties could not be loaded. Reload to retry; this is a
              request failure, not missing evidence.
            </AtlasStatusMessage>
          ) : null}
          {directory.isSuccess && directory.counties.length === 0 ? (
            <AtlasStatusMessage tone="empty">
              No published counties were returned for this state and release.
            </AtlasStatusMessage>
          ) : null}
          <Select
            value={selectedFips || null}
            onValueChange={(fips) => {
              if (fips) {
                selectCounty(fips, "ranked_list");
              }
            }}
          >
            <SelectTrigger
              aria-label="Published county"
              className="h-11 w-full"
              disabled={!directory.counties.length}
              data-testid="review-published-county-select"
            >
              <SelectValue>
                {selectedPublished?.county ?? "Select a published county"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {directory.counties.map((entry) => (
                <SelectItem key={entry.fips} value={entry.fips}>
                  {entry.county}, {scopeCode} · {entry.fips}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="type-small">
            {directory.counties.length} published counties. Alphabetical order;
            no recommendation ranking.
          </p>
        </Card>
        <Card className="gap-0 py-0">
          <AtlasSectionHeader
            className="card-title-row compact"
            eyebrow="Authoritative suggestions"
            headingLevel="h3"
            title="Counties to inspect"
          />
          {omittedOutOfScopeCount > 0 ? (
            <p className="type-body" data-testid="review-omitted-candidates">
              {omittedOutOfScopeCount === 1
                ? `1 candidate was omitted because its county FIPS is not in ${stateName}.`
                : `${omittedOutOfScopeCount} candidates were omitted because their county FIPS is not in ${stateName}.`}
            </p>
          ) : null}
          {omittedDuplicateCount > 0 ? (
            <p
              className="type-body"
              data-testid="review-omitted-duplicate-candidates"
            >
              {omittedDuplicateCount === 1
                ? "1 candidate was omitted because its county FIPS was already listed."
                : `${omittedDuplicateCount} candidates were omitted because their county FIPS was already listed.`}
            </p>
          ) : null}
          {!suppressCandidates &&
          candidates.length === 0 &&
          omittedOutOfScopeCount === 0 &&
          omittedDuplicateCount === 0 ? (
            <p data-testid="review-no-candidates">
              No counties were returned in review candidates.
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <div
              aria-label="Counties suggested for review"
              className="ux-reset-review-candidate-list"
              role="list"
            >
              {candidates.map((candidate) => (
                <div key={candidate.countyFips} role="listitem">
                  <button
                    aria-current={
                      candidate.countyFips === selectedFips ? "true" : undefined
                    }
                    className="ux-reset-review-candidate"
                    data-fips={candidate.countyFips}
                    data-testid="review-candidate"
                    type="button"
                    onClick={() =>
                      selectCounty(candidate.countyFips, "ranked_list")
                    }
                  >
                    <strong>
                      {reviewCandidateCountyLabel(candidate.countyName)},{" "}
                      {scopeCode}
                    </strong>
                    <small>
                      {reviewCandidateExplanation(candidate.candidate)}
                    </small>
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
        {!preview && handoff && releaseId && selectedPublished ? (
          <ReviewPublishedCountyPreview
            county={selectedPublished}
            href={handoff.href}
            onOpen={markReviewReturnFocus}
            onViewCountyEvidence={onViewCountyEvidence}
            openRef={openRef}
            releaseId={releaseId}
          />
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
            onViewCountyEvidence={onViewCountyEvidence}
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
          <EvidenceStateStrip model={gapModel} />
          <EvidenceProvenanceInspect
            provenance={gapModel.provenance}
            stateLabel="Unavailable"
          />
          {omittedGapCount > 0 ? (
            <p className="type-body" data-testid="review-omitted-gaps">
              {omittedGapNote(omittedGapCount, stateName)}
            </p>
          ) : null}
          <ul className="ux-reset-review-gap-list">
            {scopedGaps.gaps.map((entry) => (
              <li
                key={`${entry.countyFips}-${entry.gap.code}`}
                data-code={entry.gap.code.trim() || undefined}
                data-fips={entry.countyFips}
                data-testid="review-data-gap"
              >
                <strong>FIPS {entry.countyFips}</strong>{" "}
                {reviewText(entry.gap.code)}. {reviewText(entry.gap.detail)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {omittedGapCount > 0 && !gapModel ? (
        <p className="type-body" data-testid="review-omitted-gaps">
          {omittedGapNote(omittedGapCount, stateName)}
        </p>
      ) : null}
    </div>
  );
}
