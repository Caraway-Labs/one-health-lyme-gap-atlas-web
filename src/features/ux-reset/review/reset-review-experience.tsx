"use client";

import { useQueryStates } from "nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetRouteById } from "@/features/ux-reset/paths";
import { ReviewNationalOrientation } from "@/features/ux-reset/review/review-national-orientation";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import { REVIEW_REQUEST_FAILURE_MESSAGE } from "@/features/ux-reset/review/review-operating-state";
import { ReviewReleaseEvidence } from "@/features/ux-reset/review/review-release-evidence";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { useReviewPresentation } from "@/features/ux-reset/review/use-review-presentation";
import { useStateReview } from "@/features/ux-reset/review/use-state-review";
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

  const presentationQuery = useReviewPresentation(
    scope,
    urlState.dataset,
    false
  );
  const stateReview = useStateReview(scope, urlState.dataset);

  const stateOptions = useMemo(
    () =>
      presentationQuery.metadata
        ? atlasStateOptionsFromMetadata(presentationQuery.metadata.states)
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
    (fips: string, history: "push" | "replace") => {
      void setUrlState({ county: fips }, { history });
    },
    [setUrlState]
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
    scope !== "ALL" && stateReview.review?.requested_state === scope
  );
  const nationalReady = scope === "ALL" && Boolean(presentationQuery.metadata);
  const stateName =
    stateOptions.find((option) => option.code === scope)?.name ?? scope;
  const reviewIdentities =
    reviewReady && stateReview.review
      ? stateReview.review.review_candidates.map((candidate) => ({
          county: candidate.county_name,
          fips: candidate.county_fips,
          state_name: stateName,
        }))
      : [];
  usePublishAskAtlasInheritedContext(
    inheritedContextFromReview({
      rankedCounties: reviewIdentities,
      releaseId:
        scope === "ALL"
          ? (presentationQuery.metadata?.release_id ?? null)
          : (stateReview.review?.data_release_version ?? null),
      releaseReady: scope === "ALL" ? nationalReady : reviewReady,
      requestedCounty: urlState.county,
    })
  );
  const scopeLabel = reviewScopeLabel(scope, stateOptions);
  const renderedScope = nationalReady ? "ALL" : scope;
  const metadataLoading =
    presentationQuery.isLoading && !presentationQuery.metadata;

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

      {scope !== "ALL" && stateReview.isError ? (
        <AtlasStatusMessage tone="error">
          {REVIEW_REQUEST_FAILURE_MESSAGE}
        </AtlasStatusMessage>
      ) : null}

      {scope !== "ALL" && stateReview.isLoading ? (
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
              onCountyChange={setCounty}
            />
          ) : null}
        </section>
      ) : null}
    </>
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
