"use client";

import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  isSituationPerspective,
  SituationInformation,
} from "@/features/ux-reset/surveillance-intelligence/situation-information";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

export function CountySummarySurveillanceDetails({
  id,
  labelledBy,
  onRetry,
  perspective,
}: {
  id: string;
  labelledBy: string;
  onRetry: () => void;
  perspective: IntelligencePerspectiveView;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="county-summary-mark-details"
      data-perspective={perspective.id}
      data-testid="surveillance-intelligence-details"
      id={id}
    >
      {isSituationPerspective(perspective.id) ? (
        <SituationInformation
          onRetry={onRetry}
          perspective={perspective}
          showTitle
        />
      ) : (
        <LegacyPerspectiveDetails onRetry={onRetry} perspective={perspective} />
      )}
    </section>
  );
}

function LegacyPerspectiveDetails({
  onRetry,
  perspective,
}: {
  onRetry: () => void;
  perspective: IntelligencePerspectiveView;
}) {
  return (
    <>
      <p className="type-body m-0">{perspective.overview}</p>
      {perspective.fields.length > 0 ? (
        <dl className="m-0 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
          {perspective.fields
            .filter((field) => !field.label.startsWith("Class membership "))
            .map((field) => (
              <div className="contents" key={field.label}>
                <dt className="type-small text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="type-small m-0 break-words">{field.value}</dd>
              </div>
            ))}
        </dl>
      ) : null}
      {perspective.reasons.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {perspective.reasons.map((reason) => (
            <li className="type-small break-words" key={reason.code}>
              {reason.text}
            </li>
          ))}
        </ul>
      ) : null}
      {perspective.memberships.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {perspective.memberships.map((membership) => (
            <li key={`${membership.classId}-${membership.text}`}>
              <p className="type-small m-0 break-words">
                {membership.selected ? "Selected class" : "Class"}{" "}
                {membership.classId}: {membership.text}
              </p>
              {membership.percent === null ? null : (
                <Progress
                  aria-label={`Class membership for ${membership.classId}, ${membership.text}. Not disease risk.`}
                  value={membership.percent}
                >
                  <ProgressLabel className="sr-only">
                    {`Class membership for ${membership.classId}, ${membership.text}. Not disease risk.`}
                  </ProgressLabel>
                </Progress>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {perspective.retryable ? (
        <Button
          className="min-h-11 w-fit"
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {`Retry ${perspective.label}`}
        </Button>
      ) : null}
      {perspective.description ? (
        <details>
          <summary className="type-small min-h-11 cursor-pointer">
            About this class
          </summary>
          <p className="type-small m-0 break-words">
            {perspective.description}
          </p>
        </details>
      ) : null}
      {perspective.disclosure.length > 0 ||
      perspective.limitations.length > 0 ? (
        <details data-testid="surveillance-intelligence-disclosure">
          <summary className="type-small min-h-11 cursor-pointer">
            Methodology & source
          </summary>
          {perspective.disclosure.length > 0 ? (
            <dl className="m-0 grid gap-2">
              {perspective.disclosure.map((field) => (
                <div key={field.label}>
                  <dt className="type-small">{field.label}</dt>
                  <dd className="type-small m-0 break-words">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {perspective.limitations.length > 0 ? (
            <ul className="m-0 pl-5">
              {perspective.limitations.map((limitation) => (
                <li className="type-small" key={limitation}>
                  {limitation}
                </li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
