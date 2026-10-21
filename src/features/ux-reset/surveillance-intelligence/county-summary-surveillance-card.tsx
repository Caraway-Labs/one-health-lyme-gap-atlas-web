"use client";

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
import { CountySummarySurveillanceDetails } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance-details";
import type { SurveillanceIntelligencePerspectiveId } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

const PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
const RING_RADIUS = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const FULL_CLASS_PERCENT = 99.95;
const TRACE_CLASS_PERCENT = 0.05;

const MARK_CAPTIONS = {
  "ecological-situation": "Ecology",
  "gap-score": "Score",
  "ml-review-priority": "Priority",
  "surveillance-situation": "Surveillance",
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
      const membership = perspective.track?.label ?? perspective.supporting;
      return `${perspective.label}. ${perspective.primary}. ${membership}`;
    }
    default: {
      const exhaustive: never = perspective.id;
      return exhaustive;
    }
  }
}

function situationPercent(
  perspective: IntelligencePerspectiveView
): number | null {
  if (perspective.kind !== "ready" || perspective.fullValue === null) {
    return perspective.track?.value ?? null;
  }
  const probability = Number(perspective.fullValue);
  if (Number.isFinite(probability) && probability >= 0 && probability <= 1) {
    return probability * 100;
  }
  return perspective.track?.value ?? null;
}

function displayPercent(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
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

const SITUATION_TOOLTIP = {
  "ecological-situation":
    "The pattern in tick and pathogen evidence alone. Compare it with Surveillance.",
  "surveillance-situation":
    "The pattern in human, tick, and pathogen reporting. Compare it with Ecology.",
} as const satisfies Record<
  "ecological-situation" | "surveillance-situation",
  string
>;

function situationFit(percent: number | null): string {
  if (percent === null) {
    return "Membership was not returned.";
  }
  if (percent >= FULL_CLASS_PERCENT) {
    return "Strong fit.";
  }
  if (percent === 0) {
    return "No fit.";
  }
  if (percent < TRACE_CLASS_PERCENT) {
    return "Partial fit, below 0.1%.";
  }
  return `Partial fit, ${displayPercent(percent)}%.`;
}

function situationTooltip(
  id: "ecological-situation" | "surveillance-situation",
  percent: number | null
): string {
  return `${SITUATION_TOOLTIP[id]} ${situationFit(percent)}`;
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
      if (perspective.releaseReason) {
        return "Not on this release";
      }
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
        return perspective.primary;
      }
      return situationTooltip(perspective.id, situationPercent(perspective));
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

function MembershipRing({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const filled =
    value === null
      ? 0
      : (Math.min(100, Math.max(0, value)) / 100) * RING_CIRCUMFERENCE;
  return (
    <svg
      aria-label={value === null ? undefined : label}
      aria-valuemax={value === null ? undefined : 100}
      aria-valuemin={value === null ? undefined : 0}
      aria-valuenow={value === null ? undefined : value}
      className="county-summary-ring"
      role={value === null ? undefined : "meter"}
      viewBox="0 0 28 28"
    >
      <circle
        className="county-summary-ring-track"
        cx="14"
        cy="14"
        r={RING_RADIUS}
      />
      {value === null ? null : (
        <circle
          className="county-summary-ring-value"
          cx="14"
          cy="14"
          r={RING_RADIUS}
          strokeDasharray={`${filled} ${RING_CIRCUMFERENCE - filled}`}
          transform="rotate(-90 14 14)"
        />
      )}
    </svg>
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
      const value = situationPercent(perspective);
      return (
        <span className="county-summary-situation">
          <MembershipRing
            label={perspective.track?.label ?? perspective.supporting}
            value={value}
          />
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
      data-release-reason={perspective.releaseReason ?? undefined}
      data-state={
        perspective.releaseReason ? "release-unaligned" : perspective.kind
      }
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
          className="county-summary-mark-popover"
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
