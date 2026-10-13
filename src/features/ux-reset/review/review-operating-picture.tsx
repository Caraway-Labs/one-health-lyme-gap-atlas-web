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

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
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
  countyPassesAvailableData,
  EXPLORER_AVAILABLE_DATA_EMPTY,
  EXPLORER_AVAILABLE_DATA_ERROR,
  EXPLORER_AVAILABLE_DATA_LOADING,
  EXPLORER_AVAILABLE_DATA_OPEN,
  type ExplorerAvailableDataGate,
} from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerMapLayerControl } from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  explorerMapLayerById,
  paintExplorerMapLayer,
  type ExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";
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
import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
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
  mapLayer?: ExplorerMapLayerId;
  onCountyChange?: (fips: string | null, history: ReviewCountyHistory) => void;
  onViewCountyEvidence?: (fips: string) => void;
  period?: string | null;
  /** An invalid or repeated county arrival must not highlight another county. */
  requireExplicitCountySelection?: boolean;
  review: StateReview;
  scopeCode: string;
  stateName: string;
  tierRelease?: Tier1ActiveRelease;
  countyQuery?: string;
  /**
   * Available-data gate. Open keeps every county. Ready limits the list and
   * map to that FIPS set. Loading and error hide counties instead of showing
   * the unfiltered set under a restrictive toolbar filter.
   */
  availableDataGate?: ExplorerAvailableDataGate;
  onMapLayerChange?: (layerId: ExplorerMapLayerId) => void;
};

