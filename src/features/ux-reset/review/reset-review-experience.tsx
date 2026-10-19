"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import {
  inheritedContextFromReview,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { PageIntroduction } from "@/features/ux-reset/page-introduction";
import { resetRouteById } from "@/features/ux-reset/paths";
import { ExplorerCountyEvidence } from "@/features/ux-reset/review/explorer-county-evidence";
import {
  downloadExplorerCountyList,
  explorerAvailableDataGate,
  explorerCountyListCsv,
  explorerCountyListFilename,
  countyQueryAfterSelectionChange,
  filterExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";
import { ExplorerCountyToolbar } from "@/features/ux-reset/review/explorer-county-toolbar";
import {
  explorerFollowUpSelection,
  explorerFollowUpState,
  explorerReviewLoad,
} from "@/features/ux-reset/review/explorer-follow-up";
import {
  explorerFocusCountyMismatch,
  parseExplorerMapFocus,
} from "@/features/ux-reset/review/explorer-map-focus";
import {
  explorerMapLayerById,
  type ExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";
import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_SELECTION_REQUIRED,
  resolveExplorerModeQuery,
} from "@/features/ux-reset/review/explorer-mode";
import {
  ExplorerWhatIfScenario,
  explorerScenarioScopeSupported,
  resolveExplorerWhatIfImpact,
} from "@/features/ux-reset/review/explorer-what-if-scenario";
import {
  hasExplicitReviewLocation,
  hasExplicitReviewScopeParam,
  isReviewStartingScopeUnresolved,
  reviewScopeQueryCanonicalRewrite,
} from "@/features/ux-reset/review/resolve-review-scope";
import {
  leavingReviewDestination,
  settleReviewCanonicalRewrite,
} from "@/features/ux-reset/review/review-canonical-navigation";
import {
  reviewDatasetId,
  reviewDatasetText,
  reviewText,
} from "@/features/ux-reset/review/review-governed-values";
import {
  explicitNationalCountyFromHistory,
  installExplicitNationalCountyCarry,
  nationalHistoryCountyMatches,
  stampExplicitNationalCounty,
} from "@/features/ux-reset/review/review-national-county-choice";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  isUnsupportedReviewScope,
  normalizeReviewCounty,
  REVIEW_REQUEST_FAILURE_MESSAGE,
  reviewCountyFipsForScope,
  unsupportedReviewScopeMessage,
} from "@/features/ux-reset/review/review-operating-state";
import { ReviewReleaseEvidence } from "@/features/ux-reset/review/review-release-evidence";
import { markReviewReturnFocus } from "@/features/ux-reset/review/review-return-focus";
import {
  reviewSearchParams,
  scenarioSearchParamPatch,
} from "@/features/ux-reset/review/review-search-params";
import { isLower48ReviewScope } from "@/features/ux-reset/review/review-state-fips";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { useExplorerCountyReference } from "@/features/ux-reset/review/use-explorer-county-reference";
import { useExplorerMapScores } from "@/features/ux-reset/review/use-explorer-map-scores";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { usePublishedReviewCounties } from "@/features/ux-reset/review/use-published-review-counties";
import { useReviewPresentation } from "@/features/ux-reset/review/use-review-presentation";
import { useStateReview } from "@/features/ux-reset/review/use-state-review";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
} from "@/lib/atlas-state-geography";
import type { EvidenceView, ScoreSettings } from "@/lib/atlas-ui";

type ReviewInheritedCounty = {
  county: string;
  fips: string;
  stateName: string;
};

function reviewInheritedIdentities(input: {
  chosenNationalFips: string | null;
  directoryCounties: readonly ReviewInheritedCounty[];
  nationalCounties: readonly ReviewInheritedCounty[];
  nationalScope: boolean;
  ready: boolean;
  selectedFips: string | null;
}): { county: string; fips: string; state_name: string }[] {
  let fips: string | null = null;
  if (input.ready) {
    fips = input.selectedFips;
  } else if (
    input.nationalScope &&
    input.chosenNationalFips &&
    input.chosenNationalFips === input.selectedFips
  ) {
    fips = input.chosenNationalFips;
  }
  if (!fips) {
    return [];
  }
  const source = input.ready ? input.directoryCounties : input.nationalCounties;
  const entry = source.find((county) => county.fips === fips);
  if (!entry) {
    return [];
  }
  return [
    {
      county: entry.county,
      fips: entry.fips,
      state_name: entry.stateName,
    },
  ];
}

