"use client";

import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  reviewRationaleFor,
  type ReviewRationaleItem,
} from "@/features/ux-reset/review/review-rationale";
import { reviewRationaleEvidence } from "@/features/ux-reset/review/review-rationale-provenance";
import type { CountyDetail } from "@/generated/models";

function ClaimProvenance({ model }: { model: EvidenceObjectModel }) {
  const summaryLabel = `Inspect provenance for ${model.claimLabel}`;
  if (model.reasonCode) {
    return (
      <EvidenceProvenanceInspect
        availability={model.availability}
        contentSurface="source_card"
        provenance={model.provenance}
        reasonCode={model.reasonCode}
        showLimitations={false}
        summaryLabel={summaryLabel}
      />
    );
  }
  return (
    <EvidenceProvenanceInspect
      contentSurface="source_card"
      provenance={model.provenance}
      showLimitations={false}
      stateLabel={evidenceAvailabilityLabel(model.availability)}
      summaryLabel={summaryLabel}
    />
  );
}

function RationaleItem({
  item,
  models,
}: {
  item: ReviewRationaleItem;
  models: readonly EvidenceObjectModel[];
}) {
  return (
    <li data-testid={`review-rationale-${item.number}`}>
      <span>{item.number}</span>
      <div>
        <h4>
          {item.number === 3 ? (
            <>
              <em>Borrelia burgdorferi</em> detection
            </>
          ) : (
            item.label
          )}
        </h4>
        <p>{item.text}</p>
        {models.map((model) => (
          <ClaimProvenance key={model.claimLabel} model={model} />
        ))}
      </div>
    </li>
  );
}

export function ReviewRationalePanel({ detail }: { detail: CountyDetail }) {
  const items = reviewRationaleFor(detail);
  const evidence = reviewRationaleEvidence(detail);
  const surveillance = items.filter((item) => item.group === "surveillance");
  const community = items.filter((item) => item.group === "community");
  return (
    <section
      aria-label="County evidence"
      className="ux-reset-review-rationale"
      data-testid="review-rationale"
    >
      <h3>Surveillance evidence</h3>
      <ol>
        {surveillance.map((item) => (
          <RationaleItem
            item={item}
            key={item.number}
            models={evidence.get(item.number) ?? []}
          />
        ))}
      </ol>
      <h3>Community context</h3>
      <ol start={4}>
        {community.map((item) => (
          <RationaleItem
            item={item}
            key={item.number}
            models={evidence.get(item.number) ?? []}
          />
        ))}
      </ol>
    </section>
  );
}
