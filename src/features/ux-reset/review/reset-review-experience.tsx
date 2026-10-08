"use client";

import { useQueryStates } from "nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromReview } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetRouteById } from "@/features/ux-reset/paths";
import { ReviewNationalOrientation } from "@/features/ux-reset/review/review-national-orientation";
import { ReviewReleaseEvidence } from "@/features/ux-reset/review/review-release-evidence";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { ReviewStatePanel } from "@/features/ux-reset/review/review-state-panel";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { useReviewPresentation } from "@/features/ux-reset/review/use-review-presentation";
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

  const presentationQuery = useReviewPresentation(scope, urlState.dataset);

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

  const presentationReady = Boolean(
    presentationQuery.presentation &&
    presentationQuery.requestScope === scope &&
    presentationQuery.metadata
  );
  usePublishAskAtlasInheritedContext(
    inheritedContextFromReview({
      rankedCounties:
        presentationReady && scope !== "ALL"
          ? (presentationQuery.presentation?.stateCounties ?? [])
          : [],
      releaseId: presentationQuery.metadata?.release_id ?? null,
      releaseReady: presentationReady,
      requestedCounty: urlState.county,
    })
  );
  const scopeLabel = reviewScopeLabel(scope, stateOptions);
  const renderedScope = presentationQuery.requestScope ?? scope;
  const metadataLoading =
    presentationQuery.isLoading && !presentationQuery.metadata;
  const scoresLoading =
    presentationQuery.isLoading && Boolean(presentationQuery.metadata);

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

      {presentationQuery.metadataIsError && urlState.county ? (
        <Tier1SurveillancePriority
          fips={urlState.county}
          headingLevel="h2"
          release={{ status: "unknown" }}
        />
      ) : null}

      {presentationQuery.scoresIsError ? (
        <AtlasStatusMessage tone="error">
          Review data is temporarily unavailable. Try again later.
        </AtlasStatusMessage>
      ) : null}

      {scoresLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading county scores…
        </AtlasStatusMessage>
      ) : null}

      {presentationQuery.presentation &&
      presentationQuery.requestScope === scope ? (
        <section
          aria-label="Review scope results"
          className="ux-reset-review-results"
          data-rendered-scope={presentationQuery.presentation.scope}
          data-testid="review-scope-results"
        >
          {scope === "ALL" ? (
            <ReviewNationalOrientation
              rows={presentationQuery.presentation.orientationRows}
              onOpenState={(stateCode) => setScope(stateCode)}
            />
          ) : (
            <ReviewStatePanel
              county={urlState.county}
              mapCounties={presentationQuery.presentation.mapCounties}
              period={urlState.period}
              rankedCounties={presentationQuery.presentation.stateCounties}
              releaseId={presentationQuery.metadata!.release_id}
              scopeCode={scope}
              onCountyChange={setCounty}
            />
          )}
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