function resolveExplorerPaintColor(
  color: string | undefined
): string | undefined {
  if (!color?.startsWith("var(") || typeof document === "undefined") {
    return color;
  }
  const token = color.slice(4, -1).trim();
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || undefined;
}

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
  mapLayer = "gap_score",
  onCountyChange,
  onViewCountyEvidence,
  period = null,
  requireExplicitCountySelection = false,
  review,
  scopeCode,
  stateName,
  tierRelease = UNKNOWN_TIER_RELEASE,
  countyQuery = "",
  availableDataGate = EXPLORER_AVAILABLE_DATA_OPEN,
  onMapLayerChange,
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
  const fallbackFips =
    requireExplicitCountySelection || county
      ? ""
      : (candidates.find((entry) => publishedFips.has(entry.countyFips))
          ?.countyFips ?? "");
  const selectedFips = county
    ? publishedFips.has(county)
      ? county
      : ""
    : fallbackFips;
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
    if (requireExplicitCountySelection && !county) {
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
    requireExplicitCountySelection,
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
  const scoresQuery = useExplorerMapScores(releaseId, mapLayer);
  const mapPaint = useMemo(() => {
    const layer = explorerMapLayerById(mapLayer);
    const counties = (scoresQuery.data?.counties ?? []).filter(
      (county) => county.state === scopeCode
    );
    const scoresStatus = layer.needsScores
      ? !releaseId || scoresQuery.isError
        ? "error"
        : scoresQuery.isPending
          ? "loading"
          : "ready"
      : "ready";
    return paintExplorerMapLayer({
      counties,
      layerId: layer.id,
      scoresStatus,
    });
  }, [
    mapLayer,
    releaseId,
    scopeCode,
    scoresQuery.data,
    scoresQuery.isError,
    scoresQuery.isPending,
  ]);
  const inStateMapCounties = useMemo(
    () =>
      reviewMapCounties({
        geometryFips,
        scopeCode,
      }).map((county) => ({
        ...county,
        color: resolveExplorerPaintColor(
          mapPaint.colorsByFips.get(county.fips)
        ),
      })),
    [geometryFips, mapPaint.colorsByFips, scopeCode]
  );
  const mapCounties = useMemo(() => {
    switch (availableDataGate.kind) {
      case "open": {
        return inStateMapCounties;
      }
      case "ready": {
        return inStateMapCounties.filter((county) =>
          availableDataGate.fips.has(county.fips)
        );
      }
      case "loading":
      case "error": {
        return [];
      }
      default: {
        const exhaustive: never = availableDataGate;
        return exhaustive;
      }
    }
  }, [availableDataGate, inStateMapCounties]);
  const [fitSignal, setFitSignal] = useState(0);
  const publishedScoreByFips = useMemo(() => {
    const scores = new Map<string, { priority: string; score: number }>();
    for (const county of scoresQuery.data?.counties ?? []) {
      if (county.state !== scopeCode) {
        continue;
      }
      scores.set(county.fips, {
        priority: county.priority.trim(),
        score: county.score.score,
      });
    }
    return scores;
  }, [scopeCode, scoresQuery.data]);
  const selectCounty = useCallback(
    (fips: string, _surface: GeographySelectionSurface) => {
      if (!directory.counties.some((entry) => entry.fips === fips)) {
        return;
      }
      if (!countyPassesAvailableData(availableDataGate, fips)) {
        return;
      }
      onCountyChange?.(fips, "push");
    },
    [availableDataGate, directory.counties, onCountyChange]
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
    const publishedDirectory = layoutRef.current?.querySelector(
      '[aria-label="Published counties"]'
    );
    const row = layoutRef.current?.querySelector<HTMLButtonElement>(
      `button[data-fips="${selectedFips}"]`
    );
    const focusPublishedSelect = () => {
      layoutRef.current
        ?.querySelector<HTMLButtonElement>(
          '[data-testid="review-published-county-select"]'
        )
        ?.focus({ preventScroll: true });
    };
    if (publishedDirectory) {
      focusPublishedSelect();
    } else if (row) {
      const list = row.closest(".ux-reset-review-candidate-list");
      const alignRow = () => {
        if (!(list instanceof HTMLElement) || !row.isConnected) {
          return;
        }
        const rowBox = row.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        list.scrollTop = Math.max(
          0,
          rowBox.top - listBox.top + list.scrollTop - 8
        );
      };
      alignRow();
      row.focus({ preventScroll: true });
      const fips = selectedFips;
      requestAnimationFrame(() => {
        const current = layoutRef.current?.querySelector<HTMLButtonElement>(
          `button[data-fips="${fips}"]`
        );
        const currentList = current?.closest(".ux-reset-review-candidate-list");
        if (
          !(current instanceof HTMLButtonElement) ||
          !(currentList instanceof HTMLElement)
        ) {
          return;
        }
        const rowBox = current.getBoundingClientRect();
        const listBox = currentList.getBoundingClientRect();
        currentList.scrollTop = Math.max(
          0,
          rowBox.top - listBox.top + currentList.scrollTop - 8
        );
      });
    } else {
      focusPublishedSelect();
    }
    consumeReviewReturnFocus(selectedFips);
  }, [focusReturnedCounty, freezeCountySelection, selectedFips]);

  const geometryError = Boolean(geometryQuery.isError);
  const countyQueryText = countyQuery.trim().toLowerCase();
  const countyMatchesQuery = (name: string, fips: string) => {
    if (countyQueryText.length === 0) {
      return true;
    }
    const normalizedName = name.trim().toLowerCase();
    if (
      normalizedName.includes(countyQueryText) ||
      fips.includes(countyQueryText)
    ) {
      return true;
    }
    return (
      normalizedName.length > 0 &&
      countyQueryText.includes(fips) &&
      countyQueryText.includes(normalizedName)
    );
  };
  const passesAvailableData = (fips: string) =>
    countyPassesAvailableData(availableDataGate, fips);
  const availableDirectory = directory.counties.filter((entry) =>
    passesAvailableData(entry.fips)
  );
  const visibleDirectory = availableDirectory.filter((entry) =>
    countyMatchesQuery(entry.county, entry.fips)
  );
  const publishedPickerCounties =
    availableDataGate.kind === "ready" &&
    selectedPublished &&
    !availableDirectory.some((entry) => entry.fips === selectedPublished.fips)
      ? [selectedPublished, ...availableDirectory]
      : availableDirectory;
  const visibleCandidates = candidates.filter(
    (candidate) =>
      passesAvailableData(candidate.countyFips) &&
      countyMatchesQuery(
        reviewCandidateCountyLabel(candidate.countyName),
        candidate.countyFips
      )
  );
  const visibleCandidateCount = visibleCandidates.length;
  useEffect(() => {
    if (freezeCountySelection || !selectedFips || visibleCandidateCount === 0) {
      return;
    }
    const alignSelectedRow = () => {
      const row = layoutRef.current?.querySelector<HTMLButtonElement>(
        `button[data-fips="${selectedFips}"]`
      );
      const list = row?.closest(".ux-reset-review-candidate-list");
      if (
        !(row instanceof HTMLButtonElement) ||
        !(list instanceof HTMLElement) ||
        list.clientHeight === 0
      ) {
        return;
      }
      const rowBox = row.getBoundingClientRect();
      const listBox = list.getBoundingClientRect();
      const inside =
        rowBox.height > 0 &&
        rowBox.top >= listBox.top - 1 &&
        rowBox.bottom <= listBox.bottom + 1;
      if (inside) {
        return;
      }
      list.scrollTop += rowBox.top - listBox.top - 8;
    };
    alignSelectedRow();
    const frame = requestAnimationFrame(alignSelectedRow);
    const list = layoutRef.current?.querySelector(
      ".ux-reset-review-candidate-list"
    );
    const observer =
      list instanceof HTMLElement && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(alignSelectedRow)
        : null;
    if (list instanceof HTMLElement) {
      observer?.observe(list);
    }
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [freezeCountySelection, selectedFips, visibleCandidateCount]);
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
      <details className="ux-reset-review-result">
        <summary>Score and methodology</summary>
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
      </details>

      <div className="ux-reset-explorer-browse" data-testid="explorer-browse">
        <Card className="ux-reset-explorer-map ux-reset-review-operating-map map-card gap-0 py-0">
          <div className="ux-reset-explorer-map-heading">
            <div>
              <h2>{mapPaint.title}</h2>
              <p>
                {period
                  ? `Period ${period}`
                  : "Source periods vary by evidence"}
                {review.data_release_version.trim()
                  ? ` · Release ${review.data_release_version.trim()}`
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFitSignal((value) => value + 1);
              }}
            >
              Fit {stateName}
            </Button>
          </div>
          {onMapLayerChange ? (
            <div className="ux-reset-explorer-map-layer">
              <ExplorerMapLayerControl
                layerId={mapLayer}
                onLayerChange={onMapLayerChange}
              />
            </div>
          ) : null}
          <div
            className="map-wrap"
            data-include-unscored={
              availableDataGate.kind === "open" ? "true" : "false"
            }
            data-map-fips={mapCounties.map((county) => county.fips).join(" ")}
            data-testid="review-state-map-region"
            aria-busy={
              availableDataGate.kind === "loading" ||
              geometryPending ||
              (geometryReady &&
                hasMapCounties &&
                settledMapContext !== mapContext)
            }
          >
            {availableDataGate.kind === "loading" ? (
              <AtlasStatusMessage className="map-loading" tone="loading">
                <p data-testid="explorer-map-available-data-loading">
                  {EXPLORER_AVAILABLE_DATA_LOADING}
                </p>
              </AtlasStatusMessage>
            ) : availableDataGate.kind === "error" ? (
              <AtlasStatusMessage className="map-loading" tone="error">
                <p data-testid="explorer-map-available-data-error">
                  {EXPLORER_AVAILABLE_DATA_ERROR}
                </p>
              </AtlasStatusMessage>
            ) : geometryReady && hasMapCounties ? (
              <AtlasMap
                key={mapContext}
                ariaLabel={`Map of ${stateName}. Select a published county or use the Published county picker.`}
                cameraFrameState={scopeCode}
                fitSignal={fitSignal}
                geometry={geometryQuery.data as never}
                includeUnscoredCounties={availableDataGate.kind === "open"}
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
            ) : availableDataGate.kind === "ready" &&
              geometryReady &&
              inStateMapCounties.length > 0 ? (
              <AtlasStatusMessage className="map-loading" tone="empty">
                <p data-testid="explorer-map-available-data-empty">
                  {EXPLORER_AVAILABLE_DATA_EMPTY}
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
          <div
            className="ux-reset-explorer-legend"
            data-testid="explorer-map-legend"
          >
            <p className="type-small">{mapPaint.note}</p>
            {mapPaint.entries.length > 0 ? (
              <ul>
                {mapPaint.entries.map((entry) => (
                  <li key={`${entry.label}-${entry.color}`}>
                    <span
                      aria-hidden="true"
                      style={{ background: entry.color }}
                    />
                    {entry.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>

        <div className="ux-reset-explorer-list">
          <Card className="gap-0 p-3">
            <h2 className="type-card">
              {candidates.length > 0 ? "Ranked counties" : "Counties"}
            </h2>
            <p className="type-small">
              {candidates.length > 0
                ? stateName
                : `${availableDirectory.length} published counties. Alphabetical order; no recommendation ranking. Missing rank is not low priority.`}
              {authoritativeResultState === "unsupported"
                ? " Review recommendations are unavailable for this jurisdiction in the current release. You can still explore published county evidence."
                : ""}
            </p>
            {directory.isLoading ? (
              <AtlasStatusMessage tone="loading">
                Loading published counties…
              </AtlasStatusMessage>
            ) : null}
            {directory.isError ? (
              <AtlasStatusMessage tone="error">
                Published counties could not be loaded. Reload to retry; this is
                a request failure, not missing evidence.
              </AtlasStatusMessage>
            ) : null}
            {directory.isSuccess && directory.counties.length === 0 ? (
              <AtlasStatusMessage tone="empty">
                No published counties were returned for this state and release.
              </AtlasStatusMessage>
            ) : null}
            {availableDataGate.kind === "loading" ? (
              <AtlasStatusMessage tone="loading">
                <p data-testid="explorer-available-data-loading">
                  {EXPLORER_AVAILABLE_DATA_LOADING}
                </p>
              </AtlasStatusMessage>
            ) : null}
            {availableDataGate.kind === "error" ? (
              <AtlasStatusMessage tone="error">
                <p data-testid="explorer-available-data-error">
                  {EXPLORER_AVAILABLE_DATA_ERROR}
                </p>
              </AtlasStatusMessage>
            ) : null}
            {availableDataGate.kind === "ready" &&
            directory.isSuccess &&
            directory.counties.length > 0 &&
            availableDirectory.length === 0 ? (
              <p data-testid="explorer-available-data-empty">
                {EXPLORER_AVAILABLE_DATA_EMPTY}
              </p>
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
                className="h-9 w-full"
                disabled={publishedPickerCounties.length === 0}
                data-testid="review-published-county-select"
              >
                <SelectValue>
                  {selectedPublished?.county ?? "Select a published county"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {publishedPickerCounties.map((entry) => (
                  <SelectItem key={entry.fips} value={entry.fips}>
                    {entry.county}, {scopeCode} · {entry.fips}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {omittedOutOfScopeCount > 0 ? (
              <p className="type-small" data-testid="review-omitted-candidates">
                {omittedOutOfScopeCount === 1
                  ? `1 candidate was omitted because its county FIPS is not in ${stateName}.`
                  : `${omittedOutOfScopeCount} candidates were omitted because their county FIPS is not in ${stateName}.`}
              </p>
            ) : null}
            {omittedDuplicateCount > 0 ? (
              <p
                className="type-small"
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
              <p className="type-small" data-testid="review-no-candidates">
                No counties were returned in review candidates.
              </p>
            ) : null}
            {(availableDataGate.kind === "open" ||
              availableDataGate.kind === "ready") &&
            countyQueryText &&
            visibleCandidates.length === 0 &&
            visibleDirectory.length === 0 ? (
              <p>No counties match that name or FIPS.</p>
            ) : null}
            {candidates.length > 0 ? (
              <div
                aria-label="Counties suggested for review"
                className="ux-reset-review-candidate-list"
                role="list"
              >
                {visibleCandidates.map((candidate) => {
                  const published = publishedScoreByFips.get(
                    candidate.countyFips
                  );
                  return (
                    <div key={candidate.countyFips} role="listitem">
                      <button
                        aria-current={
                          candidate.countyFips === selectedFips
                            ? "true"
                            : undefined
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
                          {published?.priority
                            ? `${published.priority}. `
                            : null}
                          {reviewCandidateExplanation(candidate.candidate)}
                        </small>
                        {published ? (
                          <span className="ux-reset-explorer-county-score">
                            Published score {published.score}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {candidates.length === 0 && visibleDirectory.length > 0 ? (
              <div
                aria-label="Published counties"
                className="ux-reset-review-candidate-list"
                role="list"
              >
                {visibleDirectory.map((entry) => (
                  <div key={entry.fips} role="listitem">
                    <button
                      aria-current={
                        entry.fips === selectedFips ? "true" : undefined
                      }
                      className="ux-reset-review-candidate"
                      data-fips={entry.fips}
                      data-testid="review-published-county"
                      type="button"
                      onClick={() => selectCounty(entry.fips, "results_table")}
                    >
                      <strong>
                        {entry.county}, {scopeCode}
                      </strong>
                      <small>
                        Review category unavailable. Published county record.
                      </small>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
        <div className="ux-reset-explorer-preview">
          {!preview && handoff && releaseId && selectedPublished ? (
            <ReviewPublishedCountyPreview
              compareHref={handoff.compareHref}
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
              categoryLabel={
                authoritativeResultState === "candidates_found"
                  ? "Returned for review"
                  : authoritativeResultState
                    ? reviewResultStateLabel(authoritativeResultState)
                    : "Review category unavailable"
              }
              release={tierRelease}
              onOpen={markReviewReturnFocus}
              onViewCountyEvidence={onViewCountyEvidence}
            />
          ) : null}
          {preview || (handoff && releaseId && selectedPublished) ? null : (
            <p className="type-body" data-testid="explorer-preview-empty">
              No county is selected. Choose one from the list or the map.
            </p>
          )}
        </div>
      </div>

      {gapModel ? (
        <details className="ux-reset-review-result">
          <summary>Data gaps</summary>
          <section
            aria-label="Data gaps"
            className="ux-reset-review-gaps"
            data-testid="review-data-gaps"
          >
            <h3 className="type-card">Data gaps</h3>
            <p className="type-body">
              These records are not review candidates.
            </p>
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
        </details>
      ) : null}
      {omittedGapCount > 0 && !gapModel ? (
        <p className="type-body" data-testid="review-omitted-gaps">
          {omittedGapNote(omittedGapCount, stateName)}
        </p>
      ) : null}
    </div>
  );
}
