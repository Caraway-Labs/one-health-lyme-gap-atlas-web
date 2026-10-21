"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import { publishedLymeCasePresentation } from "@/features/ux-reset/review/published-human-case-copy";
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

function PublishedCaseCopy({ detail }: { detail: CountyDetail }) {
  const presentation = publishedLymeCasePresentation(detail);
  if (presentation.measures.length === 0) {
    return <p>{presentation.text}</p>;
  }
  return (
    <TooltipProvider delay={300}>
      <p>
        {presentation.measures.map((measure, index) => (
          <span key={measure.label}>
            {index > 0 ? " " : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={`${measure.label}. ${measure.tooltip}`}
                    className="inline h-auto max-w-full px-0 py-0 align-baseline text-[length:inherit] leading-[inherit] font-normal whitespace-normal text-inherit underline decoration-dotted underline-offset-2"
                    size="xs"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                {measure.label}
              </TooltipTrigger>
              <TooltipContent
                className="max-w-xs text-left whitespace-normal"
                side="bottom"
              >
                {measure.tooltip}
              </TooltipContent>
            </Tooltip>
            {": "}
            {measure.sentence}
          </span>
        ))}
      </p>
    </TooltipProvider>
  );
}

function RationaleItem({
  detail,
  item,
  models,
}: {
  detail: CountyDetail;
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
        {item.number === 1 ? (
          <PublishedCaseCopy detail={detail} />
        ) : (
          <p>{item.text}</p>
        )}
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
            detail={detail}
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
            detail={detail}
            item={item}
            key={item.number}
            models={evidence.get(item.number) ?? []}
          />
        ))}
      </ol>
    </section>
  );
}
