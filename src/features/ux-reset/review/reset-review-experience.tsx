"use client";

import { useQueryStates } from "nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { AtlasEvidenceSnapshot } from "@/components/atlas-evidence-snapshot";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { ReviewNationalOrientation } from "@/features/ux-reset/review/review-national-orientation";
import { ReviewScopeSelector } from "@/features/ux-reset/review/review-scope-selector";
import { ReviewStatePanel } from "@/features/ux-reset/review/review-state-panel";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { useProfileDefaultJurisdiction } from "@/features/ux-reset/review/use-profile-default-jurisdiction";
import { useReviewPresentation } from "@/features/ux-reset/review/use-review-presentation";
import { resetRouteById } from "@/features/ux-reset/paths";
import {
  atlasStateOptionsFromMetadata,
  reviewScopeLabel,
} from "@/lib/atlas-state-geography";
import { synchronizeGovernedDataset } from "@/lib/atlas-search-params";
import { useEffect } from "react";

function ResetReviewExperienceInner() {
  const route = resetRouteById("review");
  const [urlState, setUrlState] = useQueryStates(reviewSearchParams, {
    history: "push",
    scroll: false,
    shallow: true,
  });
  const scope = urlState.scope;
  const profileQuery = useProfileDefaultJurisdiction();

  const presentationQuery = useReviewPresentation(scope);

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

  useApplyProfileStartingScope({
    activeScope: scope,
    profileReady:
      profileQuery.isFetched &&
      (Boolean(presentationQuery.metadata) || presentationQuery.isError),
    profileStateCode: profileQuery.data?.stateCode,
    setScope,
    stateOptions,
  });

  useEffect(() => {
    if (presentationQuery.metadata?.release_id) {
      synchronizeGovernedDataset(presentationQuery.metadata.release_id);
    }
  }, [presentationQuery.metadata?.release_id]);

  const scopeLabel = reviewScopeLabel(scope, stateOptions);
  const renderedScope = presentationQuery.requestScope ?? scope;

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

      {presentationQuery.metadata ? (
        <AtlasEvidenceSnapshot metadata={presentationQuery.metadata} />
      ) : null}

      {presentationQuery.isLoading ? (
        <AtlasStatusMessage tone="loading">Loading review scope…</AtlasStatusMessage>
      ) : null}

      {presentationQuery.isError ? (
        <AtlasStatusMessage tone="error">
          Review data is temporarily unavailable. Try again later.
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
              mapCounties={presentationQuery.presentation.mapCounties}
              rankedCounties={presentationQuery.presentation.stateCounties}
              releaseId={presentationQuery.metadata!.release_id}
              scopeCode={scope}
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
