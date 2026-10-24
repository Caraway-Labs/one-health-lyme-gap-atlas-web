import type { SurveillanceIntelligencePerspectiveId } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";

/**
 * Compare-local display for the current v1 surveillance groups.
 *
 * Issue 864 owns the shared mapping in
 * `surveillance-intelligence-copy.ts` and is still unmerged. This module
 * repeats that approved mapping only for Compare. When issue 864 exports the
 * shared lookup, Compare should import it and delete this copy.
 * Unknown versions and unrecognized class names keep the returned label.
 */

export const COMPARE_MODEL_ROW_LABELS = {
  "ecological-situation": "Tick and pathogen pattern",
  "gap-score": "Gap review score",
  "ml-review-priority": "ML review priority",
  "surveillance-situation": "Combined surveillance pattern",
} as const satisfies Record<SurveillanceIntelligencePerspectiveId, string>;

const MODEL_DESCRIPTIONS = {
  "ecological-situation":
    "This model groups counties using tick and pathogen records, without using human Lyme disease reporting.",
  "surveillance-situation":
    "This model groups counties using human Lyme disease reporting, tick records, and pathogen records.",
} as const;

type SituationPerspective = "ecological-situation" | "surveillance-situation";

type GroupCopy = {
  explanation: string;
  friendly: string;
  reviewedName: string;
};

const FOUR_STATE_V1: Record<string, GroupCopy> = {
  "class-0": {
    explanation:
      "This group is characterized by established or reported blacklegged ticks and no western blacklegged tick record. Human Lyme disease records or pathogen records are common in this group, but are not present for every county.",
    friendly: "Blacklegged tick records predominate",
    reviewedName: "Established blacklegged tick",
  },
  "class-1": {
    explanation:
      "This group includes Alaska and Hawaii counties whose tick and pathogen status is unknown and whose human Lyme disease data have no county-linked record. Unknown status is a model group, not a missing model result.",
    friendly: "Tick and pathogen status unknown",
    reviewedName: "Unknown tick and pathogen status",
  },
  "class-2": {
    explanation:
      "This group is characterized by established or reported western blacklegged ticks and no blacklegged tick record.",
    friendly: "Western blacklegged tick records predominate",
    reviewedName: "Western blacklegged tick recorded",
  },
  "class-3": {
    explanation:
      "Counties in this group have no pathogen record and no western blacklegged tick record in the data used by the model. Blacklegged tick records vary: established, reported, or no records.",
    friendly: "Pathogen not recorded",
    reviewedName: "Pathogen not recorded",
  },
};

const TICK_PATHOGEN_V1: Record<string, GroupCopy> = {
  "class-0": {
    explanation:
      "This group is characterized by established or reported blacklegged ticks and no western blacklegged tick record. It includes counties with pathogen records and counties with no pathogen record.",
    friendly: "Blacklegged tick records predominate",
    reviewedName: "Established blacklegged tick",
  },
  "class-1": {
    explanation:
      "This group is characterized by no pathogen record and blacklegged ticks that are not established. Some counties in this group have reported ticks.",
    friendly: "Limited tick and pathogen records",
    reviewedName: "Blacklegged tick not established, pathogen not recorded",
  },
  "class-2": {
    explanation:
      "This group is characterized by established western blacklegged ticks and no blacklegged tick record. Pathogen records vary among counties in the group.",
    friendly: "Established western blacklegged tick pattern",
    reviewedName: "Western blacklegged tick established",
  },
  "class-3": {
    explanation:
      "This group includes Alaska and Hawaii counties whose tick and pathogen status is unknown. Human Lyme disease reporting is not used by this model. Unknown status is a model group, not a missing model result.",
    friendly: "Tick and pathogen status unknown",
    reviewedName: "Unknown tick and pathogen status",
  },
};

const V1_VERSION = /(?:^|[^a-z0-9])v1(?:[^0-9]|$)/i;

export type SituationDisplay = {
  description: string | null;
  explanation: string | null;
  label: string;
  mapped: boolean;
};

function fieldValue(
  perspective: IntelligencePerspectiveView,
  label: string
): string | null {
  const sources = [...perspective.fields, ...perspective.disclosure];
  const match = sources.find((field) => field.label === label);
  const value = match?.value.trim() ?? "";
  return value.length > 0 ? value : null;
}

function selectedClassId(
  perspective: IntelligencePerspectiveView
): string | null {
  const selected = perspective.memberships.filter((entry) => entry.selected);
  if (selected.length === 1) {
    return selected[0]?.classId ?? null;
  }
  return fieldValue(perspective, "Class id");
}

export function situationDisplay(
  perspective: IntelligencePerspectiveView
): SituationDisplay {
  const returned = perspective.primary.trim();
  if (
    perspective.id !== "surveillance-situation" &&
    perspective.id !== "ecological-situation"
  ) {
    return {
      description: null,
      explanation: null,
      label: returned,
      mapped: false,
    };
  }
  const perspectiveId: SituationPerspective = perspective.id;
  const version = fieldValue(perspective, "Model version");
  const classId = selectedClassId(perspective);
  const groups =
    perspectiveId === "surveillance-situation"
      ? FOUR_STATE_V1
      : TICK_PATHOGEN_V1;
  const group = classId ? groups[classId] : undefined;
  const versionKnown = version !== null && V1_VERSION.test(version);
  if (
    !(
      versionKnown &&
      group &&
      returned.localeCompare(group.reviewedName, "en", {
        sensitivity: "accent",
      }) === 0
    )
  ) {
    return {
      description: MODEL_DESCRIPTIONS[perspectiveId],
      explanation: null,
      label: returned,
      mapped: false,
    };
  }
  return {
    description: MODEL_DESCRIPTIONS[perspectiveId],
    explanation: group.explanation,
    label: group.friendly,
    mapped: true,
  };
}

export function membershipPercentText(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) {
    return "Not returned";
  }
  if (percent === 0) {
    return "0%";
  }
  if (percent > 0 && percent < 0.1) {
    return "Less than 0.1%";
  }
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0 && percent > 0) {
    return "Less than 0.1%";
  }
  const text = rounded.toFixed(1);
  return text.endsWith(".0") ? `${text.slice(0, -2)}%` : `${text}%`;
}
