"use client";

import { Button } from "@/components/ui/button";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

export function SurveillanceIntelligenceDetails({
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
      className="bg-card text-card-foreground ring-foreground/10 mt-3 flex flex-col gap-3 rounded-xl p-4 ring-1"
      data-fips-bound="true"
      data-perspective={perspective.id}
      data-testid="surveillance-intelligence-details"
      id={id}
    >
      <h3 className="type-card m-0">{`${perspective.label} details`}</h3>
      <p className="type-body m-0">{perspective.overview}</p>
      {perspective.qualifier ? (
        <p className="type-small m-0">{perspective.qualifier}</p>
      ) : null}
      {perspective.description ? (
        <p className="type-body m-0">{perspective.description}</p>
      ) : null}
      {perspective.fields.length > 0 ? (
        <dl className="m-0 grid gap-2">
          {perspective.fields.map((field) => (
            <div key={field.label}>
              <dt className="type-small">{field.label}</dt>
              <dd className="type-body m-0 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {perspective.reasons.length > 0 ? (
        <div>
          <h4 className="type-small m-0">Returned reasons</h4>
          <ul className="m-0 pl-5">
            {perspective.reasons.map((reason) => (
              <li key={reason.code}>{reason.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {perspective.limitations.length > 0 ? (
        <div>
          <h4 className="type-small m-0">Must not be read as</h4>
          <ul className="m-0 pl-5">
            {perspective.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
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
      {perspective.disclosure.length > 0 ? (
        <details data-testid="surveillance-intelligence-disclosure">
          <summary className="type-small min-h-11 cursor-pointer">
            Methodology and source
          </summary>
          <dl className="m-0 grid gap-2">
            {perspective.disclosure.map((field) => (
              <div key={field.label}>
                <dt className="type-small">{field.label}</dt>
                <dd className="type-small m-0 break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
