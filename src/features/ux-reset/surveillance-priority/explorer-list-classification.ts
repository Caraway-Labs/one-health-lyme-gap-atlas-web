import { presentTier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";

/**
 * Visible list copy required by the Explorer surveillance-priority story.
 * The em dash and wording stay exact.
 */
export const EXPLORER_ML_PRIORITY_LEGEND =
  "ML surveillance priority — counties flagged for review, not personal Lyme disease risk";

export const EXPLORER_ML_PRIORITY_NOTE =
  "HIGH, MEDIUM, and LOW are persisted Tier 1 surveillance-review labels. They support follow-up review. They are not personal Lyme disease risk. Not estimable is shown as Not estimable. A missing result stays Not available and is not shown as LOW. A response that could not be verified stays Response could not be verified. A request that could not be loaded stays Could not load and is not shown as Not available or LOW.";

export const EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL = "Not available";

export const EXPLORER_ML_PRIORITY_NOT_ESTIMABLE_LABEL = "Not estimable";

export const EXPLORER_ML_PRIORITY_UNVERIFIED_LABEL =
  "Response could not be verified";

export const EXPLORER_ML_PRIORITY_LOADING_LABEL = "Loading";

export const EXPLORER_ML_PRIORITY_FAILED_LABEL = "Could not load";

export type ExplorerMlListTier =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "unavailable"
  | "not-estimable"
  | "unverified"
  | "loading"
  | "failed";

export type ExplorerMlListLabel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | typeof EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL
  | typeof EXPLORER_ML_PRIORITY_NOT_ESTIMABLE_LABEL
  | typeof EXPLORER_ML_PRIORITY_UNVERIFIED_LABEL
  | typeof EXPLORER_ML_PRIORITY_LOADING_LABEL
  | typeof EXPLORER_ML_PRIORITY_FAILED_LABEL;

export type ExplorerMlListClassification = {
  label: ExplorerMlListLabel;
  tier: ExplorerMlListTier;
};

export const EXPLORER_ML_PRIORITY_UNAVAILABLE: ExplorerMlListClassification = {
  label: EXPLORER_ML_PRIORITY_UNAVAILABLE_LABEL,
  tier: "unavailable",
};

export const EXPLORER_ML_PRIORITY_FAILED: ExplorerMlListClassification = {
  label: EXPLORER_ML_PRIORITY_FAILED_LABEL,
  tier: "failed",
};

export const EXPLORER_ML_PRIORITY_NOT_ESTIMABLE: ExplorerMlListClassification =
  {
    label: EXPLORER_ML_PRIORITY_NOT_ESTIMABLE_LABEL,
    tier: "not-estimable",
  };

export const EXPLORER_ML_PRIORITY_UNVERIFIED: ExplorerMlListClassification = {
  label: EXPLORER_ML_PRIORITY_UNVERIFIED_LABEL,
  tier: "unverified",
};

export const EXPLORER_ML_PRIORITY_LEGEND_ITEMS: readonly ExplorerMlListClassification[] =
  [
    { label: "HIGH", tier: "HIGH" },
    { label: "MEDIUM", tier: "MEDIUM" },
    { label: "LOW", tier: "LOW" },
    EXPLORER_ML_PRIORITY_NOT_ESTIMABLE,
    EXPLORER_ML_PRIORITY_UNAVAILABLE,
    EXPLORER_ML_PRIORITY_UNVERIFIED,
    EXPLORER_ML_PRIORITY_FAILED,
  ];

type PriorityQueryStatus = "error" | "loading" | "success";

function classificationForView(
  view: ReturnType<typeof presentTier1SurveillancePriority>
): ExplorerMlListClassification {
  switch (view.kind) {
    case "loading": {
      return {
        label: EXPLORER_ML_PRIORITY_LOADING_LABEL,
        tier: "loading",
      };
    }
    case "result": {
      return { label: view.tier, tier: view.tier };
    }
    case "failed": {
      return EXPLORER_ML_PRIORITY_FAILED;
    }
    case "not-estimable": {
      return EXPLORER_ML_PRIORITY_NOT_ESTIMABLE;
    }
    case "unverified": {
      return EXPLORER_ML_PRIORITY_UNVERIFIED;
    }
    case "unavailable":
    case "stale": {
      return EXPLORER_ML_PRIORITY_UNAVAILABLE;
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

/**
 * Maps one persisted Tier 1 response onto a list label.
 * `Tier1CountyPriority` has no explicit outlier field. `raw_model_score` is a
 * model-native anomaly score, and the contract does not define HIGH as a
 * detected outlier, so this label never adds one.
 * Counties outside the lower 48 and DC stay Not available.
 * A missing result stays Not available, never LOW.
 * NOT_ESTIMABLE stays Not estimable. A schema or coherence failure stays
 * Response could not be verified. A failed request stays Could not load.
 */
export function explorerMlListClassification(input: {
  errorStatus: number | null;
  inLower48: boolean;
  requestedFips: string;
  result: Tier1CountyPriority | null;
  status: PriorityQueryStatus;
  unverified?: boolean;
}): ExplorerMlListClassification {
  if (!input.inLower48) {
    return EXPLORER_ML_PRIORITY_UNAVAILABLE;
  }
  return classificationForView(presentTier1SurveillancePriority(input));
}
