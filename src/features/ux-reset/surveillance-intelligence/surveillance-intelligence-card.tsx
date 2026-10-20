"use client";

import { Button } from "@/components/ui/button";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import { cn } from "@/lib/utils";

export function SurveillanceIntelligenceCard({
  controlsId,
  expanded,
  headingId,
  onRetry,
  onToggle,
  perspective,
}: {
  controlsId: string;
  expanded: boolean;
  headingId: string;
  onRetry: () => void;
  onToggle: () => void;
  perspective: IntelligencePerspectiveView;
}) {
  return (
    <article
      className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-2 rounded-xl p-3 ring-1"
      data-kind={perspective.kind}
      data-perspective={perspective.id}
      data-testid={`surveillance-intelligence-card-${perspective.id}`}
    >
      <h3 className="m-0" id={headingId}>
        <Button
          aria-controls={expanded ? controlsId : undefined}
          aria-expanded={expanded}
          className={cn(
            "h-auto min-h-11 w-full flex-col items-start justify-start gap-1 px-3 py-3 text-left whitespace-normal motion-reduce:transition-none",
            expanded && "ring-ring ring-2"
          )}
          type="button"
          variant={expanded ? "secondary" : "outline"}
          onClick={onToggle}
        >
          <span className="type-small">{perspective.label}</span>
          <span className="type-card break-words">{perspective.primary}</span>
          <span className="type-small font-normal break-words">
            {perspective.supporting}
          </span>
        </Button>
      </h3>
      {perspective.retryable ? (
        <Button
          className="min-h-11 w-fit"
          data-testid={`surveillance-intelligence-retry-${perspective.id}`}
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          {`Retry ${perspective.label}`}
        </Button>
      ) : null}
    </article>
  );
}
