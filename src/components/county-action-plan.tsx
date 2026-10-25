import Link from "next/link";

import type { CountyDetail } from "@/generated/models";
import {
  FOLLOW_UP_WHAT_IF_NOTE,
  FOLLOW_UP_WHAT_IF_TITLE,
} from "@/lib/follow-up-response-content";
import {
  buildCountyFollowUp,
  FOLLOW_UP_INTERPRETATION,
  FOLLOW_UP_UNAVAILABLE_INTERPRETATION,
  type FollowUpReviewContext,
  type FollowUpWorkflowRow,
} from "@/lib/follow-up-workflows";
import { resourcesPageHref } from "@/lib/resources/catalog";

export const PROGRAM_RESOURCES = [
  {
    href: "https://www.dhs.wisconsin.gov/tick/lyme-reporting-surveillance.htm",
    label: "Wisconsin: reporting and investigation protocol",
  },
  {
    href: "https://www.health.state.mn.us/diseases/tickborne/monitoring.html",
    label: "Minnesota: tick monitoring program",
  },
  {
    href: "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/LymeDisease.aspx",
    label: "California: surveillance and outreach resources",
  },
  {
    href: "https://www.health.ny.gov/diseases/communicable/lyme/",
    label: "New York: tick collection and surveillance",
  },
];

function FollowUpRow({
  index,
  row,
}: {
  index: number;
  row: FollowUpWorkflowRow;
}) {
  return (
    <li data-category={row.id} data-testid={`follow-up-${row.id}`}>
      <span aria-hidden="true" className="action-index">
        {index}
      </span>
      <div className="action-copy">
        <strong>{row.label}</strong>
        <p>
          {row.action}
          {row.detail ? ` ${row.detail}` : null}
        </p>
        <p className="action-partners">
          <span>Potential partners: </span>
          {row.partners}
        </p>
      </div>
    </li>
  );
}

export function CountyActionPlan({
  detail,
  headingLevel = "h4",
  idPrefix = "",
  reviewContext,
  omitDisclaimers = false,
  showEyebrow = true,
  variant = "document",
  whatIfActive = false,
}: {
  detail: CountyDetail;
  headingLevel?: "h3" | "h4";
  idPrefix?: string;
  omitDisclaimers?: boolean;
  reviewContext?: FollowUpReviewContext;
  showEyebrow?: boolean;
  /** Explorer keeps official resources in the adjacent card. */
  variant?: "document" | "explorer";
  whatIfActive?: boolean;
}) {
  const workflow = buildCountyFollowUp(detail, reviewContext);
  const headingId = `${idPrefix}county-action-heading-${detail.fips}`;
  const questionsHeadingId = `${idPrefix}follow-up-questions-${detail.fips}`;
  const QuestionsHeading = headingLevel === "h3" ? "h4" : "h5";
  const explorer = variant === "explorer";
  const interpretation =
    workflow.level.status === "assigned"
      ? FOLLOW_UP_INTERPRETATION
      : FOLLOW_UP_UNAVAILABLE_INTERPRETATION;
  const resources = workflow.rows.flatMap((row) =>
    row.resources.map((resource) => resource)
  );
  const uniqueResources = resources.filter(
    (resource, index) =>
      resources.findIndex((entry) => entry.id === resource.id) === index
  );

  return (
    <section
      aria-labelledby={headingId}
      className={explorer ? "action-plan action-plan-explorer" : "action-plan"}
      data-review-level={workflow.level.status}
      data-testid="suggested-follow-up"
      data-unavailable-reason={workflow.level.reason ?? ""}
    >
      <div className="action-plan-heading">
        <div>
          {showEyebrow ? (
            <span className="eyebrow">Suggested follow-up</span>
          ) : null}
          {headingLevel === "h3" ? (
            <h3 data-testid="explorer-follow-up-response" id={headingId}>
              {workflow.level.title}
            </h3>
          ) : (
            <h4 data-testid="explorer-follow-up-response" id={headingId}>
              {workflow.level.title}
            </h4>
          )}
        </div>
      </div>
      <p className="action-summary">{workflow.level.explanation}</p>
      <p className="action-note" data-testid="follow-up-interpretation">
        {interpretation}
      </p>
      {workflow.level.colorResponseNote && !omitDisclaimers && !explorer ? (
        <p className="action-summary" data-testid="follow-up-color-note">
          {workflow.level.colorResponseNote}
        </p>
      ) : null}
      {workflow.level.governedNextCheck && !explorer ? (
        <p className="action-summary" data-testid="follow-up-next-check">
          Returned next check: {workflow.level.governedNextCheck}
        </p>
      ) : null}
      {workflow.verificationNote && !omitDisclaimers ? (
        <p className="action-summary" data-testid="follow-up-verification-note">
          {workflow.verificationNote}
        </p>
      ) : null}
      {whatIfActive ? (
        <p className="action-summary" data-testid="follow-up-what-if-note">
          <strong>{FOLLOW_UP_WHAT_IF_TITLE}</strong> {FOLLOW_UP_WHAT_IF_NOTE}
        </p>
      ) : null}
      <ol
        className={explorer ? "action-list action-divider-rows" : "action-list"}
      >
        {workflow.rows.map((row, index) => (
          <FollowUpRow index={index + 1} key={row.id} row={row} />
        ))}
      </ol>
      <section
        aria-labelledby={questionsHeadingId}
        className={
          explorer
            ? "action-questions-inset"
            : "action-questions ux-reset-follow-up-questions"
        }
        data-testid="follow-up-questions"
      >
        <QuestionsHeading id={questionsHeadingId}>
          Questions before acting
        </QuestionsHeading>
        <ul>
          {workflow.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>
      {explorer ? null : (
        <details className="action-resources">
          <summary>Related official resources</summary>
          <ul>
            {uniqueResources.map((resource) => (
              <li key={resource.id}>
                <a
                  aria-label={`${resource.label} (opens in a new tab)`}
                  href={resource.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {resource.label}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p>
            These examples show approaches used by other state vector-borne
            disease programs. Follow the selected county&apos;s own state
            requirements.
          </p>
          <ul>
            {PROGRAM_RESOURCES.map((resource) => (
              <li key={resource.href}>
                <a
                  aria-label={`${resource.label} (opens in a new tab)`}
                  href={resource.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {resource.label}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p>
            <Link href={resourcesPageHref(detail.state)}>
              View all resources →
            </Link>
          </p>
        </details>
      )}
    </section>
  );
}
