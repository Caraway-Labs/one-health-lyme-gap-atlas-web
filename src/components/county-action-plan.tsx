import Link from "next/link";

import type { CountyDetail } from "@/generated/models";
import {
  FOLLOW_UP_QUESTIONS_INTRO,
  FOLLOW_UP_WHAT_IF_NOTE,
  FOLLOW_UP_WHAT_IF_TITLE,
} from "@/lib/follow-up-response-content";
import {
  buildCountyFollowUp,
  FOLLOW_UP_INTERPRETATION,
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

function FollowUpRow({ row }: { row: FollowUpWorkflowRow }) {
  return (
    <li data-category={row.id} data-testid={`follow-up-${row.id}`}>
      <strong>{row.label}</strong>
      <span>
        <span className="action-lead">{row.action}</span>
        {row.detail ? <span className="action-fact">{row.detail}</span> : null}
      </span>
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
  whatIfActive = false,
}: {
  detail: CountyDetail;
  headingLevel?: "h3" | "h4";
  idPrefix?: string;
  omitDisclaimers?: boolean;
  reviewContext?: FollowUpReviewContext;
  showEyebrow?: boolean;
  whatIfActive?: boolean;
}) {
  const workflow = buildCountyFollowUp(detail, reviewContext);
  const headingId = `${idPrefix}county-action-heading-${detail.fips}`;
  const questions = workflow.rows.map((row) => ({
    id: row.id,
    question: row.verifyQuestion,
  }));
  const partners = workflow.rows.map((row) => ({
    id: row.id,
    label: row.label,
    partners: row.partners,
  }));
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
      className="action-plan"
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
      {omitDisclaimers ? null : (
        <p className="action-caution" data-testid="follow-up-interpretation">
          {FOLLOW_UP_INTERPRETATION}
        </p>
      )}
      <p className="action-summary">{workflow.level.explanation}</p>
      {workflow.level.colorResponseNote ? (
        <p className="action-summary" data-testid="follow-up-color-note">
          {workflow.level.colorResponseNote}
        </p>
      ) : null}
      {workflow.level.governedNextCheck ? (
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
      <ol className="action-list">
        {workflow.rows.map((row) => (
          <FollowUpRow key={row.id} row={row} />
        ))}
      </ol>
      <details
        className="action-disclosure ux-reset-follow-up-questions"
        data-testid="follow-up-questions"
      >
        <summary>Questions before acting</summary>
        <p>{FOLLOW_UP_QUESTIONS_INTRO}</p>
        <ol>
          {workflow.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </details>
      <details className="action-resources">
        <summary>Questions, partner roles, and official resources</summary>
        <p>
          Partner roles are suggestions for local judgment.
          {omitDisclaimers ? null : " Atlas does not assign them."}
        </p>
        <p>Questions to verify locally</p>
        <ul>
          {questions.map((question) => (
            <li key={question.id}>{question.question}</li>
          ))}
        </ul>
        <p>Potential partner roles</p>
        <ul>
          {partners.map((partner) => (
            <li key={partner.id}>
              <strong>{partner.label}.</strong> {partner.partners}
            </li>
          ))}
        </ul>
        <p>Relevant official resources</p>
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
    </section>
  );
}
