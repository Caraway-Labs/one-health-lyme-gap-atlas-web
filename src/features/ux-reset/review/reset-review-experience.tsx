"use client";

import { useQueryStates } from "nuqs";
import { Suspense, useCallback, useLayoutEffect, useMemo } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { resetRouteById } from "@/features/ux-reset/paths";
import { ReviewNationalOrientation } from "@/features/ux-reset/review/review-national-orientation";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import {
  isUnsupportedReviewScope,
  REVIEW_REQUEST_FAILURE_MESSAGE,
  reviewCandidateFipsForScope,
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
  const [urlState, setUrlState] = useQueryStates(reviewSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const scope = urlState.scope;
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
      setUrlState({ scope: nextScope });
    },
    [setUrlState]
  );
  const setCounty = useCallback(
    (fips: string | null, history: "push" | "replace") => {
      const county =
        fips === null ? null : reviewCandidateFipsForScope(fips, scope);
      void setUrlState({ county }, { history });
    },
    [scope, setUrlState]
  );

  useApplyProfileStartingScope({
    activeScope: scope,
    profileReady:
      profileQuery.isFetched &&
      (Boolean(presentationQuery.metadata) || presentationQuery.isError),
    profileStateCode: profileQuery.data?.stateCode,
    setScope,
    stateOptions,
  });

  const reviewReady = Boolean(
    !scopeUnsupported &&
    scope !== "ALL" &&
    stateReview.review?.requested_state === scope
  );
  const nationalReady = scope === "ALL" && Boolean(presentationQuery.metadata);
  const stateName =
    stateOptions.find((option) => option.code === scope)?.name ?? scope;
  const reviewIdentities =
    reviewReady && stateReview.review
      ? stateReview.review.review_candidates.flatMap((candidate) => {
          const fips = reviewCandidateFipsForScope(
            candidate.county_fips,
            scope
          );
          if (!fips) {
            return [];
          }
          return [
            {
              county: candidate.county_name,
              fips,
              state_name: stateName,
            },
          ];
        })
      : [];
  usePublishAskAtlasInheritedContext(
    inheritedContextFromReview({
      rankedCounties: reviewIdentities,
      releaseId:
        scope === "ALL"
          ? (presentationQuery.metadata?.release_id ?? null)
          : (stateReview.review?.data_release_version ?? null),
      releaseReady: scope === "ALL" ? nationalReady : reviewReady,
      requestedCounty: scopeUnsupported ? null : urlState.county,
    })
  );
  useLayoutEffect(() => {
    if (
      !scopeUnsupported ||
      (urlState.county === null && urlState.compare.length === 0)
    ) {
      return;
    }
    void setUrlState({ compare: null, county: null }, { history: "replace" });
  }, [scopeUnsupported, setUrlState, urlState.compare, urlState.county]);
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
        <p className="eyebrow">UX Reset professional workspace</p>
        <h1>{route.label}</h1>
        <p className="type-body">{route.description}</p>
      </header>

      <div className="ux-reset-review-toolbar">
        <ReviewScopeSelector
          scope={scope}
          stateOptions={stateOptions}
          onScopeChange={setScope}
        />
        <p
          className="type-body ux-reset-review-scope-status"
          data-request-scope={renderedScope}
          data-testid="review-scope-status"
        >
          Showing results for <strong>{scopeLabel}</strong>
        </p>
      </div>

      <ReviewReleaseEvidence
        errorMessage={presentationQuery.metadataError}
        isError={presentationQuery.metadataIsError}
        isLoading={metadataLoading}
        metadata={presentationQuery.metadata}
      />

      {metadataLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading review scope…
        </AtlasStatusMessage>
      ) : null}

      {presentationQuery.metadataIsError &&
      urlState.county &&
      !reviewReady &&
      !scopeUnsupported ? (
        <Tier1SurveillancePriority
          fips={urlState.county}
          headingLevel="h2"
          release={tierRelease}
        />
      ) : null}

      {scopeUnsupported ? (
        <UnsupportedReviewScopeNotice
          dataset={urlState.dataset}
          period={urlState.period}
          scope={scope}
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

      {reviewReady || nationalReady ? (
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
              county={urlState.county}
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

function UnsupportedReviewScopeNotice({
  dataset,
  period,
  scope,
}: {
  dataset: string | null;
  period: string | null;
  scope: string;
}) {
  usePublishExploreCommittedNavigation({
    county: null,
    compare: [],
    dataset,
    period,
  });
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
