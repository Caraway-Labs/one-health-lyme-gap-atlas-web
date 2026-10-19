"use client";

import { useQuery } from "@tanstack/react-query";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { CountyActionPlan } from "@/components/county-action-plan";
import { Card } from "@/components/ui/card";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { EXPLORER_MAP_FOLLOW_UP_ID } from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import type { GovernedReviewResultState } from "@/lib/follow-up-workflows";

const ABSENT_NEXT_CHECK = "The review result did not include a next check.";

export function ExplorerMapFollowUp({
  fips,
  governedNextCheck = null,
  releaseId,
  reviewResultState = null,
  whatIfActive = false,
}: {
  fips: string | null;
  governedNextCheck?: string | null;
  releaseId: string | null;
  reviewResultState?: GovernedReviewResultState | null;
  whatIfActive?: boolean;
}) {
  const countyFips = fips?.trim() ?? "";
  const query = useQuery({
    enabled: Boolean(releaseId && countyFips),
    queryFn: ({ signal }) =>
      loadInvestigateCountyRecord({
        fips: countyFips,
        releaseId: releaseId ?? "",
        signal,
      }),
    queryKey: ["ux-reset-review-published-county", releaseId, countyFips],
    retry: false,
  });
  const nextCheck =
    governedNextCheck && governedNextCheck !== ABSENT_NEXT_CHECK
      ? governedNextCheck
      : null;

  return (
    <Card
      aria-labelledby={`${EXPLORER_MAP_FOLLOW_UP_ID}-heading`}
      className="ux-reset-explorer-map-follow-up gap-0 p-4"
      data-testid="explorer-map-follow-up"
      id={EXPLORER_MAP_FOLLOW_UP_ID}
      tabIndex={-1}
    >
      <h2 className="eyebrow" id={`${EXPLORER_MAP_FOLLOW_UP_ID}-heading`}>
        Suggested follow-up
      </h2>
      {countyFips.length === 0 ? (
        <p className="type-body">
          Choose a county on the map or in the list before reading suggested
          follow-up. Atlas will not pick one.
        </p>
      ) : null}
      {countyFips && !releaseId ? (
        <AtlasStatusMessage tone="empty">
          Suggested follow-up waits until the governed release for this map is
          known.
        </AtlasStatusMessage>
      ) : null}
      {countyFips && releaseId && query.isPending ? (
        <AtlasStatusMessage tone="loading">
          Loading suggested follow-up for this county…
        </AtlasStatusMessage>
      ) : null}
      {countyFips && releaseId && query.isError ? (
        <AtlasStatusMessage tone="error">
          Suggested follow-up is not shown because the county record could not
          be loaded. That is a request failure, not a decision that no follow-up
          exists.
        </AtlasStatusMessage>
      ) : null}
      {countyFips && releaseId && query.isSuccess && !query.data ? (
        <AtlasStatusMessage tone="empty">
          No published county record is available, so suggested follow-up is not
          assigned.
        </AtlasStatusMessage>
      ) : null}
      {query.data ? (
        <CountyActionPlan
          detail={query.data}
          headingLevel="h3"
          idPrefix="map-"
          reviewContext={{
            governedNextCheck: nextCheck,
            reviewResultState,
          }}
          showEyebrow={false}
          whatIfActive={whatIfActive}
        />
      ) : null}
    </Card>
  );
}