function ResetReviewExperienceInner() {
  const route = resetRouteById("explorer");
  const router = useRouter();
  const [urlState, setUrlState] = useQueryStates(reviewSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const scope = urlState.scope;
  const searchParams = useSearchParams();
  const [arrivalExplicitScope] = useState(() =>
    hasExplicitReviewScopeParam(searchParams)
  );
  const [arrivalExplicitLocation] = useState(() =>
    hasExplicitReviewLocation(searchParams)
  );
  const userChoseScopeRef = useRef(false);
  const [userChoseScope, setUserChoseScope] = useState(false);
  const scenarioSettings = useMemo<ScoreSettings>(
    () => ({
      ecological_share: urlState.eco,
      low_incidence_breakpoint: urlState.breakpoint,
      missing_human_weakness: urlState.missing,
    }),
    [urlState.breakpoint, urlState.eco, urlState.missing]
  );
  const setScenarioSettings = useCallback(
    (next: ScoreSettings) => {
      void setUrlState(
        {
          breakpoint: next.low_incidence_breakpoint,
          eco: next.ecological_share,
          missing: next.missing_human_weakness,
        },
        { history: "replace" }
      );
    },
    [setUrlState]
  );
  useEffect(() => {
    const patch = scenarioSearchParamPatch(searchParams);
    if (!patch) {
      return;
    }
    void setUrlState(patch, { history: "replace" });
  }, [searchParams, setUrlState]);
  useEffect(() => {
    const values = searchParams.getAll("focus");
    const canonical =
      values.length === 1 ? parseExplorerMapFocus(values[0]) : null;
    const focusRewrite =
      values.length > 0 && !(values.length === 1 && values[0] === canonical);
    const clearCounty = explorerFocusCountyMismatch(canonical, urlState.county);
    if (!(focusRewrite || clearCounty)) {
      return;
    }
    void setUrlState(
      {
        ...(clearCounty ? { county: null } : {}),
        ...(focusRewrite ? { focus: canonical } : {}),
      },
      { history: "replace" }
    );
  }, [searchParams, setUrlState, urlState.county]);
  const [countyQuery, setCountyQuery] = useState("");
  const [availableData, setAvailableData] = useState<EvidenceView>("all");
  const [countyQueryScope, setCountyQueryScope] = useState(scope);
  const [pendingSelectedQuery, setPendingSelectedQuery] = useState<
    string | null
  >(null);
  if (countyQueryScope !== scope) {
    setCountyQueryScope(scope);
    setCountyQuery(pendingSelectedQuery ?? "");
    if (pendingSelectedQuery !== null) {
      setPendingSelectedQuery(null);
    }
  }
  const rewrittenScopeKey = useRef<string | null>(null);
  const replacedModeKey = useRef<string | null>(null);
  const pendingLeaveRef = useRef<string | null>(null);
  const rewriteGenerationRef = useRef(0);
  const rawScopeKey = searchParams.getAll("scope").join("\u0000");
  const rawModeValues = searchParams.getAll("mode");
  const rawModeKey = rawModeValues.join("\u0000");
  const modeQuery = resolveExplorerModeQuery(rawModeValues);
  const explorerMode = modeQuery.mode;
  const reviewCounty = normalizeReviewCounty(scope, urlState.county);
  const focusedNationalCounty = explorerFocusCountyMismatch(
    urlState.focus,
    reviewCounty
  )
    ? null
    : reviewCounty;
  const [trackedCountyQueryCounty, setTrackedCountyQueryCounty] =
    useState(reviewCounty);
  if (trackedCountyQueryCounty !== reviewCounty) {
    const nextQuery = countyQueryAfterSelectionChange(
      countyQuery,
      trackedCountyQueryCounty,
      reviewCounty
    );
    setTrackedCountyQueryCounty(reviewCounty);
    if (nextQuery !== null) {
      setCountyQuery(nextQuery);
    }
  }
  const profileQuery = useProfileDefaultJurisdiction();

  const scopeUnsupported = isUnsupportedReviewScope(scope);
  const presentationQuery = useReviewPresentation(
    scope,
    urlState.dataset,
    false
  );
  const confirmedRelease =
    presentationQuery.metadata &&
    (urlState.dataset === null ||
      presentationQuery.metadata.release_id === urlState.dataset)
      ? presentationQuery.metadata.release_id
      : null;
  const stateReview = useStateReview(
    scope,
    scopeUnsupported ? null : confirmedRelease
  );
  const countyReference = useExplorerCountyReference(
    scopeUnsupported ? null : confirmedRelease
  );
  const scenarioScopeSupported = explorerScenarioScopeSupported(
    scope,
    scopeUnsupported
  );
  const scenarioScoresQuery = useExplorerMapScores(
    scenarioScopeSupported ? confirmedRelease : null
  );
  const scenarioImpact = useMemo(
    () =>
      resolveExplorerWhatIfImpact({
        collectionSettings: scenarioScoresQuery.data?.settings,
        counties: scenarioScoresQuery.data?.counties,
        countyFips: reviewCounty,
        scopeCode: scope,
        scoresStatus: scenarioScoresQuery.isSuccess
          ? "ready"
          : scenarioScoresQuery.isError
            ? "error"
            : "loading",
        settings: scenarioSettings,
      }),
    [
      reviewCounty,
      scenarioScoresQuery.data?.counties,
      scenarioScoresQuery.data?.settings,
      scenarioScoresQuery.isError,
      scenarioScoresQuery.isSuccess,
      scenarioSettings,
      scope,
    ]
  );

  const releaseStates = useMemo(
    () =>
      presentationQuery.metadata
        ? atlasStateOptionsFromMetadata(presentationQuery.metadata.states)
        : [],
    [presentationQuery.metadata]
  );
  const stateOptions = useMemo(
    () =>
      releaseStates.filter((option) => !isUnsupportedReviewScope(option.code)),
    [releaseStates]
  );

  const setScope = useCallback(
    (nextScope: "ALL" | string) => {
      // Bare Review already parses as ALL. Choosing United States during
      // startup is still an explicit national choice and must be written.
      const historyHasScope = hasExplicitReviewScopeParam(
        new URLSearchParams(window.location.search)
      );
      const confirmNationalChoice =
        nextScope === "ALL" &&
        scope === "ALL" &&
        !(userChoseScopeRef.current || arrivalExplicitScope || historyHasScope);
      if (nextScope === scope && !confirmNationalChoice) {
        return;
      }
      userChoseScopeRef.current = true;
      setUserChoseScope(true);
      void setUrlState({ focus: null, scope: nextScope });
    },
    [arrivalExplicitScope, scope, setUrlState]
  );
  const replaceStartingScope = useCallback(
    (nextScope: "ALL" | string) => {
      if (userChoseScopeRef.current) {
        return;
      }
      const historyHasScope = hasExplicitReviewScopeParam(
        new URLSearchParams(window.location.search)
      );
      // An omitted entry stays national in the parser. Write that fallback
      // so a later reload cannot apply a different saved state.
      if (historyHasScope && nextScope === scope) {
        return;
      }
      void setUrlState({ scope: nextScope }, { history: "replace" });
    },
    [scope, setUrlState]
  );
  const mapLayer = explorerMapLayerById(urlState.layer).id;
  const setMapLayer = useCallback(
    (layerId: ExplorerMapLayerId) => {
      void setUrlState({ layer: layerId });
    },
    [setUrlState]
  );
  const [chosenNationalFips, setChosenNationalFips] = useState<string | null>(
    null
  );
  const nationalChoiceGenerationRef = useRef(0);
  if (scope !== "ALL" && chosenNationalFips !== null) {
    setChosenNationalFips(null);
  }
  const setCounty = useCallback(
    (fips: string | null, history: "push" | "replace") => {
      const county =
        fips === null ? null : reviewCountyFipsForScope(fips, scope);
      const recordNationalChoice = scope === "ALL";
      if (recordNationalChoice) {
        nationalChoiceGenerationRef.current += 1;
        setChosenNationalFips(county);
      }
      const generation = nationalChoiceGenerationRef.current;
      const clearSelectionGuard =
        county !== null && urlState.selection === EXPLORER_SELECTION_REQUIRED;
      // nuqs pushes the next entry inside a throttled transition and passes
      // null history state. Stamp this choice only after that write, and only
      // onto the entry whose URL still shows it.
      void (async () => {
        try {
          await setUrlState(
            clearSelectionGuard ? { county, selection: null } : { county },
            { history }
          );
        } catch {
          // A failed history write leaves the entry unstamped, so Back withholds it.
          return;
        }
        if (
          !(
            recordNationalChoice &&
            nationalChoiceGenerationRef.current === generation &&
            nationalHistoryCountyMatches(county)
          )
        ) {
          return;
        }
        stampExplicitNationalCounty(county);
      })();
    },
    [scope, setUrlState, urlState.selection]
  );
  const setMapFocus = useCallback(
    (next: string | null) => {
      if (next !== null && !isLower48ReviewScope(next)) {
        return;
      }
      if ((urlState.focus ?? null) === next) {
        return;
      }
      // A state-focus click is state-only, including when Fit United States
      // left the same county selected. The next click can select it again.
      const clearCounty = Boolean(next && reviewCounty);
      if (clearCounty) {
        nationalChoiceGenerationRef.current += 1;
        setChosenNationalFips(null);
      }
      void setUrlState({
        ...(clearCounty ? { county: null } : {}),
        focus: next,
      });
    },
    [reviewCounty, setUrlState, urlState.focus]
  );
  const availableDataGate = useMemo(
    () =>
      explorerAvailableDataGate({
        availableData,
        counties: countyReference.counties,
        isError: countyReference.isError,
        isSuccess: countyReference.isSuccess,
        scope,
      }),
    [
      availableData,
      countyReference.counties,
      countyReference.isError,
      countyReference.isSuccess,
      scope,
    ]
  );
  const selectToolbarCounty = useCallback(
    (county: { fips: string; state: string }) => {
      if (scope === county.state) {
        setCountyQuery(county.fips);
        setCounty(county.fips, "push");
        return;
      }
      setPendingSelectedQuery(county.fips);
      userChoseScopeRef.current = true;
      setUserChoseScope(true);
      void setUrlState({
        county: county.fips,
        focus: null,
        scope: county.state,
        ...(urlState.selection === EXPLORER_SELECTION_REQUIRED
          ? { selection: null }
          : {}),
      });
    },
    [scope, setCounty, setUrlState, urlState.selection]
  );
  const clearToolbarCounty = useCallback(() => {
    setPendingSelectedQuery(null);
    setCountyQuery("");
    nationalChoiceGenerationRef.current += 1;
    if (scope === "ALL") {
      setChosenNationalFips(null);
    }
    void setUrlState(
      { county: null, selection: EXPLORER_SELECTION_REQUIRED },
      { history: "push" }
    );
  }, [scope, setUrlState]);
  const downloadCountyList = useCallback(() => {
    const rows = filterExplorerCountyReference(countyReference.counties, {
      evidence: availableData,
      query: countyQuery,
      scope,
    });
    downloadExplorerCountyList(
      explorerCountyListCsv(rows),
      explorerCountyListFilename(scope)
    );
  }, [availableData, countyQuery, countyReference.counties, scope]);

  // Shallow scope updates do not emit popstate. Bind the in-session scope
  // choice and the explicit national county to the history entry that is
  // current after Back/Forward. Explorer is unmounted while another workspace
  // route is showing, so the same read also runs when this screen mounts.
  useLayoutEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- hydrate the browser history marker once on mount. It is absent during SSR.
    setChosenNationalFips(explicitNationalCountyFromHistory());
  }, []);
  useEffect(() => installExplicitNationalCountyCarry(), []);
  useEffect(() => {
    const syncChoiceWithHistory = () => {
      const historyChoseScope = hasExplicitReviewScopeParam(
        new URLSearchParams(window.location.search)
      );
      userChoseScopeRef.current = historyChoseScope;
      setUserChoseScope(historyChoseScope);
      setChosenNationalFips(explicitNationalCountyFromHistory());
    };
    window.addEventListener("popstate", syncChoiceWithHistory);
    return () => {
      window.removeEventListener("popstate", syncChoiceWithHistory);
    };
  }, []);

  // Startup runs once. Once it settles, the URL has an explicit scope that
  // reproduces the screen. A county already in the arrival URL is an explicit
  // location, so Review can show it before the profile read and does not
  // replace it. A choice made while the profile read is in flight stays on
  // its own history entry. Review never writes Settings.
  const startupSettled = useApplyProfileStartingScope({
    activeScope: scope,
    profileReady:
      !userChoseScope &&
      !arrivalExplicitLocation &&
      profileQuery.isFetched &&
      (Boolean(presentationQuery.metadata) || presentationQuery.isError),
    profileStateCode: profileQuery.data?.stateCode,
    setScope: replaceStartingScope,
    stateOptions,
  });
  useLayoutEffect(() => {
    if (rewrittenScopeKey.current === rawScopeKey) {
      return;
    }
    const canonical = reviewScopeQueryCanonicalRewrite(searchParams);
    rewrittenScopeKey.current = rawScopeKey;
    if (canonical === null) {
      return;
    }
    const generation = rewriteGenerationRef.current + 1;
    rewriteGenerationRef.current = generation;
    const reviewPath = route.href;
    const onClick = (event: MouseEvent) => {
      const next = leavingReviewDestination(
        event.target,
        reviewPath,
        window.location.href,
        {
          altKey: event.altKey,
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        }
      );
      if (next) {
        pendingLeaveRef.current = next;
      }
    };
    document.addEventListener("click", onClick, true);
    const rewrite = setUrlState({ scope: canonical }, { history: "replace" });
    void settleReviewCanonicalRewrite({
      clearDestination: () => {
        pendingLeaveRef.current = null;
      },
      generation,
      isCurrentGeneration: (token) => rewriteGenerationRef.current === token,
      push: (href) => {
        router.push(href);
      },
      readDestination: () => pendingLeaveRef.current,
      removeListener: () => {
        document.removeEventListener("click", onClick, true);
      },
      reviewPath,
      rewrite,
    });
  }, [rawScopeKey, route.href, router, searchParams, setUrlState]);

  const reviewReady = Boolean(
    !scopeUnsupported &&
    scope !== "ALL" &&
    stateReview.review?.requested_state === scope
  );
  const nationalReady = scope === "ALL" && Boolean(presentationQuery.metadata);
  const stateName =
    stateOptions.find((option) => option.code === scope)?.name ?? scope;
  const publishedDirectory = usePublishedReviewCounties(
    scope,
    scopeUnsupported ? null : confirmedRelease
  );
  const startingScopePending = isReviewStartingScopeUnresolved({
    arrivalExplicitScope: arrivalExplicitLocation,
    metadataError: presentationQuery.metadataIsError,
    metadataReady: Boolean(presentationQuery.metadata),
    profileFetched: profileQuery.isFetched,
    startupSettled,
    stateOptions,
    userChoseScope,
  });
  const scopeViewReady = !startingScopePending;
  const reviewIdentities = reviewInheritedIdentities({
    chosenNationalFips,
    directoryCounties: publishedDirectory.counties,
    nationalCounties: countyReference.counties,
    nationalScope: scope === "ALL",
    ready: scopeViewReady && reviewReady,
    selectedFips: reviewCounty,
  });
  const reviewAskContext = scopeViewReady
    ? inheritedContextFromReview({
        rankedCounties: reviewIdentities,
        releaseId:
          scope === "ALL"
            ? (presentationQuery.metadata?.release_id ?? null)
            : reviewDatasetId(stateReview.review?.data_release_version),
        releaseReady: scope === "ALL" ? nationalReady : reviewReady,
        requestedCounty: reviewCounty,
      })
    : null;
  const pictureActive = Boolean(reviewReady && stateReview.review);
  const openCountyEvidence = useCallback(
    (fips: string) => {
      const county = reviewCountyFipsForScope(fips, scope);
      if (!county) {
        return;
      }
      // The state review was loaded for this release. Pin it so county
      // evidence does not request a newer current release.
      void setUrlState(
        {
          county,
          mode: EXPLORER_EVIDENCE_MODE,
          ...(confirmedRelease === null ? {} : { dataset: confirmedRelease }),
        },
        { history: "push" }
      );
    },
    [confirmedRelease, scope, setUrlState]
  );
  const backToMap = useCallback(() => {
    if (reviewCounty) {
      markReviewReturnFocus(reviewCounty);
    }
    void setUrlState({ mode: null }, { history: "push" });
  }, [reviewCounty, setUrlState]);
  useLayoutEffect(() => {
    if (!modeQuery.invalid || replacedModeKey.current === rawModeKey) {
      return;
    }
    replacedModeKey.current = rawModeKey;
    void setUrlState({ mode: null }, { history: "replace" });
  }, [modeQuery.invalid, rawModeKey, setUrlState]);
  const previousExplorerMode = useRef(explorerMode);
  useLayoutEffect(() => {
    const previous = previousExplorerMode.current;
    previousExplorerMode.current = explorerMode;
    if (previous && !explorerMode) {
      window.dispatchEvent(new Event("resize"));
    }
  }, [explorerMode]);
  const followUpSelection = explorerFollowUpSelection({
    review: stateReview.review,
    scopeCode: scope,
  });
  const followUp = explorerFollowUpState({
    candidates: followUpSelection.candidates,
    county: reviewCounty,
    metadataFailed: presentationQuery.metadataIsError,
    review: explorerReviewLoad({
      inScope: isLower48ReviewScope(scope) && !scopeUnsupported,
      reviewError: stateReview.isError,
      reviewReady: Boolean(stateReview.review),
    }),
    withheld: followUpSelection.withheld,
  });
  const methodologyLabel = stateReview.review
    ? `Method ${reviewText(stateReview.review.methodology_id)} ${reviewText(stateReview.review.methodology_version)}. Release ${reviewDatasetText(stateReview.review.data_release_version)}.`
    : null;
  const clearCounty = urlState.county !== reviewCounty;
  const clearCompare = scopeUnsupported && urlState.compare.length > 0;
  useLayoutEffect(() => {
    if (!(clearCounty || clearCompare)) {
      return;
    }
    void setUrlState(
      {
        ...(clearCompare ? { compare: null } : {}),
        ...(clearCounty ? { county: reviewCounty } : {}),
      },
      { history: "replace" }
    );
  }, [clearCompare, clearCounty, reviewCounty, setUrlState]);
  const scopeLabel = reviewScopeLabel(scope, stateOptions);
  const renderedScope = nationalReady ? "ALL" : scope;
  const metadataLoading =
    presentationQuery.isLoading && !presentationQuery.metadata;
  const tierRelease = tier1ReleaseFromMetadata({
    isError: presentationQuery.metadataIsError,
    isLoading: metadataLoading,
    releaseId: presentationQuery.metadata?.release_id,
  });

  return (
    <div className="ux-reset-explorer-page">
      {explorerMode ? null : (
        <ReviewAskAtlasPublisher context={reviewAskContext} />
      )}
      <PageIntroduction page="explorer" />

      <ExplorerCountyToolbar
        availableData={availableData}
        counties={countyReference.counties}
        countyQuery={countyQuery}
        downloadDisabled={!countyReference.isSuccess}
        scope={scope}
        selectedFips={reviewCounty}
        stateOptions={stateOptions}
        onAvailableDataChange={setAvailableData}
        onClearSelection={clearToolbarCounty}
        onCountyQueryChange={setCountyQuery}
        onCountySelect={selectToolbarCounty}
        onDownload={downloadCountyList}
        onScopeChange={setScope}
      />
      {scopeViewReady ? (
        <p
          className="sr-only"
          data-request-scope={renderedScope}
          data-testid="review-scope-status"
        >
          Showing results for {scopeLabel}
        </p>
      ) : null}

      {scenarioScopeSupported && !explorerMode ? (
        <ExplorerWhatIfScenario
          impact={scenarioImpact}
          scoresRetrying={
            scenarioScoresQuery.isFetching && scenarioScoresQuery.isError
          }
          settings={scenarioSettings}
          onChange={setScenarioSettings}
          onRetryScores={() => {
            void scenarioScoresQuery.refetch();
          }}
        />
      ) : null}

      {metadataLoading || startingScopePending ? (
        <AtlasStatusMessage tone="loading">
          Loading review scope…
        </AtlasStatusMessage>
      ) : null}

      {presentationQuery.metadataIsError &&
      reviewCounty &&
      !reviewReady &&
      !scopeUnsupported ? (
        <Tier1SurveillancePriority
          fips={reviewCounty}
          headingLevel="h2"
          release={tierRelease}
        />
      ) : null}

      {scopeUnsupported ? <UnsupportedReviewScopeNotice scope={scope} /> : null}
      {scopeUnsupported || (!pictureActive && clearCounty) ? (
        <ReviewUrlContextPublisher
          clearCompare={scopeUnsupported}
          dataset={urlState.dataset}
          period={urlState.period}
        />
      ) : null}

      {scope !== "ALL" && !scopeUnsupported && stateReview.isError ? (
        <AtlasStatusMessage tone="error">
          {REVIEW_REQUEST_FAILURE_MESSAGE}
        </AtlasStatusMessage>
      ) : null}

      {explorerMode ? (
        <ExplorerCountyEvidence
          followUp={followUp}
          methodologyLabel={methodologyLabel}
          mode={explorerMode}
          onBackToMap={backToMap}
          reviewResultState={stateReview.review?.result_state ?? null}
        />
      ) : null}

      <div
        className="ux-reset-explorer-browse-slot"
        data-explorer-browse={explorerMode ? "parked" : "visible"}
        hidden={explorerMode !== null}
        inert={explorerMode !== null}
      >
        {scope !== "ALL" && !scopeUnsupported && stateReview.isLoading ? (
          <AtlasStatusMessage tone="loading">
            Loading review results…
          </AtlasStatusMessage>
        ) : null}

        {scopeViewReady && (reviewReady || nationalReady) ? (
          <section
            aria-label="Review scope results"
            className="ux-reset-review-results"
            data-rendered-scope={renderedScope}
            data-testid="review-scope-results"
          >
            {nationalReady && presentationQuery.metadata ? (
              <ReviewNationalPicture
                availableDataGate={availableDataGate}
                counties={countyReference.counties}
                countiesError={countyReference.isError}
                countiesLoading={countyReference.isLoading}
                county={focusedNationalCounty}
                countyQuery={countyQuery}
                mapLayer={mapLayer}
                period={urlState.period}
                releaseId={presentationQuery.metadata.release_id}
                scenarioSettings={scenarioSettings}
                sources={presentationQuery.metadata.sources}
                tierRelease={tierRelease}
                mapFocus={urlState.focus}
                onCountyChange={setCounty}
                onMapFocusChange={setMapFocus}
                onMapLayerChange={setMapLayer}
              />
            ) : null}
            {reviewReady && stateReview.review ? (
              <ReviewOperatingPicture
                county={reviewCounty}
                availableDataGate={availableDataGate}
                countyQuery={countyQuery}
                freezeCountySelection={explorerMode !== null}
                mapLayer={mapLayer}
                period={urlState.period}
                scenarioSettings={scenarioSettings}
                sources={presentationQuery.metadata?.sources}
                requireExplicitCountySelection={
                  urlState.selection === EXPLORER_SELECTION_REQUIRED
                }
                review={stateReview.review}
                scopeCode={scope}
                stateName={stateName}
                tierRelease={tierRelease}
                onCountyChange={setCounty}
                onMapLayerChange={setMapLayer}
                onViewCountyEvidence={openCountyEvidence}
              />
            ) : null}
          </section>
        ) : null}
      </div>
      <details className="ux-reset-explorer-release">
        <summary>Release and methodology</summary>
        <ReviewReleaseEvidence
          errorMessage={presentationQuery.metadataError}
          isError={presentationQuery.metadataIsError}
          isLoading={metadataLoading}
          metadata={presentationQuery.metadata}
        />
      </details>
    </div>
  );
}

function ReviewAskAtlasPublisher({
  context,
}: {
  context: AskAtlasInheritedContext | null;
}) {
  usePublishAskAtlasInheritedContext(context);
  return null;
}

function ReviewUrlContextPublisher({
  clearCompare,
  dataset,
  period,
}: {
  clearCompare: boolean;
  dataset: string | null;
  period: string | null;
}) {
  usePublishExploreCommittedNavigation(
    clearCompare
      ? {
          county: null,
          compare: [],
          dataset,
          period,
        }
      : {
          county: null,
          dataset,
          period,
        }
  );
  return null;
}

function UnsupportedReviewScopeNotice({ scope }: { scope: string }) {
  return (
    <AtlasStatusMessage tone="empty">
      <p data-testid="review-scope-unsupported">
        {unsupportedReviewScopeMessage(scope)}
      </p>
    </AtlasStatusMessage>
  );
}

export function ResetReviewExperience() {
  return (
    <Suspense
      fallback={
        <AtlasStatusMessage tone="loading">Loading review…</AtlasStatusMessage>
      }
    >
      <ResetReviewExperienceInner />
    </Suspense>
  );
}
