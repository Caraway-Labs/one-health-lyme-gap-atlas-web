import { Zap } from "lucide-react";
import type { RefObject } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { CountyActionPlan } from "@/components/county-action-plan";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
import type { SuggestedFollowUpSelection } from "@/features/ux-reset/review/suggested-follow-up-content";
import type { CountyDetail } from "@/generated/models";
import {
  buildCountyFollowUp,
  type FollowUpReviewContext,
} from "@/lib/follow-up-workflows";

export type SuggestedFollowUpPanelStatus =
  | "absent"
  | "error"
  | "loading"
  | "ready"
  | "waiting";

function panelMarker(
  detail: CountyDetail | null,
  reviewContext: FollowUpReviewContext | undefined,
  status: SuggestedFollowUpPanelStatus
): string {
  if (status === "ready" && detail) {
    return buildCountyFollowUp(detail, reviewContext).level.title;
  }
  return status;
}

export function ExplorerReviewPriority({
  selection,
}: {
  selection: SuggestedFollowUpSelection;
}) {
  return (
    <p
      className="ux-reset-explorer-follow-up-priority"
      data-category-conflict={selection.categoryConflict ? "true" : "false"}
      data-testid="explorer-review-priority"
    >
      {selection.bandToken ? (
        <span
          aria-hidden="true"
          className="ux-reset-explorer-priority-swatch"
          data-band={selection.bandId}
          style={{ backgroundColor: `var(${selection.bandToken})` }}
        />
      ) : null}
      <span>Review priority: {selection.authoritativeReviewCategory}</span>
    </p>
  );
}

export function ExplorerSuggestedFollowUpPanel({
  countyFips,
  detail,
  headingRef,
  reviewContext,
  status,
}: {
  countyFips: string | null;
  detail: CountyDetail | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  reviewContext?: FollowUpReviewContext;
  status: SuggestedFollowUpPanelStatus;
}) {
  const workflowReady = status === "ready" && detail !== null;
  return (
    <section
      aria-label="Suggested follow-up"
      className="ux-reset-explorer-follow-up"
      data-county={countyFips ?? ""}
      data-follow-up={panelMarker(detail, reviewContext, status)}
      data-testid="explorer-follow-up"
      id={EXPLORER_SECTION_IDS.followUp}
    >
      <h2 ref={headingRef} tabIndex={-1}>
        <Zap aria-hidden="true" /> Suggested follow-up
      </h2>
      {status === "loading" ? (
        <AtlasStatusMessage tone="loading">
          Loading suggested follow-up for this county…
        </AtlasStatusMessage>
      ) : null}
      {status === "error" ? (
        <AtlasStatusMessage tone="error">
          Suggested follow-up is not shown because a required request failed.
          That is not a decision that no follow-up exists.
        </AtlasStatusMessage>
      ) : null}
      {status === "waiting" ? (
        <AtlasStatusMessage tone="empty">
          Choose a county before reading suggested follow-up. Atlas will not
          pick one.
        </AtlasStatusMessage>
      ) : null}
      {status === "absent" ? (
        <AtlasStatusMessage tone="empty">
          No published county record is available, so suggested follow-up is not
          assigned.
        </AtlasStatusMessage>
      ) : null}
      {workflowReady ? (
        <CountyActionPlan
          detail={detail}
          headingLevel="h3"
          idPrefix="evidence-"
          omitDisclaimers
          reviewContext={reviewContext}
          showEyebrow={false}
          variant="explorer"
        />
      ) : null}
    </section>
  );
}
