"use client";

import {
  EvidenceProvenanceContent,
  EvidenceProvenanceInspect,
} from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import { trackProvenanceOpened } from "@/lib/atlas-analytics";

export const REVIEW_RATIONALE_SOURCE_DETAILS_LABEL = "Source details";

function ProvenanceSection({ model }: { model: EvidenceObjectModel }) {
  if (model.reasonCode) {
    return (
      <EvidenceProvenanceContent
        availability={model.availability}
        contentSurface="source_card"
        provenance={model.provenance}
        reasonCode={model.reasonCode}
        showLimitations={false}
      />
    );
  }
  return (
    <EvidenceProvenanceContent
      contentSurface="source_card"
      provenance={model.provenance}
      showLimitations={false}
      stateLabel={evidenceAvailabilityLabel(model.availability)}
    />
  );
}

export function ReviewRationaleSourceDetails({
  models,
}: {
  models: readonly EvidenceObjectModel[];
}) {
  if (models.length === 0) {
    return null;
  }
  if (models.length === 1) {
    const model = models[0];
    if (!model) {
      return null;
    }
    if (model.reasonCode) {
      return (
        <EvidenceProvenanceInspect
          availability={model.availability}
          contentSurface="source_card"
          provenance={model.provenance}
          reasonCode={model.reasonCode}
          showLimitations={false}
          summaryLabel={REVIEW_RATIONALE_SOURCE_DETAILS_LABEL}
        />
      );
    }
    return (
      <EvidenceProvenanceInspect
        contentSurface="source_card"
        provenance={model.provenance}
        showLimitations={false}
        stateLabel={evidenceAvailabilityLabel(model.availability)}
        summaryLabel={REVIEW_RATIONALE_SOURCE_DETAILS_LABEL}
      />
    );
  }
  return (
    <details
      className="ux-reset-evidence-provenance"
      data-testid="evidence-provenance-inspect"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          trackProvenanceOpened(
            globalThis.location?.pathname ?? "/",
            "source_card"
          );
        }
      }}
    >
      <summary>{REVIEW_RATIONALE_SOURCE_DETAILS_LABEL}</summary>
      <div className="ux-reset-review-rationale-source-stack">
        {models.map((model) => (
          <section
            aria-label={model.claimLabel}
            className="ux-reset-review-rationale-source-section"
            key={model.claimLabel}
          >
            <h5 className="ux-reset-review-rationale-source-heading">
              {model.claimLabel}
            </h5>
            <ProvenanceSection model={model} />
          </section>
        ))}
      </div>
    </details>
  );
}
