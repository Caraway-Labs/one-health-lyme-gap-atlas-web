import { Card } from "@/components/ui/card";
import type { ContentSurface } from "@/lib/atlas-analytics";
import { cn } from "@/lib/utils";

import { EvidenceProvenanceInspect } from "./evidence-provenance-inspect";
import { EvidenceStateStrip } from "./evidence-state-strip";
import type { EvidenceObjectModel } from "./types";
import { evidenceAvailabilityLabel } from "./value-state-contract";

import "./evidence-contract.css";

type ClaimHeadingLevel = "h3" | "h4" | "h5";

type EvidenceObjectProps = {
  className?: string;
  claimHeadingLevel?: ClaimHeadingLevel;
  contentSurface?: ContentSurface;
  model: EvidenceObjectModel;
  showReason?: boolean;
};

/**
 * Shared evidence row for Reset Review, Explore, Investigate, and Compare.
 * Keeps availability, value, provenance cues, and inspect action consistent.
 */
export function EvidenceObject({
  className,
  claimHeadingLevel = "h3",
  contentSurface = "source_card",
  model,
  showReason = false,
}: EvidenceObjectProps) {
  const ClaimHeading = claimHeadingLevel;
  return (
    <Card
      className={cn("ux-reset-evidence-object", className)}
      data-evidence-availability={model.availability}
      data-testid="ux-reset-evidence-object"
    >
      <div className="ux-reset-evidence-object-heading">
        <ClaimHeading className="type-card">{model.claimLabel}</ClaimHeading>
        <p
          className="ux-reset-evidence-value type-metric"
          data-testid="evidence-display-value"
        >
          {model.displayValue}
        </p>
        {model.valueNote ? (
          <p className="type-small">{model.valueNote}</p>
        ) : null}
      </div>
      <EvidenceStateStrip model={model} showReason={showReason} />
      {model.reasonCode ? (
        <EvidenceProvenanceInspect
          availability={model.availability}
          contentSurface={contentSurface}
          provenance={model.provenance}
          reasonCode={model.reasonCode}
        />
      ) : (
        <EvidenceProvenanceInspect
          contentSurface={contentSurface}
          provenance={model.provenance}
          stateLabel={evidenceAvailabilityLabel(model.availability)}
        />
      )}
    </Card>
  );
}
