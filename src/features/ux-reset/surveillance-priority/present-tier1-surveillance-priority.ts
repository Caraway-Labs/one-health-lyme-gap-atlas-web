import {
  Tier1CountyPriorityEvidenceSufficiency,
  type Tier1CountyPriority,
  type Tier1CountyPriorityPriorityTier,
} from "@/generated/models";

/** Returned reasons are displayed in order, capped at the contract maximum. */
const RETURNED_REASON_LIMIT = 3;

export const TIER1_MODEL_ASSISTED_LABEL = "Model-assisted";

export const TIER1_REGION_LABEL = "Model-assisted surveillance review priority";

export const TIER1_HEADING = "Surveillance review priority";

export const TIER1_LIMITATION =
  "This is review prioritization, not disease risk or predicted incidence.";

export const TIER1_SUPPORT_NOTE =
  "This model-assisted priority supports review. It does not replace governed evidence.";

export const TIER1_UNAVAILABLE_MESSAGE =
  "No persisted model-assisted surveillance priority was returned for this county. A missing result is not low priority.";

export const TIER1_FAILED_MESSAGE =
  "Model-assisted surveillance priority could not be shown for this county. A failed request is not low priority.";

export const TIER1_STALE_MESSAGE =
  "This model-assisted priority did not match the selected county, so it was not shown. It is not low priority.";

export const TIER1_REASON_ABSENCE = "No contributing reasons were returned.";

export const TIER1_NOT_RETURNED = "Not returned";

const BATCH_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export type Tier1ScoredTier = Exclude<Tier1CountyPriorityPriorityTier, null>;

export type Tier1ScoredSufficiency = Exclude<
  Tier1CountyPriority["evidence_sufficiency"],
  "NOT_ESTIMABLE"
>;

export type Tier1ReasonDisplay = {
  code: string;
  text: string;
};

export type Tier1ModelDetails = {
  generatedAtLabel: string;
  limitationRef: string;
  modelVersion: string;
  percentileLabel: string;
  predictionBatchVersion: string;
  rawScoreLabel: string;
  releaseId: string;
  sourceCommit: string;
  tierPolicyVersion: string;
};

export type Tier1SurveillancePriorityView =
  | { fips: string; kind: "loading" }
  | { fips: string; kind: "unavailable" }
  | { fips: string; kind: "failed" }
  | { fips: string; kind: "stale" }
  | {
      details: Tier1ModelDetails;
      fips: string;
      kind: "not-estimable";
      reasons: readonly Tier1ReasonDisplay[];
    }
  | {
      details: Tier1ModelDetails;
      fips: string;
      kind: "result";
      reasons: readonly Tier1ReasonDisplay[];
      sufficiency: Tier1ScoredSufficiency;
      tier: Tier1ScoredTier;
    };

export function sufficiencyLabel(
  sufficiency: Tier1CountyPriority["evidence_sufficiency"]
): string {
  switch (sufficiency) {
    case Tier1CountyPriorityEvidenceSufficiency.SUFFICIENT: {
      return "Sufficient";
    }
    case Tier1CountyPriorityEvidenceSufficiency.INSUFFICIENT: {
      return "Insufficient";
    }
    case Tier1CountyPriorityEvidenceSufficiency.NOT_ESTIMABLE: {
      return "Not estimable";
    }
    default: {
      const exhaustive: never = sufficiency;
      return exhaustive;
    }
  }
}

export function formatTier1BatchGeneratedAt(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return `${BATCH_TIME_FORMAT.format(parsed)} UTC`;
}

function formatReturnedNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return TIER1_NOT_RETURNED;
  }
  return String(value);
}

function modelDetails(result: Tier1CountyPriority): Tier1ModelDetails {
  return {
    generatedAtLabel: formatTier1BatchGeneratedAt(result.generated_at_utc),
    limitationRef: result.limitation_ref,
    modelVersion: result.model_version,
    percentileLabel: formatReturnedNumber(result.priority_percentile),
    predictionBatchVersion: result.prediction_batch_version,
    rawScoreLabel: formatReturnedNumber(result.raw_model_score),
    releaseId: result.release_id,
    sourceCommit: result.source_commit,
    tierPolicyVersion: result.tier_policy_version,
  };
}

function returnedReasons(
  reasons: Tier1CountyPriority["reasons"]
): Tier1ReasonDisplay[] {
  const visible: Tier1ReasonDisplay[] = [];
  for (const reason of reasons) {
    if (visible.length >= RETURNED_REASON_LIMIT) {
      break;
    }
    visible.push({ code: reason.code, text: reason.text });
  }
  return visible;
}

function isScoredTier(
  tier: Tier1CountyPriorityPriorityTier
): tier is Tier1ScoredTier {
  switch (tier) {
    case "HIGH":
    case "MEDIUM":
    case "LOW": {
      return true;
    }
    case null: {
      return false;
    }
    default: {
      const exhaustive: never = tier;
      return exhaustive;
    }
  }
}

/**
 * SUFFICIENT and INSUFFICIENT require a returned tier, percentile, and score.
 * NOT_ESTIMABLE requires all three to be null. Anything else is not shown as a tier.
 */
function isCoherent(result: Tier1CountyPriority): boolean {
  const percentile = result.priority_percentile;
  const score = result.raw_model_score;
  const numbersPresent =
    percentile !== null &&
    score !== null &&
    Number.isFinite(percentile) &&
    Number.isFinite(score);
  const numbersAbsent = percentile === null && score === null;
  switch (result.evidence_sufficiency) {
    case Tier1CountyPriorityEvidenceSufficiency.NOT_ESTIMABLE: {
      return result.priority_tier === null && numbersAbsent;
    }
    case Tier1CountyPriorityEvidenceSufficiency.SUFFICIENT:
    case Tier1CountyPriorityEvidenceSufficiency.INSUFFICIENT: {
      return isScoredTier(result.priority_tier) && numbersPresent;
    }
    default: {
      const exhaustive: never = result.evidence_sufficiency;
      return exhaustive;
    }
  }
}

export function presentTier1SurveillancePriority(input: {
  errorStatus: number | null;
  requestedFips: string;
  result: Tier1CountyPriority | null;
  status: "error" | "loading" | "success";
}): Tier1SurveillancePriorityView {
  const { errorStatus, requestedFips, result, status } = input;
  switch (status) {
    case "loading": {
      return { fips: requestedFips, kind: "loading" };
    }
    case "error": {
      if (errorStatus === 404) {
        return { fips: requestedFips, kind: "unavailable" };
      }
      return { fips: requestedFips, kind: "failed" };
    }
    case "success": {
      if (!result || result.county_fips !== requestedFips) {
        return { fips: requestedFips, kind: "stale" };
      }
      if (!isCoherent(result)) {
        return { fips: requestedFips, kind: "failed" };
      }
      const reasons = returnedReasons(result.reasons);
      const details = modelDetails(result);
      if (
        result.evidence_sufficiency ===
        Tier1CountyPriorityEvidenceSufficiency.NOT_ESTIMABLE
      ) {
        return {
          details,
          fips: requestedFips,
          kind: "not-estimable",
          reasons,
        };
      }
      if (!isScoredTier(result.priority_tier)) {
        return { fips: requestedFips, kind: "failed" };
      }
      return {
        details,
        fips: requestedFips,
        kind: "result",
        reasons,
        sufficiency: result.evidence_sufficiency,
        tier: result.priority_tier,
      };
    }
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
