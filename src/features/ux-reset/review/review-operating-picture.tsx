"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Card } from "@/components/ui/card";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { EvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import {
  evidenceAvailabilityValues,
  type EvidenceProvenanceModel,
} from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import { COUNTY_BOUNDARIES_FILL } from "@/features/ux-reset/review/county-boundaries-palette";
import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import {
  countyPassesAvailableData,
  EXPLORER_AVAILABLE_DATA_EMPTY,
  EXPLORER_AVAILABLE_DATA_ERROR,
  EXPLORER_AVAILABLE_DATA_LOADING,
  EXPLORER_AVAILABLE_DATA_OPEN,
  type ExplorerAvailableDataGate,
} from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerLowerWorkspace } from "@/features/ux-reset/review/explorer-lower-workspace";
import {
  ExplorerMapSectionHeader,
  ExplorerMapSourceCaption,
} from "@/features/ux-reset/review/explorer-map-chrome";
import {
  ExplorerMapLayerAvailability,
  ExplorerMapLayerControl,
} from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  completenessLayerGate,
  explorerMapLayerById,
  explorerMapLayerGates,
  isExplorerObservationLayer,
  explorerUnpaintedFillColor,
  paintExplorerMapLayer,
  resolveExplorerMapColor,
  type ExplorerMapLayerId,
  type ExplorerMapLegendSource,
} from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapLegend } from "@/features/ux-reset/review/explorer-map-legend";
import {
  explorerMapFrameReady,
  explorerMapLoadingMode,
  explorerMapPaintRevision,
  explorerMapRenderedFrameSignature,
  explorerScoresLoadStatus,
} from "@/features/ux-reset/review/explorer-map-loading";
import {
  ExplorerMapLoadingOverlay,
  ExplorerMapSurface,
} from "@/features/ux-reset/review/explorer-map-loading-overlay";
import {
  rankExplorerCounties,
  type ExplorerRankSource,
} from "@/features/ux-reset/review/explorer-ranked-counties";
import { ExplorerRankedCountyList } from "@/features/ux-reset/review/explorer-ranked-county-list";
import {
  adjustCountyScenarios,
  SCENARIO_SCORE_DEFAULTS,
  scoreSettingsFromCollection,
} from "@/features/ux-reset/review/explorer-scenario-score";
import {
  applyGapScoreScenarioColors,
  explorerScenarioSelectionText,
  scenarioGapScoreLegend,
} from "@/features/ux-reset/review/explorer-what-if-scenario";
import { buildReviewCandidatePreview } from "@/features/ux-reset/review/review-candidate-preview";
import { alignCandidateRow } from "@/features/ux-reset/review/review-candidate-row-scroll";
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
  captureReviewReturnFocusMount,
  consumeReviewReturnFocus,
  markReviewReturnFocus,
  resolveReviewReturnFocus,
  reviewReturnFocusTokenForMount,
} from "@/features/ux-reset/review/review-return-focus";
import {
  isLower48CountyFips,
  stateFipsPrefix,
} from "@/features/ux-reset/review/review-state-fips";
import {
  useExplorerMapLoadingPresentation,
  useExplorerMapPaintSettlement,
  usePublishedExplorerMapFrame,
} from "@/features/ux-reset/review/use-explorer-map-loading";
import {
  knownEmptyMapSelection,
  observationGate,
  observationPaintState,
  useExplorerMapObservations,
} from "@/features/ux-reset/review/use-explorer-map-observations";
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
import type { ScoreSettings } from "@/lib/atlas-ui";
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
    loading: () => null,
    ssr: false,
  }
);

