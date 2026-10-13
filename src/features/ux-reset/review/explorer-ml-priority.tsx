"use client";

import { Badge } from "@/components/ui/badge";
import {
  EXPLORER_ML_PRIORITY_LEGEND,
  EXPLORER_ML_PRIORITY_LEGEND_ITEMS,
  EXPLORER_ML_PRIORITY_NOTE,
  type ExplorerMlListClassification,
  type ExplorerMlListTier,
} from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import { TIER1_FAILED_MESSAGE } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { cn } from "@/lib/utils";

function priorityToneClass(tier: ExplorerMlListTier): string | undefined {
  switch (tier) {
    case "HIGH": {
      return "urgent";
    }
    case "MEDIUM": {
      return "review";
    }
    case "LOW": {
      return "lower";
    }
    case "unavailable":
    case "loading":
    case "failed": {
      return undefined;
    }
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

export function ExplorerMlPriorityBadge({
  classification,
}: {
  classification: ExplorerMlListClassification;
}) {
  return (
    <Badge
      className={cn(
        "priority-pill ux-reset-ml-priority h-auto",
        priorityToneClass(classification.tier)
      )}
      data-testid="explorer-ml-priority"
      data-tier={classification.tier}
      title={
        classification.tier === "failed" ? TIER1_FAILED_MESSAGE : undefined
      }
    >
      {classification.label}
      {classification.tier === "failed" ? (
        <span className="sr-only">{` ${TIER1_FAILED_MESSAGE}`}</span>
      ) : null}
    </Badge>
  );
}

export function ExplorerMlPriorityLegend() {
  return (
    <div
      className="ux-reset-ml-priority-legend"
      data-testid="explorer-ml-priority-legend"
    >
      <p className="type-small">{EXPLORER_ML_PRIORITY_LEGEND}</p>
      <ul aria-label="ML surveillance priority labels">
        {EXPLORER_ML_PRIORITY_LEGEND_ITEMS.map((item) => (
          <li key={item.tier}>
            <ExplorerMlPriorityBadge classification={item} />
          </li>
        ))}
      </ul>
      <p className="type-small">{EXPLORER_ML_PRIORITY_NOTE}</p>
    </div>
  );
}

export function ExplorerCountyRowContent({
  classification,
  explanation,
  name,
  publishedCategory,
  publishedScore,
}: {
  classification: ExplorerMlListClassification;
  explanation: string;
  name: string;
  publishedCategory?: string;
  publishedScore?: number;
}) {
  return (
    <>
      <strong>{name}</strong>
      <small>
        {publishedCategory
          ? `Published category: ${publishedCategory}. `
          : null}
        {explanation}
      </small>
      {publishedScore === undefined ? null : (
        <span className="ux-reset-explorer-county-score">
          Published score {publishedScore}
        </span>
      )}
      <ExplorerMlPriorityBadge classification={classification} />
    </>
  );
}
