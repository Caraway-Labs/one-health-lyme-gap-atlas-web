import { Zap } from "lucide-react";
import type { RefObject } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
import {
  FOLLOW_UP_RECORD_NOTE,
  type SuggestedFollowUpSelection,
} from "@/features/ux-reset/review/suggested-follow-up-content";

export type SuggestedFollowUpPanelStatus =
  | "absent"
  | "error"
  | "loading"
  | "ready"
  | "waiting";

function panelMarker(
  selection: SuggestedFollowUpSelection | null,
  status: SuggestedFollowUpPanelStatus
): string {
  if (status === "ready" && selection?.responseId) {
    return selection.responseId;
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

function ActivityList({
  selection,
}: {
  selection: SuggestedFollowUpSelection;
}) {
  return (
    <ol className="ux-reset-explorer-activities">
      {selection.activities.map((activity) => (
        <li key={activity.id} className="ux-reset-explorer-activity">
          <h3>{activity.title}</h3>
          <p className="type-body">{activity.description}</p>
          <dl className="ux-reset-explorer-activity-meta">
            <div>
              <dt className="type-small">Partners</dt>
              <dd>{activity.partners}</dd>
            </div>
            <div>
              <dt className="type-small">Purpose</dt>
              <dd>{activity.purpose}</dd>
            </div>
          </dl>
          {activity.whyThisSuggestion ? (
            <details className="ux-reset-explorer-disclosure">
              <summary>Why this suggestion</summary>
              <p className="type-body">{activity.whyThisSuggestion}</p>
            </details>
          ) : null}
          {activity.resources.length > 0 ? (
            <details className="ux-reset-explorer-disclosure">
              <summary>Official resources</summary>
              <ul>
                {activity.resources.map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {resource.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ReadyFollowUp({
  selection,
}: {
  selection: SuggestedFollowUpSelection;
}) {
  if (!selection.responseTitle) {
    return (
      <AtlasStatusMessage tone="empty">
        This county color is outside the six review-priority bands, so no
        follow-up response is assigned.
      </AtlasStatusMessage>
    );
  }
  return (
    <>
      <p className="type-body" data-testid="explorer-follow-up-response">
        {selection.responseTitle}
      </p>
      <p className="type-body">{selection.introduction}</p>
      {selection.generalFallbackNote ? (
        <p className="type-body" data-testid="explorer-follow-up-fallback">
          {selection.generalFallbackNote}
        </p>
      ) : null}
      {selection.tickLimitedNote ? (
        <p className="type-body">{selection.tickLimitedNote}</p>
      ) : null}
      {selection.singlePeriodNote ? (
        <p className="type-body">{selection.singlePeriodNote}</p>
      ) : null}
      <ActivityList selection={selection} />
      {selection.closing ? (
        <p className="type-body">{selection.closing}</p>
      ) : null}
      <p className="type-small">{selection.interpretationNote}</p>
      <p className="type-small">{FOLLOW_UP_RECORD_NOTE}</p>
    </>
  );
}

export function ExplorerSuggestedFollowUpPanel({
  countyFips,
  headingRef,
  selection,
  status,
}: {
  countyFips: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  selection: SuggestedFollowUpSelection | null;
  status: SuggestedFollowUpPanelStatus;
}) {
  return (
    <section
      aria-label="Suggested follow-up"
      className="ux-reset-explorer-follow-up"
      data-county={countyFips ?? ""}
      data-follow-up={panelMarker(selection, status)}
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
          The published county record could not be loaded, so suggested
          follow-up is not shown. That is a request failure, not a decision that
          no follow-up exists.
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
      {selection ? <ReadyFollowUp selection={selection} /> : null}
    </section>
  );
}
