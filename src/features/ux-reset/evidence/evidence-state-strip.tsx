import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { EvidenceObjectModel, ReleaseEvidenceContextModel } from "./types";
import {
  evidenceAvailabilityLabel,
  evidenceReasonLabel,
} from "./value-state-contract";

import "./evidence-contract.css";

type EvidenceStateStripProps = {
  className?: string;
  /** When set, shows the governed reason behind the availability badge. */
  model: Pick<
    EvidenceObjectModel,
    "availability" | "reasonCode" | "provenance"
  >;
  showReason?: boolean;
};

export function EvidenceStateStrip({
  className,
  model,
  showReason = false,
}: EvidenceStateStripProps) {
  const { availability, provenance, reasonCode } = model;

  return (
    <div
      className={cn("ux-reset-evidence-strip", className)}
      data-evidence-availability={availability}
    >
      <Badge className="ux-reset-evidence-availability" variant="outline">
        {evidenceAvailabilityLabel(availability)}
      </Badge>
      {showReason ? (
        <span className="ux-reset-evidence-reason type-small">
          {evidenceReasonLabel(reasonCode)}
        </span>
      ) : null}
      <dl className="ux-reset-evidence-strip-meta">
        <div>
          <dt>Source family</dt>
          <dd>{provenance.sourceFamily}</dd>
        </div>
        <div>
          <dt>Observation period</dt>
          <dd>{provenance.observationPeriod}</dd>
        </div>
        <div>
          <dt>Evidence type</dt>
          <dd>{provenance.evidenceType}</dd>
        </div>
      </dl>
      {provenance.materialCaveat ? (
        <p className="ux-reset-evidence-caveat type-small" role="note">
          {provenance.materialCaveat}
        </p>
      ) : null}
    </div>
  );
}

type ReleaseEvidenceStateStripProps = {
  className?: string;
  context: ReleaseEvidenceContextModel;
};

/** Release-level strip for Reset pages that share one governed snapshot. */
export function ReleaseEvidenceStateStrip({
  className,
  context,
}: ReleaseEvidenceStateStripProps) {
  return (
    <div className={cn("ux-reset-evidence-strip", className)}>
      <Badge className="ux-reset-evidence-availability" variant="outline">
        Available
      </Badge>
      <dl className="ux-reset-evidence-strip-meta">
        <div>
          <dt>Release</dt>
          <dd>{context.releaseSummary}</dd>
        </div>
        <div>
          <dt>Source periods</dt>
          <dd>{context.sourcePeriods}</dd>
        </div>
        <div>
          <dt>Evidence scope</dt>
          <dd>{context.evidenceScope}</dd>
        </div>
        <div>
          <dt>Methodology</dt>
          <dd>{context.methodologyLabel}</dd>
        </div>
      </dl>
      {context.limitation ? (
        <p className="ux-reset-evidence-caveat type-small" role="note">
          {context.limitation}
        </p>
      ) : null}
    </div>
  );
}
