"use client";

import { Card } from "@/components/ui/card";
import {
  decideEvidenceBrief,
  evidenceBriefLocalContextInvalid,
  evidenceBriefStamp,
  EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID,
  EVIDENCE_BRIEF_LOCAL_CONTEXT_NOTE,
} from "@/features/ux-reset/action/evidence-brief";
import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import { investigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import type { InvestigateQueryOutcome } from "@/features/ux-reset/investigate/investigate-request-state";
import {
  investigateHandoffLimitation,
  publishedRowsForCounty,
  resolveInvestigateFinding,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import type { PublishedCountyRecord } from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { InvestigateRecovery } from "@/features/ux-reset/investigate/use-investigate-workspace";
import type { Measure } from "@/generated/models";

export function ActionEvidenceBrief({
  catalogFailed,
  countyRecord,
  countyRecordError,
  countyRecordLoading,
  localContext,
  measures,
  observationOutcome,
  onLocalContextChange,
  period,
  realBundle,
  recovery,
}: {
  catalogFailed: boolean;
  countyRecord: PublishedCountyRecord | null;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  localContext: string;
  measures: readonly Measure[];
  observationOutcome: InvestigateQueryOutcome;
  onLocalContextChange: (value: string) => void;
  period: string | null;
  realBundle: CountyEvidenceBundle | null;
  recovery: InvestigateRecovery | null;
}) {
  const gate = decideEvidenceBrief({
    catalogFailed,
    observationOutcome,
    realBundle,
    recovery,
  });
  if (gate.kind === "blocked") {
    return (
      <section
        aria-label="Evidence brief"
        className="ux-reset-action-brief"
        data-state={gate.blocker}
        data-testid="action-evidence-brief"
      >
        <h2>Evidence brief</h2>
        <p data-testid="action-brief-blocker">{gate.sentence}</p>
      </section>
    );
  }

  const publishedRows = publishedRowsForCounty({
    bundle: gate.bundle,
    countyRecord,
    measures,
  });
  const finding = resolveInvestigateFinding({
    bundle: gate.bundle,
    catalogFailed: false,
    countyRecordError,
    countyRecordLoading,
    countyRecordPresent: countyRecord !== null,
    publishedRows,
  });
  const limitation = investigateHandoffLimitation({
    bundle: gate.bundle,
    catalogFailed: false,
    countyRecordError,
    countyRecordLoading,
    countyRecordPresent: countyRecord !== null,
    publishedReleaseLimitation: countyRecord?.releaseLimitation,
    publishedRows,
  });
  const pdfContext = investigatePdfContext(gate.bundle, period);
  const overLimit = evidenceBriefLocalContextInvalid(localContext);
  const describedBy = overLimit
    ? "action-brief-local-context-note action-brief-local-context-error"
    : "action-brief-local-context-note";

  return (
    <section
      aria-label="Evidence brief"
      className="ux-reset-action-brief"
      data-state="ready"
      data-testid="action-evidence-brief"
    >
      <h2>Evidence brief</h2>
      <p className="type-body">
        This brief repeats the governed county evidence already read for this
        county.
      </p>
      <Card
        className="ux-reset-action-brief-governed"
        data-governed="true"
        data-testid="action-brief-governed"
      >
        <h3>Governed evidence</h3>
        <h4>{finding.title}</h4>
        <p className="type-body" data-testid="action-brief-finding">
          {finding.text}
        </p>
        <h4>{limitation.title}</h4>
        <p className="type-body" data-testid="action-brief-limitation">
          {limitation.text}
        </p>
        <p className="type-small" data-testid="action-brief-stamp">
          {evidenceBriefStamp(pdfContext)}
        </p>
        {pdfContext.caveats.length > 0 ? (
          <ul data-testid="action-brief-caveats">
            {pdfContext.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        ) : null}
      </Card>
      <InvestigatePdfExport context={pdfContext} />
      <Card
        className="ux-reset-action-brief-local"
        data-governed="false"
        data-testid="action-brief-local"
      >
        <h3>Your local context</h3>
        <p
          className="ux-reset-action-brief-note"
          id="action-brief-local-context-note"
          data-testid="action-brief-local-note"
        >
          {EVIDENCE_BRIEF_LOCAL_CONTEXT_NOTE}
        </p>
        <label className="type-body" htmlFor="action-brief-local-context">
          Local context
          <textarea
            aria-describedby={describedBy}
            aria-invalid={overLimit ? true : undefined}
            className="ux-reset-action-local-context"
            data-testid="action-brief-local-context"
            id="action-brief-local-context"
            onChange={(event) => {
              onLocalContextChange(event.target.value);
            }}
            rows={4}
            value={localContext}
          />
        </label>
        {overLimit ? (
          <p
            data-testid="action-brief-local-error"
            id="action-brief-local-context-error"
            role="alert"
          >
            {EVIDENCE_BRIEF_LOCAL_CONTEXT_INVALID}
          </p>
        ) : null}
      </Card>
    </section>
  );
}
