import { Card } from "@/components/ui/card";
import type { ContentSurface } from "@/lib/atlas-analytics";
import { cn } from "@/lib/utils";

import { EvidenceProvenanceInspect } from "./evidence-provenance-inspect";
import { EvidenceStateStrip } from "./evidence-state-strip";
import type { EvidenceObjectModel } from "./types";

import "./evidence-contract.css";

type EvidenceObjectProps = {
  className?: string;
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
  contentSurface = "source_card",
  model,
  showReason = false,
}: EvidenceObjectProps) {
  return (
    <Card
      className={cn("ux-reset-evidence-object", className)}
      data-evidence-availability={model.availability}
    >
      <div className="ux-reset-evidence-object-heading">
        <h3 className="type-card">{model.claimLabel}</h3>
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
      <EvidenceProvenanceInspect
        contentSurface={contentSurface}
        provenance={model.provenance}
      />
    </Card>
  );
}
