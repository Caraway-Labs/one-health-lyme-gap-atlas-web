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
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { resetRouteById } from "@/features/ux-reset/paths";
import {
  hasExplicitReviewScopeParam,
  isReviewStartingScopeUnresolved,
  reviewScopeQueryCanonicalRewrite,
} from "@/features/ux-reset/review/resolve-review-scope";
import {
  leavingReviewDestination,
  settleReviewCanonicalRewrite,
} from "@/features/ux-reset/review/review-canonical-navigation";
import { reviewDatasetId } from "@/features/ux-reset/review/review-governed-values";
import { ReviewNationalOrientation } from "@/features/ux-reset/review/review-national-orientation";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  isGovernedReviewResultState,
  isUnsupportedReviewScope,
  normalizeReviewCounty,
  REVIEW_REQUEST_FAILURE_MESSAGE,
  reviewCandidateFipsForScope,
  reviewResultPayloadConsistent,
  scopedReviewCandidates,
  unsupportedReviewScopeMessage,
} from "@/features/ux-reset/review/review-operating-state";
import { ReviewReleaseEvidence } from "@/features/ux-reset/review/review-release-evidence";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { useReviewPresentation } from "@/features/ux-reset/review/use-review-presentation";
import { useStateReview } from "@/features/ux-reset/review/use-state-review";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
} from "@/lib/atlas-state-geography";

function ResetReviewExperienceInner() {
  const route = resetRouteById("review");
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
  const userChoseScopeRef = useRef(false);
  const [userChoseScope, setUserChoseScope] = useState(false);
  const rewrittenScopeKey = useRef<string | null>(null);
  const pendingLeaveRef = useRef<string | null>(null);
  const rewriteGenerationRef = useRef(0);
  const rawScopeKey = searchParams.getAll("scope").join("\u0000");
  const reviewCounty = normalizeReviewCounty(scope, urlState.county);
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

  const stateOptions = useMemo(
    () =>
      presentationQuery.metadata
        ? atlasStateOptionsFromMetadata(
            presentationQuery.metadata.states
          ).filter((option) => !isUnsupportedReviewScope(option.code))
        : [],
    [presentationQuery.metadata]
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
      void setUrlState({ scope: nextScope });
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
  const setCounty = useCallback(
    (fips: string | null, history: "push" | "replace") => {
      const county =
        fips === null ? null : reviewCandidateFipsForScope(fips, scope);
      void setUrlState({ county }, { history });
    },
    [scope, setUrlState]
  );

  // Shallow scope updates do not emit popstate. Bind the in-session choice to
  // the history entry that is current after Back/Forward, and only then.
  useEffect(() => {
    const syncChoiceWithHistory = () => {
      const historyChoseScope = hasExplicitReviewScopeParam(
        new URLSearchParams(window.location.search)
      );
      userChoseScopeRef.current = historyChoseScope;
      setUserChoseScope(historyChoseScope);
    };
    window.addEventListener("popstate", syncChoiceWithHistory);
    return () => {
      window.removeEventListener("popstate", syncChoiceWithHistory);
    };
  }, []);

  // Startup runs once. Once it settles, the URL has an explicit scope that
  // reproduces the screen. A choice made while the profile read is in flight
  // stays on its own history entry. Review never writes Settings.
  const startupSettled = useApplyProfileStartingScope({
    activeScope: scope,
    profileReady:
      !userChoseScope &&
      !arrivalExplicitScope &&
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
  const reviewRecord = stateReview.review;
  const candidatesAreFindings = Boolean(
    reviewRecord &&
    isGovernedReviewResultState(reviewRecord.result_state) &&
    reviewResultPayloadConsistent(reviewRecord) &&
    reviewRecord.result_state === "candidates_found"
  );
  const startingScopePending = isReviewStartingScopeUnresolved({
    arrivalExplicitScope,
    metadataError: presentationQuery.metadataIsError,
    metadataReady: Boolean(presentationQuery.metadata),
    profileFetched: profileQuery.isFetched,
    startupSettled,
    stateOptions,
    userChoseScope,
  });
  const scopeViewReady = !startingScopePending;
  const reviewIdentities =
    scopeViewReady && reviewReady && reviewRecord && candidatesAreFindings
      ? scopedReviewCandidates(
          reviewRecord.review_candidates,
          scope
        ).candidates.map((candidate) => ({
          county: candidate.countyName,
          fips: candidate.countyFips,
          state_name: stateName,
        }))
      : [];
  usePublishAskAtlasInheritedContext(
    scopeViewReady
      ? inheritedContextFromReview({
          rankedCounties: reviewIdentities,
          releaseId:
            scope === "ALL"
              ? (presentationQuery.metadata?.release_id ?? null)
              : reviewDatasetId(stateReview.review?.data_release_version),
          releaseReady: scope === "ALL" ? nationalReady : reviewReady,
          requestedCounty: reviewCounty,
        })
      : null
  );
  const pictureActive = Boolean(reviewReady && stateReview.review);
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
    <>
      <header className="ux-reset-page-header">
        <h1>{route.label}</h1>
        <p className="type-body">{route.description}</p>
      </header>

      <div className="ux-reset-review-toolbar">
        <ReviewScopeSelector
          scope={scope}
          stateOptions={stateOptions}
          onScopeChange={setScope}
        />
        {scopeViewReady ? (
          <p
            className="type-body ux-reset-review-scope-status"
            data-request-scope={renderedScope}
            data-testid="review-scope-status"
          >
            Showing results for <strong>{scopeLabel}</strong>
          </p>
        ) : null}
      </div>

      <ReviewReleaseEvidence
        errorMessage={presentationQuery.metadataError}
        isError={presentationQuery.metadataIsError}
        isLoading={metadataLoading}
        metadata={presentationQuery.metadata}
      />

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
          {nationalReady ? (
            <ReviewNationalOrientation
              states={stateOptions}
              onOpenState={(stateCode) => setScope(stateCode)}
            />
          ) : null}
          {reviewReady && stateReview.review ? (
            <ReviewOperatingPicture
              county={reviewCounty}
              period={urlState.period}
              review={stateReview.review}
              scopeCode={scope}
              stateName={stateName}
              tierRelease={tierRelease}
              onCountyChange={setCounty}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );
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