const UNKNOWN_TIER_RELEASE: Tier1ActiveRelease = { status: "unknown" };
const NO_LEGEND_SOURCES: readonly ExplorerMapLegendSource[] = [];

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
  /** Browser what-if. Defaults leave the governed score, priority, and map color in place. */
  scenarioSettings?: ScoreSettings;
  sources?: readonly ExplorerMapLegendSource[];
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
  scenarioSettings = SCENARIO_SCORE_DEFAULTS,
  scopeCode,
  sources = NO_LEGEND_SOURCES,
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
  const [returnFocusMount] = useState(captureReviewReturnFocusMount);
  const mountedReturnToken = reviewReturnFocusTokenForMount(returnFocusMount);

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
  const geometryFips = useMemo(() => {
    const prefix = stateFipsPrefix(scopeCode);
    return (
      geometryQuery.data?.features.flatMap((feature) => {
        const fips = feature.properties.fips;
        if (!fips || (prefix !== null && !fips.startsWith(prefix))) {
          return [];
        }
        return [fips];
      }) ?? []
    );
  }, [geometryQuery.data, scopeCode]);
  const geometryStatus = geometryQuery.isPending
    ? "loading"
    : geometryQuery.isError
      ? "error"
      : "ready";
  const observations = useExplorerMapObservations({
    activeLayerId: mapLayer,
    fips: geometryFips,
    geometryStatus,
    releaseId,
    scopeCode,
  });
  const knownEmptySelection = knownEmptyMapSelection(observations, mapLayer);
  const scoresQuery = useExplorerMapScores(releaseId);
  const scenarioBaseline = useMemo(
    () => scoreSettingsFromCollection(scoresQuery.data?.settings),
    [scoresQuery.data?.settings]
  );
  const scenarioByFips = useMemo(
    () =>
      adjustCountyScenarios(
        (scoresQuery.data?.counties ?? []).filter(
          (county) => county.state === scopeCode
        ),
        scenarioSettings,
        scenarioBaseline
      ),
    [scenarioBaseline, scenarioSettings, scopeCode, scoresQuery.data?.counties]
  );
  const lower48Scores = useMemo(
    () =>
      (scoresQuery.data?.counties ?? []).filter((county) =>
        isLower48CountyFips(county.fips)
      ),
    [scoresQuery.data?.counties]
  );
  const scoreLoadStatus = releaseId
    ? explorerScoresLoadStatus(scoresQuery)
    : "error";
  const layerGates = useMemo(
    () =>
      explorerMapLayerGates({
        completeness: completenessLayerGate({
          counties: lower48Scores,
          scoresStatus: scoreLoadStatus,
        }),
        observations: {
          incidence_floor: observationGate(observations.incidence_floor),
          rurality: observationGate(observations.rurality),
          svi: observationGate(observations.svi),
          uninsured: observationGate(observations.uninsured),
        },
      }),
    [lower48Scores, observations, scoreLoadStatus]
  );
  const mapPaint = useMemo(() => {
    const layer = explorerMapLayerById(mapLayer);
    if (isExplorerObservationLayer(layer.id)) {
      return paintExplorerMapLayer({
        counties: [],
        layerId: layer.id,
        observation: observationPaintState(observations[layer.id]),
        releaseId,
        scoresStatus: "ready",
        selectedFips,
        sources,
      });
    }
    if (layer.id === "completeness") {
      return paintExplorerMapLayer({
        counties: lower48Scores,
        layerId: "completeness",
        releaseId,
        scoresStatus: scoreLoadStatus,
        selectedFips,
        sources,
      });
    }
    const governedCounties = (scoresQuery.data?.counties ?? []).filter(
      (county) => county.state === scopeCode
    );
    const scenarioColors = scenarioByFips !== null && layer.id === "gap_score";
    const colored = scenarioColors
      ? applyGapScoreScenarioColors(governedCounties, scenarioByFips)
      : null;
    const scoresStatus = layer.needsScores
      ? releaseId
        ? explorerScoresLoadStatus({
            data: scoresQuery.data,
            isError: scoresQuery.isError,
            isFetching: scoresQuery.isFetching,
            isPending: scoresQuery.isPending,
          })
        : "error"
      : "ready";
    const paint = paintExplorerMapLayer({
      counties: colored?.counties ?? governedCounties,
      layerId: layer.id,
      releaseId,
      scoresStatus,
      sources,
    });
    const legend =
      colored && scoresStatus === "ready"
        ? scenarioGapScoreLegend(colored)
        : null;
    if (!legend) {
      return paint;
    }
    return {
      ...paint,
      ...legend,
    };
  }, [
    lower48Scores,
    mapLayer,
    observations,
    releaseId,
    scenarioByFips,
    scopeCode,
    scoreLoadStatus,
    scoresQuery.data,
    scoresQuery.isError,
    scoresQuery.isFetching,
    scoresQuery.isPending,
    selectedFips,
    sources,
  ]);
  const unpaintedCountyColor = resolveExplorerMapColor(
    explorerUnpaintedFillColor(mapPaint)
  );
  const inStateMapCounties = useMemo(
    () =>
      reviewMapCounties({
        geometryFips,
        scopeCode,
      }).map((county) => ({
        ...county,
        color:
          mapPaint.layerId === "boundaries"
            ? COUNTY_BOUNDARIES_FILL
            : (resolveExplorerMapColor(
                mapPaint.colorsByFips.get(county.fips)
              ) ?? unpaintedCountyColor),
      })),
    [
      geometryFips,
      mapPaint.colorsByFips,
      mapPaint.layerId,
      scopeCode,
      unpaintedCountyColor,
    ]
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
  const paintRevision = explorerMapPaintRevision({
    frameReady: explorerMapFrameReady({
      availableDataKind: availableDataGate.kind,
      geometryFailed: geometryQuery.isError,
      geometryPending: Boolean(releaseId) && geometryQuery.isPending,
      geometryPresent: Boolean(geometryQuery.data),
    }),
    frameSignature: explorerMapRenderedFrameSignature(mapCounties),
    layerId: mapPaint.layerId,
    paintKind: mapPaint.kind,
    releaseId: releaseId ?? "",
    scope: scopeCode,
  });
  const publishedMap = usePublishedExplorerMapFrame(paintRevision, mapCounties);
  const { onPaintSettled, settledRevision } = useExplorerMapPaintSettlement(
    publishedMap.revision
  );
  const mapRequestKey = `${scopeCode}:${releaseId ?? ""}:${mapLayer}`;
  const [failedMapRequest, setFailedMapRequest] = useState<string | null>(null);
  const mapFailed = failedMapRequest === mapRequestKey;
  const queryClient = useQueryClient();
  const activeObservation = isExplorerObservationLayer(mapLayer)
    ? observations[mapLayer]
    : null;
  const layerFailed =
    mapFailed ||
    activeObservation?.status === "error" ||
    (explorerMapLayerById(mapLayer).needsScores &&
      Boolean(releaseId) &&
      scoresQuery.isError &&
      !scoresQuery.isFetching);
  const mapLoading = useExplorerMapLoadingPresentation({
    mode: explorerMapLoadingMode({
      confirmedEmptyFrame: paintRevision !== null && mapCounties.length === 0,
      deferToOtherLoader:
        availableDataGate.kind === "loading" ||
        availableDataGate.kind === "error",
      geometryFailed: geometryQuery.isError,
      geometryPending: Boolean(releaseId) && geometryQuery.isPending,
      layerFailed,
      // Construction failure is included in layerFailed so this viewport shows
      // Retry. The national picture owns that case with its own status message.
      mapFailed: false,
      paintKind: mapPaint.kind,
      publishedRevision: publishedMap.revision,
      settledRevision,
    }),
    requestKey: mapRequestKey,
  });
  const retryMapLayer = useCallback(() => {
    if (mapFailed) {
      setFailedMapRequest(null);
      return;
    }
    if (isExplorerObservationLayer(mapLayer)) {
      void queryClient.refetchQueries({
        queryKey: ["ux-reset-explorer-map-observations", releaseId, mapLayer],
      });
      return;
    }
    if (explorerMapLayerById(mapLayer).needsScores) {
      void scoresQuery.refetch();
    }
  }, [mapFailed, mapLayer, queryClient, releaseId, scoresQuery]);
  const [fitSignal, setFitSignal] = useState(0);
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
  const selectedScenario = selectedFips
    ? scenarioByFips?.get(selectedFips)
    : null;
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
  const returnFocus = resolveReviewReturnFocus({
    latchedFips: latchedReturnFips,
    mountedToken: mountedReturnToken,
    selectedFips,
    urlCounty: county ?? "",
  });
  if (returnFocus.latch !== latchedReturnFips) {
    setLatchedReturnFips(returnFocus.latch);
  }
  const focusReturnedCounty = returnFocus.focus;

  const geometryError = Boolean(geometryQuery.isError);
  const countyQueryText = countyQuery.trim().toLowerCase();
  const rankedRows = useMemo(() => {
    const byFips = new Map<string, ExplorerRankSource>();
    const candidateNames = new Map(
      candidates.map((candidate) => [
        candidate.countyFips,
        reviewCandidateCountyLabel(candidate.countyName),
      ])
    );
    for (const entry of directory.counties) {
      byFips.set(entry.fips, {
        county: candidateNames.get(entry.fips) ?? entry.county,
        fips: entry.fips,
        score: null,
        state: scopeCode,
      });
    }
    for (const county of scoresQuery.data?.counties ?? []) {
      if (county.state !== scopeCode || !isLower48CountyFips(county.fips)) {
        continue;
      }
      const existing = byFips.get(county.fips);
      const score = county.in_contiguous_tick_scope ? county.score.score : null;
      byFips.set(county.fips, {
        color: score === null ? null : county.color,
        county:
          candidateNames.get(county.fips) ?? existing?.county ?? county.county,
        fips: county.fips,
        score,
        state: scopeCode,
      });
    }
    for (const [fips, county] of candidateNames) {
      if (byFips.has(fips)) {
        continue;
      }
      byFips.set(fips, { county, fips, score: null, state: scopeCode });
    }
    const visibleFips =
      availableDataGate.kind === "open"
        ? null
        : new Set(
            [...byFips.keys()].filter((fips) =>
              countyPassesAvailableData(availableDataGate, fips)
            )
          );
    return rankExplorerCounties([...byFips.values()], {
      query: countyQueryText,
      visibleFips,
    });
  }, [
    availableDataGate,
    candidates,
    countyQueryText,
    directory.counties,
    scopeCode,
    scoresQuery.data?.counties,
  ]);
  const candidateFips = useMemo(
    () => new Set(candidates.map((candidate) => candidate.countyFips)),
    [candidates]
  );
  const selectedReturnRank =
    rankedRows.find((row) => row.fips === selectedFips)?.rank ?? null;
  // County evidence keeps this picture mounted but parked. A focus call there
  // does not move the keyboard, and consuming the target would skip the
  // visible browse surface when the user comes back. Rank is part of the
  // dependency because a county moves from the unscored list into the ranked
  // list when scores arrive, and that move replaces the focused button.
  useLayoutEffect(() => {
    if (freezeCountySelection || !(focusReturnedCounty && selectedFips)) {
      return;
    }
    const root = layoutRef.current;
    if (!root) {
      return;
    }
    const fips = selectedFips;
    const rowSelector =
      selectedReturnRank === null
        ? `button[data-fips="${fips}"]:not([data-rank])`
        : `button[data-fips="${fips}"][data-rank="${selectedReturnRank}"]`;
    let focusedNode: HTMLButtonElement | null = null;
    const findRow = () => root.querySelector<HTMLButtonElement>(rowSelector);
    const alignRow = (row: HTMLButtonElement) => {
      const list = row.closest(".ux-reset-review-candidate-list");
      if (!(list instanceof HTMLElement) || !row.isConnected) {
        return;
      }
      alignCandidateRow(list, row);
    };
    // The published directory can drop for a render and replace this button
    // without changing the URL county. Reclaim focus only when that node is
    // gone, so a later Tab away from the row still sticks.
    const focusReturnedRow = () => {
      const row = findRow();
      if (!row) {
        return;
      }
      const previousGone = focusedNode !== null && !focusedNode.isConnected;
      if (
        document.activeElement !== row &&
        (focusedNode === null || previousGone || focusedNode !== row)
      ) {
        alignRow(row);
        row.focus({ preventScroll: true });
        focusedNode = row;
      }
    };
    focusReturnedRow();
    const consumeFrame = requestAnimationFrame(() => {
      const row = findRow();
      if (!(row && document.activeElement === row)) {
        return;
      }
      alignRow(row);
      consumeReviewReturnFocus(fips);
    });
    const observer = new MutationObserver(focusReturnedRow);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(consumeFrame);
      observer.disconnect();
    };
  }, [
    focusReturnedCounty,
    freezeCountySelection,
    selectedFips,
    selectedReturnRank,
  ]);
  const visibleCandidateCount = rankedRows.length;
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
      alignCandidateRow(list, row);
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
            showLimitations={false}
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
      </details>

      <div className="ux-reset-explorer-browse" data-testid="explorer-browse">
        <Card className="ux-reset-explorer-map ux-reset-review-operating-map map-card gap-0 py-0">
          <ExplorerMapSectionHeader
            fitLabel={`Fit ${scopeCode}`}
            fitPlaceName={stateName}
            fitTestId="explorer-fit-scope"
            onFit={() => {
              setFitSignal((value) => value + 1);
            }}
          />
          {onMapLayerChange ? (
            <div className="ux-reset-explorer-map-layer">
              <ExplorerMapLayerControl
                gates={layerGates}
                layerId={mapLayer}
                onLayerChange={onMapLayerChange}
              />
            </div>
          ) : null}
          {knownEmptySelection ? (
            <KnownEmptySelectionNotice
              omitCaveats
              selections={[knownEmptySelection]}
              testId="explorer-map-known-empty"
            />
          ) : null}
          <div
            className="map-wrap"
            data-include-unscored={
              availableDataGate.kind === "open" ? "true" : "false"
            }
            data-map-colors={mapCounties
              .map((county) => `${county.fips}:${county.color ?? ""}`)
              .join(" ")}
            data-map-fips={mapCounties.map((county) => county.fips).join(" ")}
            data-selected-fips={selectedFips}
            data-testid="review-state-map-region"
            aria-busy={
              mapLoading.busy ||
              availableDataGate.kind === "loading" ||
              geometryPending ||
              (geometryReady &&
                hasMapCounties &&
                !mapFailed &&
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
            ) : geometryReady && hasMapCounties && !mapFailed ? (
              <ExplorerMapSurface
                blockMap={mapLoading.blockMap}
                onPaintSettled={onPaintSettled}
                revision={publishedMap.revision}
              >
                <AtlasMap
                  key={mapContext}
                  ariaLabel={`Map of ${stateName}. Select a county from the map or the ranked list.`}
                  cameraFrameState={scopeCode}
                  fitSignal={fitSignal}
                  geometry={geometryQuery.data as never}
                  includeUnscoredCounties={availableDataGate.kind === "open"}
                  neutralCountyBoundaries={mapLayer === "boundaries"}
                  paintRevision={publishedMap.revision ?? undefined}
                  scores={publishedMap.frame}
                  selectedFips={selectedFips}
                  selectedState={scopeCode}
                  onError={() => {
                    setFailedMapRequest(mapRequestKey);
                  }}
                  onIdle={() => setSettledMapContext(mapContext)}
                  onPaintSettled={onPaintSettled}
                  onSelect={selectCounty}
                />
              </ExplorerMapSurface>
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
            ) : null}
            <ExplorerMapLoadingOverlay
              view={mapLoading.overlay}
              onRetry={retryMapLayer}
            />
          </div>
          <ExplorerMapLegend
            key={`${mapPaint.layerId}:${mapPaint.kind}:${mapPaint.title}`}
            paint={mapPaint}
          />
          {onMapLayerChange ? (
            <div className="ux-reset-explorer-map-availability">
              <ExplorerMapLayerAvailability gates={layerGates} />
            </div>
          ) : null}
          <ExplorerMapSourceCaption
            period={period}
            releaseId={review.data_release_version}
          />
        </Card>
        <ExplorerLowerWorkspace
          fips={selectedFips}
          governedNextCheck={preview?.followUp ?? null}
          releaseId={releaseId}
          reviewResultState={authoritativeResultState}
          whatIfActive={scenarioByFips !== null && mapLayer === "gap_score"}
        />

        <div className="ux-reset-explorer-list">
          <Card className="gap-0 p-3">
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
            rankedRows.length === 0 &&
            countyQueryText.length === 0 ? (
              <p data-testid="explorer-available-data-empty">
                {EXPLORER_AVAILABLE_DATA_EMPTY}
              </p>
            ) : null}
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
            <ExplorerRankedCountyList
              candidateFips={candidateFips}
              emptyLabel={
                countyQueryText
                  ? "No counties match that name or FIPS."
                  : "No counties in this state have a published Atlas gap score."
              }
              rows={rankedRows}
              scenarios={scenarioByFips}
              scopeKey={`${scopeCode}\u0000${availableDataGate.kind}`}
              selectedFips={selectedFips}
              testId="review-published-county"
              onSelect={(fips) => {
                selectCounty(fips, "ranked_list");
              }}
            />
          </Card>
        </div>
        <div className="ux-reset-explorer-preview">
          {selectedScenario ? (
            <p className="type-small" data-testid="explorer-scenario-selected">
              {explorerScenarioSelectionText(selectedScenario)}
            </p>
          ) : null}
          {!preview && handoff && releaseId && selectedPublished ? (
            <ReviewPublishedCountyPreview
              compareHref={handoff.compareHref}
              county={selectedPublished}
              onOpen={markReviewReturnFocus}
              openRef={openRef}
              releaseId={releaseId}
              reviewResultState={authoritativeResultState}
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
              releaseId={releaseId ?? ""}
              onOpen={markReviewReturnFocus}
              onViewCountyEvidence={onViewCountyEvidence}
            />
          ) : null}
          {preview || (handoff && releaseId && selectedPublished) ? null : (
            <>
              <p className="type-body" data-testid="explorer-preview-empty">
                No county is selected. Choose one from the list or the map.
              </p>
              <DownloadCountyPdfButton
                countyName=""
                fips=""
                releaseId=""
                stateCode=""
              />
            </>
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
            <EvidenceStateStrip model={gapModel} showCaveat={false} />
            <EvidenceProvenanceInspect
              provenance={gapModel.provenance}
              showLimitations={false}
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
