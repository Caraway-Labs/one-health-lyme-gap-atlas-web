import {
  Building2,
  Bug,
  ClipboardList,
  FlaskConical,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PROGRAM_RESOURCES } from "@/components/county-action-plan";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CountyDetail } from "@/generated/models";
import {
  FOLLOW_UP_QUESTIONS_INTRO,
  FOLLOW_UP_WHAT_IF_NOTE,
  FOLLOW_UP_WHAT_IF_TITLE,
} from "@/lib/follow-up-response-content";
import {
  buildCountyFollowUp,
  FOLLOW_UP_INTERPRETATION,
  type FollowUpCategoryId,
  type FollowUpReviewContext,
} from "@/lib/follow-up-workflows";

const DOMAIN_ICONS = {
  "clinical-laboratory-reporting": FlaskConical,
  "community-context-outreach": Building2,
  "coordination-documentation": ClipboardList,
  "human-disease-surveillance": Users,
  "vector-pathogen-surveillance": Bug,
} as const satisfies Record<FollowUpCategoryId, LucideIcon>;

function domainIcon(id: FollowUpCategoryId): LucideIcon {
  return DOMAIN_ICONS[id];
}

/**
 * Suggested follow-up as a checklist (UX audit B3). Same governed content as
 * `CountyActionPlan`; the default view shows one action line per domain and
 * every explanation, question, partner role, and resource stays reachable in
 * place behind an accordion. Nothing is removed or reworded.
 */
export function CountyActionChecklist({
  detail,
  headingLevel = "h3",
  idPrefix = "",
  omitDisclaimers = false,
  reviewContext,
  whatIfActive = false,
}: {
  detail: CountyDetail;
  headingLevel?: "h3" | "h4";
  idPrefix?: string;
  omitDisclaimers?: boolean;
  reviewContext?: FollowUpReviewContext;
  whatIfActive?: boolean;
}) {
  const workflow = buildCountyFollowUp(detail, reviewContext);
  const headingId = `${idPrefix}county-action-heading-${detail.fips}`;
  const resources = workflow.rows.flatMap((row) => row.resources);
  const uniqueResources = resources.filter(
    (resource, index) =>
      resources.findIndex((entry) => entry.id === resource.id) === index
  );
  const Heading = headingLevel;

  return (
    <section
      aria-labelledby={headingId}
      className="action-plan action-checklist"
      data-review-level={workflow.level.status}
      data-testid="suggested-follow-up"
      data-unavailable-reason={workflow.level.reason ?? ""}
    >
      <div className="action-checklist-heading">
        <ListChecks aria-hidden="true" />
        <Heading data-testid="explorer-follow-up-response" id={headingId}>
          {workflow.level.title}
        </Heading>
      </div>
      <Accordion className="action-checklist-about" multiple>
        <AccordionItem value="about">
          <AccordionTrigger>About this follow-up</AccordionTrigger>
          <AccordionContent keepMounted>
            {omitDisclaimers ? null : (
              <p
                className="action-caution"
                data-testid="follow-up-interpretation"
              >
                {FOLLOW_UP_INTERPRETATION}
              </p>
            )}
            <p className="action-summary">{workflow.level.explanation}</p>
            {workflow.level.colorResponseNote ? (
              <p className="action-summary" data-testid="follow-up-color-note">
                {workflow.level.colorResponseNote}
              </p>
            ) : null}
            {workflow.verificationNote && !omitDisclaimers ? (
              <p
                className="action-summary"
                data-testid="follow-up-verification-note"
              >
                {workflow.verificationNote}
              </p>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {workflow.level.governedNextCheck ? (
        <p className="action-summary" data-testid="follow-up-next-check">
          Returned next check: {workflow.level.governedNextCheck}
        </p>
      ) : null}
      {whatIfActive ? (
        <p className="action-summary" data-testid="follow-up-what-if-note">
          <strong>{FOLLOW_UP_WHAT_IF_TITLE}</strong> {FOLLOW_UP_WHAT_IF_NOTE}
        </p>
      ) : null}
      {workflow.rows.length > 0 ? (
        <div className="action-checklist-rows">
          {workflow.rows.map((row) => {
            const Icon = domainIcon(row.id);
            const summary = (
              <>
                <Icon aria-hidden="true" className="action-checklist-icon" />
                <span className="action-checklist-copy">
                  <strong>{row.label}</strong>
                  <span className="action-lead">{row.action}</span>
                </span>
              </>
            );
            if (!row.detail) {
              return (
                <div
                  className="action-checklist-row"
                  data-category={row.id}
                  data-testid={`follow-up-${row.id}`}
                  key={row.id}
                >
                  {summary}
                </div>
              );
            }
            return (
              <Accordion
                className="action-checklist-row"
                data-category={row.id}
                data-testid={`follow-up-${row.id}`}
                key={row.id}
              >
                <AccordionItem value={row.id}>
                  <AccordionTrigger className="action-checklist-trigger">
                    {summary}
                  </AccordionTrigger>
                  <AccordionContent keepMounted>
                    <span className="action-fact">{row.detail}</span>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>
      ) : null}
      <Accordion className="action-checklist-more" multiple>
        <AccordionItem data-testid="follow-up-questions" value="questions">
          <AccordionTrigger>Questions before acting</AccordionTrigger>
          <AccordionContent keepMounted>
            <p>{FOLLOW_UP_QUESTIONS_INTRO}</p>
            <ol>
              {workflow.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="resources">
          <AccordionTrigger>
            Questions, partner roles, and official resources
          </AccordionTrigger>
          <AccordionContent keepMounted>
            <p>
              Partner roles are suggestions for local judgment.
              {omitDisclaimers ? null : " Atlas does not assign them."}
            </p>
            <p>Questions to verify locally</p>
            <ul>
              {workflow.rows.map((row) => (
                <li key={row.id}>{row.verifyQuestion}</li>
              ))}
            </ul>
            <p>Potential partner roles</p>
            <ul>
              {workflow.rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.label}.</strong> {row.partners}
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
