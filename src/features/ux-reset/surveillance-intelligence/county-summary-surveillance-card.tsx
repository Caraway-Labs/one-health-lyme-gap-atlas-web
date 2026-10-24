"use client";

import { ClipboardList } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FrontPorchTickIcon } from "@/features/front-porch/front-porch-icons";
import { CountySummarySurveillanceDetails } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance-details";
import {
  SURVEILLANCE_INTELLIGENCE_LABELS,
  type SurveillanceIntelligencePerspectiveId,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

const PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

const MARK_CAPTIONS = {
  "ecological-situation":
    SURVEILLANCE_INTELLIGENCE_LABELS["ecological-situation"],
  "gap-score": "Score",
  "ml-review-priority": "Priority",
  "surveillance-situation":
    SURVEILLANCE_INTELLIGENCE_LABELS["surveillance-situation"],
} as const satisfies Record<SurveillanceIntelligencePerspectiveId, string>;

function spokenResult(perspective: IntelligencePerspectiveView): string {
  switch (perspective.id) {
    case "gap-score": {
      if (perspective.kind !== "ready") {
        return `${perspective.label}. ${perspective.primary}`;
      }
      const category = perspective.reviewCategory
        ? ` ${perspective.reviewCategory}.`
        : "";
      return `${perspective.label}. ${perspective.primary} out of 100.${category}`;
    }
    case "ml-review-priority": {
      if (perspective.tier) {
        const percentile = perspective.track?.label ?? perspective.supporting;
        return `${perspective.label}. ${perspective.tier}. ${percentile}`;
      }
      return `${perspective.label}. ${perspective.primary}`;
    }
    case "ecological-situation":
    case "surveillance-situation": {
      if (perspective.kind !== "ready") {
        return perspective.overview;
      }
      return `Assigned group: ${perspective.primary}.`;
    }
    default: {
      const exhaustive: never = perspective.id;
      return exhaustive;
    }
  }
}

function tierWords(tier: string): string {
  switch (tier) {
    case "HIGH": {
      return "High";
    }
    case "LOW": {
      return "Low";
    }
    case "MEDIUM": {
      return "Medium";
    }
    default: {
      return tier;
    }
  }
}

function markTooltip(perspective: IntelligencePerspectiveView): string {
  switch (perspective.id) {
    case "gap-score": {
      if (perspective.kind !== "ready") {
        return perspective.primary;
      }
      return perspective.reviewCategory ?? "Published score";
    }
    case "ml-review-priority": {
      if (perspective.tier) {
        const percentile = perspective.track?.valueText;
        if (perspective.track?.value !== null && percentile) {
          return `${tierWords(perspective.tier)} · ${percentile}`;
        }
        return tierWords(perspective.tier);
      }
      return perspective.primary;
    }
    case "ecological-situation":
    case "surveillance-situation": {
      if (perspective.kind !== "ready") {
        return perspective.overview;
      }
      return `${perspective.overview} Assigned group: ${perspective.primary}.`;
    }
    default: {
      const exhaustive: never = perspective.id;
      return exhaustive;
    }
  }
}

function ScoreChip({
  perspective,
}: {
  perspective: IntelligencePerspectiveView;
}) {
  if (perspective.kind !== "ready") {
    return (
      <span aria-hidden="true" className="ux-reset-ranked-score is-unavailable">
        —
      </span>
    );
  }
  return (
    <span
      className="ux-reset-ranked-score"
      data-testid="selected-county-gap-score"
      style={
        perspective.swatch ? { background: perspective.swatch } : undefined
      }
    >
      {perspective.primary}
    </span>
  );
}

function PriorityMarks({ tier }: { tier: string | null }) {
  return (
    <span aria-hidden="true" className="county-summary-priority">
      {PRIORITY_LEVELS.map((level) => (
        <span
          data-filled={tier === level ? "true" : "false"}
          data-level={level}
          key={level}
        />
      ))}
    </span>
  );
}

function SituationIcon({
  id,
}: {
  id: "ecological-situation" | "surveillance-situation";
}) {
  if (id === "surveillance-situation") {
    return (
      <ClipboardList aria-hidden="true" className="county-summary-model-icon" />
    );
  }
  return (
    <FrontPorchTickIcon
      bodyClassName=""
      className="county-summary-model-icon county-summary-tick-icon"
    />
  );
}

function MarkVisual({
  perspective,
}: {
  perspective: IntelligencePerspectiveView;
}) {
  switch (perspective.id) {
    case "gap-score": {
      return <ScoreChip perspective={perspective} />;
    }
    case "ml-review-priority": {
      return <PriorityMarks tier={perspective.tier} />;
    }
    case "ecological-situation":
    case "surveillance-situation": {
      return (
        <span className="county-summary-situation">
          <SituationIcon id={perspective.id} />
          {perspective.kind === "ready" ? (
            <span className="county-summary-class-name">
              {perspective.primary}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="ux-reset-ranked-score is-unavailable"
            >
              —
            </span>
          )}
        </span>
      );
    }
    default: {
      const exhaustive: never = perspective.id;
      return exhaustive;
    }
  }
}

export function CountySummarySurveillanceCard({
  expanded,
  headingId,
  onOpenChange,
  onRetry,
  perspective,
}: {
  expanded: boolean;
  headingId: string;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  perspective: IntelligencePerspectiveView;
}) {
  return (
    <article
      className="county-summary-mark-cell"
      data-kind={perspective.kind}
      data-perspective={perspective.id}
      data-state={perspective.kind}
      data-sufficiency={perspective.sufficiency ?? undefined}
      data-testid={`surveillance-intelligence-card-${perspective.id}`}
      data-tier={perspective.tier ?? undefined}
    >
      <h4 className="sr-only" id={headingId}>
        {perspective.label}
      </h4>
      <Popover open={expanded} onOpenChange={onOpenChange}>
        <Tooltip disabled={expanded}>
          <TooltipTrigger
            delay={0}
            render={
              <PopoverTrigger
                className="county-summary-mark"
                data-tooltip={markTooltip(perspective)}
                type="button"
              />
            }
          >
            <span className="county-summary-mark-caption">
              {MARK_CAPTIONS[perspective.id]}
            </span>
            <span className="sr-only">{spokenResult(perspective)}</span>
            <MarkVisual perspective={perspective} />
          </TooltipTrigger>
          <TooltipContent side="top">{markTooltip(perspective)}</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="start"
          className="county-summary-mark-popover w-[min(22rem,calc(100vw-1.5rem))] max-w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto"
          side="bottom"
        >
          <CountySummarySurveillanceDetails
            id={`${headingId}-panel`}
            labelledBy={headingId}
            onRetry={onRetry}
            perspective={perspective}
          />
        </PopoverContent>
      </Popover>
    </article>
  );
}
