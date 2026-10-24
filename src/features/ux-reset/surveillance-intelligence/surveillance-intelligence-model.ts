import {
  formatClassMembership,
  formatFullProbability,
  formatPercentileOneDecimal,
  formatPlainMembershipPercent,
  formatPublishedGapScore,
} from "@/features/ux-reset/surveillance-intelligence/format-surveillance-intelligence";
import {
  CLASS_MEMBERSHIP_QUALIFIER,
  GAP_SCORE_DESCRIPTOR,
  PERCENTILE_QUALIFIER,
  SUFFICIENCY_QUALIFIER,
  SURVEILLANCE_INTELLIGENCE_LABELS,
  UNRECOGNIZED_MODEL_VERSION_DESCRIPTION,
  situationGroupCopy,
  situationModelDescription,
  type SurveillanceIntelligencePerspectiveId,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import {
  sufficiencyLabel,
  TIER1_INCOHERENT_REASON,
  TIER1_UNVERIFIED_MESSAGE,
  type Tier1ActiveRelease,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { CountySurveillanceSituations } from "@/generated/models/countySurveillanceSituations";
import type { MembershipProbability } from "@/generated/models/membershipProbability";
import type { SituationClassification } from "@/generated/models/situationClassification";
import type { SituationVariant } from "@/generated/models/situationVariant";
import { SituationVariantAvailability } from "@/generated/models/situationVariantAvailability";
import {
  SituationVariantCompatibility,
  type SituationVariantCompatibility as SituationCompatibility,
} from "@/generated/models/situationVariantCompatibility";
import {
  SituationVariantUnavailableReason,
  type SituationVariantUnavailableReason as SituationUnavailableReason,
} from "@/generated/models/situationVariantUnavailableReason";
import type { Tier1CountyPriority } from "@/generated/models/tier1CountyPriority";
import {
  Tier1CountyPriorityEvidenceSufficiency,
  type Tier1CountyPriorityEvidenceSufficiency as EvidenceSufficiency,
} from "@/generated/models/tier1CountyPriorityEvidenceSufficiency";
import {
  Tier1CountyPriorityPriorityTier,
  type Tier1CountyPriorityPriorityTier as PriorityTier,
} from "@/generated/models/tier1CountyPriorityPriorityTier";
import { logUnverifiedApiResponse } from "@/lib/api-response-validation";
import { describeReleaseAssembly } from "@/lib/atlas-evidence-metadata";
import { responseTierPresentationForColor } from "@/lib/response-tier";

export type IntelligenceField = {
  label: string;
  value: string;
};

export type IntelligenceReason = {
  code: string;
  text: string;
};

export type IntelligenceKind =
  | "error"
  | "incompatible"
  | "loading"
  | "ready"
  | "unavailable"
  | "unverified";

/** A bounded 0–100 track. Null value means the bar must not render. */
export type IntelligenceTrack = {
  label: string;
  value: number | null;
  valueText: string;
};

/** One returned class probability. Percent is null when a bar would misstate it. */
export type IntelligenceMembership = {
  classId: string;
  percent: number | null;
  selected: boolean;
  text: string;
};

/** Plain-language row for one returned group. Probability stays on the 0–1 scale. */
export type SituationPlainMembership = {
  assigned: boolean;
  classId: string;
  label: string;
  probability: number;
  text: string;
};

export type SituationPlainView = {
  assignedLabel: string;
  groupMeaning: string;
  memberships: readonly SituationPlainMembership[] | null;
  methods: readonly string[];
  modelDescription: string;
  technical: readonly IntelligenceField[];
};

export type IntelligencePerspectiveView = {
  description: string | null;
  disclosure: readonly IntelligenceField[];
  fields: readonly IntelligenceField[];
  fullValue: string | null;
  id: SurveillanceIntelligencePerspectiveId;
  kind: IntelligenceKind;
  label: string;
  limitations: readonly string[];
  memberships: readonly IntelligenceMembership[];
  overview: string;
  primary: string;
  qualifier: string | null;
  reasons: readonly IntelligenceReason[];
  /** Published review-category title for the gap score. Not an ML tier. */
  reviewCategory: string | null;
  /** Map-ramp color for the published gap score chip. */
  swatch?: string | null;
  retryable: boolean;
  /** Plain-language situation summary. Null for other perspectives and non-ready results. */
  situationPlain: SituationPlainView | null;
  sufficiency: EvidenceSufficiency | null;
  supporting: string;
  tier: string | null;
  track: IntelligenceTrack | null;
};

export type PublishedGapScoreCounty = {
  color?: string;
  fips: string;
  in_contiguous_tick_scope: boolean;
  score: { score: number };
};

export type PublishedGapScoreSource = {
  counties: readonly PublishedGapScoreCounty[];
  methodology_version: string;
  release_id: string;
};

export type IntelligenceQueryPhase = "error" | "idle" | "loading" | "success";

export type GapScoreQueryState = {
  phase: IntelligenceQueryPhase;
  release: Tier1ActiveRelease;
  result: PublishedGapScoreSource | null;
};

export type Tier1QueryState = {
  errorStatus: number | null;
  phase: IntelligenceQueryPhase;
  result: Tier1CountyPriority | null;
  /** Schema or coherence failure. Distinct from an empty or network result. */
  unverified?: boolean;
};

export type SituationsQueryState = {
  errorStatus: number | null;
  phase: IntelligenceQueryPhase;
  result: CountySurveillanceSituations | null;
  /** Schema failure. Display still follows availability only for a valid body. */
  unverified?: boolean;
};

const NOT_RETURNED = "Not returned";
const LOADING_PRIMARY = "Loading";
const UNAVAILABLE_PRIMARY = "Unavailable";
const INCOMPATIBLE_PRIMARY = "Incompatible";
const ERROR_PRIMARY = "Could not be loaded";
const MEMBERSHIP_NOT_RETURNED = "Class membership not returned";
const SCORE_MAX = 100;
const PERCENT_SCALE = 100;

function boundedTrack(
  value: number | null,
  label: string,
  valueText: string
): IntelligenceTrack | null {
  if (
    value === null ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > SCORE_MAX
  ) {
    return null;
  }
  return { label, value, valueText };
}

function reviewCategoryTitle(color: string | undefined): string | null {
  if (!color) {
    return null;
  }
  return responseTierPresentationForColor(color)?.title ?? null;
}

function membershipTrack(probability: number | null): IntelligenceTrack | null {
  if (probability === null || !Number.isFinite(probability)) {
    return null;
  }
  const text = formatClassMembership(probability);
  if (!text.endsWith("%")) {
    return null;
  }
  return boundedTrack(
    probability * PERCENT_SCALE,
    `Class membership ${text}. Not pathogen presence, disease risk, or the probability that the model is correct.`,
    text
  );
}

function membershipBars(
  classification: SituationClassification
): IntelligenceMembership[] {
  const selectedId = classification.class_id;
  const selectedCount = classification.probabilities.filter(
    (entry) => entry.class_id === selectedId
  ).length;
  return classification.probabilities.map((entry) => {
    const text = Number.isFinite(entry.probability)
      ? formatClassMembership(entry.probability)
      : MEMBERSHIP_NOT_RETURNED;
    const track = membershipTrack(
      Number.isFinite(entry.probability) ? entry.probability : null
    );
    return {
      classId: entry.class_id,
      percent: track?.value ?? null,
      selected: selectedCount === 1 && entry.class_id === selectedId,
      text,
    };
  });
}

function emptyPerspective(
  id: SurveillanceIntelligencePerspectiveId,
  kind: IntelligenceKind,
  primary: string,
  supporting: string,
  overview: string,
  retryable: boolean
): IntelligencePerspectiveView {
  return {
    description: null,
    disclosure: [],
    fields: [],
    fullValue: null,
    id,
    kind,
    label: SURVEILLANCE_INTELLIGENCE_LABELS[id],
    limitations: [],
    memberships: [],
    overview,
    primary,
    qualifier: null,
    reasons: [],
    reviewCategory: null,
    retryable,
    situationPlain: null,
    sufficiency: null,
    supporting,
    tier: null,
    track: null,
  };
}

function loadingPerspective(
  id: SurveillanceIntelligencePerspectiveId,
  supporting: string
): IntelligencePerspectiveView {
  return emptyPerspective(
    id,
    "loading",
    LOADING_PRIMARY,
    supporting,
    "This result is loading.",
    false
  );
}

function errorPerspective(
  id: SurveillanceIntelligencePerspectiveId,
  supporting: string
): IntelligencePerspectiveView {
  return emptyPerspective(
    id,
    "error",
    ERROR_PRIMARY,
    supporting,
    "This request failed. A failed request is not an unavailable result and is not zero.",
    true
  );
}

/** Membership for the returned class id only. Index position is never used. */
export function classMembershipProbability(
  probabilities: readonly MembershipProbability[],
  classId: string
): number | null {
  const matches = probabilities.filter((entry) => entry.class_id === classId);
  const match = matches.length === 1 ? matches[0] : null;
  if (!match || !Number.isFinite(match.probability)) {
    return null;
  }
  return match.probability;
}

function unavailableReasonLabel(reason: SituationUnavailableReason): string {
  switch (reason) {
    case SituationVariantUnavailableReason.DEACTIVATED: {
      return "Deactivated";
    }
    case SituationVariantUnavailableReason.NOT_PUBLISHED: {
      return "Not published";
    }
    case SituationVariantUnavailableReason.UNAPPROVED_BATCH: {
      return "Unapproved batch";
    }
    case SituationVariantUnavailableReason.INCOMPATIBLE_RELEASE: {
      return "Incompatible release";
    }
    case SituationVariantUnavailableReason.MISSING_ASSIGNMENT: {
      return "No model assignment";
    }
    case null: {
      return UNAVAILABLE_PRIMARY;
    }
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

function compatibilityLabel(value: SituationCompatibility): string {
  switch (value) {
    case SituationVariantCompatibility.EXACT_INPUT: {
      return "Exact input";
    }
    case SituationVariantCompatibility.ADMITTED_CARRY_FORWARD: {
      return "Admitted carry forward";
    }
    case SituationVariantCompatibility.UNAVAILABLE: {
      return UNAVAILABLE_PRIMARY;
    }
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

function isScoredTier(tier: PriorityTier): tier is Exclude<PriorityTier, null> {
  switch (tier) {
    case Tier1CountyPriorityPriorityTier.HIGH:
    case Tier1CountyPriorityPriorityTier.MEDIUM:
    case Tier1CountyPriorityPriorityTier.LOW: {
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

function tier1NumbersCoherent(result: Tier1CountyPriority): boolean {
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

function sufficiencyFact(sufficiency: EvidenceSufficiency | null): string {
  if (sufficiency === null) {
    return "Evidence sufficiency not returned";
  }
  return `Evidence sufficiency ${sufficiencyLabel(sufficiency)}`;
}

function percentileFact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Percentile not returned";
  }
  return `Percentile ${formatPercentileOneDecimal(value)}`;
}

function mapGapScore(
  fips: string,
  state: GapScoreQueryState
): IntelligencePerspectiveView {
  const id = "gap-score" as const;
  if (state.release.status === "pending" || state.phase === "loading") {
    return loadingPerspective(id, GAP_SCORE_DESCRIPTOR);
  }
  if (state.release.status === "unknown" || state.phase === "idle") {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      GAP_SCORE_DESCRIPTOR,
      "The published Surveillance Gap Score is not shown because the governed release for this page is not known.",
      false
    );
  }
  if (state.phase === "error") {
    return errorPerspective(
      id,
      `${GAP_SCORE_DESCRIPTOR}. The published score request failed.`
    );
  }
  const collection = state.result;
  if (!collection || collection.release_id !== state.release.releaseId) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      GAP_SCORE_DESCRIPTOR,
      "The published score response did not match this page release, so no score is shown.",
      false
    );
  }
  const county =
    collection.counties.find((entry) => entry.fips === fips) ?? null;
  if (!county) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      GAP_SCORE_DESCRIPTOR,
      "No published Surveillance Gap Score was returned for this county.",
      false
    );
  }
  if (!county.in_contiguous_tick_scope) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      GAP_SCORE_DESCRIPTOR,
      "The published map score is unavailable outside the contiguous tick scope. That is not a score of zero.",
      false
    );
  }
  const score = county.score.score;
  if (!Number.isFinite(score)) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      GAP_SCORE_DESCRIPTOR,
      "No published Surveillance Gap Score was returned for this county.",
      false
    );
  }
  const formatted = formatPublishedGapScore(score);
  return {
    description: null,
    disclosure: [
      { label: "Method", value: collection.methodology_version },
      { label: "Release", value: collection.release_id },
    ],
    fields: [
      { label: "Published score", value: formatted },
      { label: "Descriptor", value: GAP_SCORE_DESCRIPTOR },
    ],
    fullValue: String(score),
    id,
    kind: "ready",
    label: SURVEILLANCE_INTELLIGENCE_LABELS[id],
    limitations: [],
    memberships: [],
    overview:
      "This is the published Surveillance Gap Score used by the map and county ranking.",
    primary: formatted,
    qualifier: null,
    reasons: [],
    reviewCategory: reviewCategoryTitle(county.color),
    retryable: false,
    situationPlain: null,
    swatch: county.color ?? null,
    sufficiency: null,
    supporting: GAP_SCORE_DESCRIPTOR,
    tier: null,
    track: boundedTrack(
      score,
      `Published Surveillance Gap Score ${formatted} out of 100`,
      formatted
    ),
  };
}

function unverifiedPerspective(
  id: SurveillanceIntelligencePerspectiveId
): IntelligencePerspectiveView {
  return emptyPerspective(
    id,
    "unverified",
    "Response could not be verified",
    "Response could not be verified",
    TIER1_UNVERIFIED_MESSAGE,
    false
  );
}

function mapTier1(
  fips: string,
  state: Tier1QueryState
): IntelligencePerspectiveView {
  const id = "ml-review-priority" as const;
  const supportingLoading = "Percentile and evidence sufficiency are loading.";
  if (state.phase === "loading") {
    return loadingPerspective(id, supportingLoading);
  }
  if (state.phase === "idle") {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      `${percentileFact(null)} · ${sufficiencyFact(null)}`,
      "ML review priority was not requested for this county identifier.",
      false
    );
  }
  if (state.phase === "error") {
    if (state.unverified) {
      return unverifiedPerspective(id);
    }
    if (state.errorStatus === 404) {
      return emptyPerspective(
        id,
        "unavailable",
        UNAVAILABLE_PRIMARY,
        `${percentileFact(null)} · ${sufficiencyFact(null)}`,
        "No persisted ML review priority was returned for this county. A missing result is not low priority.",
        false
      );
    }
    return errorPerspective(
      id,
      "Percentile and evidence sufficiency could not be loaded."
    );
  }
  const result = state.result;
  if (!result || result.county_fips !== fips) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      `${percentileFact(null)} · ${sufficiencyFact(null)}`,
      "This ML review priority did not match the selected county, so it was not shown.",
      false
    );
  }
  if (!tier1NumbersCoherent(result)) {
    logUnverifiedApiResponse({
      endpoint: `/v1/counties/${fips}/tier1-surveillance-priority`,
      fips,
      reason: TIER1_INCOHERENT_REASON,
    });
    return unverifiedPerspective(id);
  }
  const supporting = `${percentileFact(result.priority_percentile)} · ${sufficiencyFact(result.evidence_sufficiency)}`;
  const disclosure: IntelligenceField[] = [
    { label: "Model version", value: result.model_version },
    { label: "Model input release", value: result.release_id },
    { label: "Tier policy", value: result.tier_policy_version },
    { label: "Prediction batch", value: result.prediction_batch_version },
    { label: "Source commit", value: result.source_commit },
  ];
  if (result.raw_model_score !== null) {
    disclosure.push({
      label: "Model-native anomaly score (not a probability)",
      value: String(result.raw_model_score),
    });
  }
  const reasons = result.reasons.map((reason) => ({
    code: reason.code,
    text: reason.text,
  }));
  if (
    result.evidence_sufficiency ===
    Tier1CountyPriorityEvidenceSufficiency.NOT_ESTIMABLE
  ) {
    return {
      description: null,
      disclosure,
      fields: [
        { label: "Review tier", value: NOT_RETURNED },
        { label: "Percentile", value: NOT_RETURNED },
        {
          label: "Evidence sufficiency",
          value: sufficiencyLabel(result.evidence_sufficiency),
        },
      ],
      fullValue: null,
      id,
      kind: "ready",
      label: SURVEILLANCE_INTELLIGENCE_LABELS[id],
      limitations: [],
      memberships: [],
      overview:
        "This model abstained. Not estimable is not a low tier and is not a score of zero.",
      primary: "Not estimable",
      qualifier: `${PERCENTILE_QUALIFIER} ${SUFFICIENCY_QUALIFIER}`,
      reasons,
      reviewCategory: null,
      retryable: false,
      situationPlain: null,
      sufficiency: result.evidence_sufficiency,
      supporting,
      tier: null,
      track: null,
    };
  }
  if (!isScoredTier(result.priority_tier)) {
    return emptyPerspective(
      id,
      "unavailable",
      UNAVAILABLE_PRIMARY,
      supporting,
      "No review tier was returned for this county.",
      false
    );
  }
  return {
    description: null,
    disclosure,
    fields: [
      { label: "Review tier", value: result.priority_tier },
      {
        label: "Percentile",
        value:
          result.priority_percentile === null
            ? NOT_RETURNED
            : formatPercentileOneDecimal(result.priority_percentile),
      },
      {
        label: "Evidence sufficiency",
        value: sufficiencyLabel(result.evidence_sufficiency),
      },
    ],
    fullValue:
      result.priority_percentile === null
        ? null
        : String(result.priority_percentile),
    id,
    kind: "ready",
    label: SURVEILLANCE_INTELLIGENCE_LABELS[id],
    limitations: [],
    memberships: [],
    overview:
      "ML Review Priority is a model-assisted review tier. It is not disease risk.",
    primary: result.priority_tier,
    qualifier: `${PERCENTILE_QUALIFIER} ${SUFFICIENCY_QUALIFIER}`,
    reasons,
    reviewCategory: null,
    retryable: false,
    situationPlain: null,
    sufficiency: result.evidence_sufficiency,
    supporting,
    tier: result.priority_tier,
    track: boundedTrack(
      result.priority_percentile,
      result.priority_percentile === null
        ? "Within-batch percentile was not returned. Not a disease risk probability."
        : `Within-batch percentile ${formatPercentileOneDecimal(result.priority_percentile)} out of 100. Not a disease risk probability.`,
      result.priority_percentile === null
        ? NOT_RETURNED
        : formatPercentileOneDecimal(result.priority_percentile)
    ),
  };
}

const RELEASE_ASSEMBLED_PREFIX = "Governed county release assembled ";
const LOADING_MODEL_RESULT = "Loading model result…";
const MODEL_RESULT_UNAVAILABLE =
  "No model result is available for this county.";
const MODEL_RESULT_INCOMPATIBLE =
  "This model result cannot be shown with the data release used by this page.";
const MODEL_RESULT_FAILED = "The model result could not be loaded.";
const MODEL_RESULT_UNVERIFIED = "The model response could not be verified.";
const EXACT_RELEASE_SENTENCE =
  "Model results use the same data release as this page.";
const CARRY_FORWARD_SENTENCE =
  "These model results were produced using an earlier data release and approved for use with this page’s release.";

function plainUnavailableReason(reason: SituationUnavailableReason): string {
  switch (reason) {
    case SituationVariantUnavailableReason.DEACTIVATED: {
      return "This result was withdrawn.";
    }
    case SituationVariantUnavailableReason.NOT_PUBLISHED: {
      return "This result is not published.";
    }
    case SituationVariantUnavailableReason.UNAPPROVED_BATCH: {
      return "Publication of this result is not approved.";
    }
    case SituationVariantUnavailableReason.INCOMPATIBLE_RELEASE: {
      return MODEL_RESULT_INCOMPATIBLE;
    }
    case SituationVariantUnavailableReason.MISSING_ASSIGNMENT: {
      return "No group assignment is available.";
    }
    case null: {
      return MODEL_RESULT_UNAVAILABLE;
    }
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

function releaseDateSentence(releaseId: string, label: string): string | null {
  const described = describeReleaseAssembly(releaseId);
  if (!described.startsWith(RELEASE_ASSEMBLED_PREFIX)) {
    return null;
  }
  return `${label}: ${described.slice(RELEASE_ASSEMBLED_PREFIX.length)}.`;
}

function situationMethods(
  presentationReleaseId: string,
  variant: SituationVariant,
  classification: SituationClassification
): string[] {
  const inputReleaseId =
    variant.input_release_id ?? classification.input_release_id;
  if (variant.compatibility === SituationVariantCompatibility.EXACT_INPUT) {
    const date = releaseDateSentence(
      presentationReleaseId,
      "Data release used"
    );
    return date === null
      ? [EXACT_RELEASE_SENTENCE]
      : [EXACT_RELEASE_SENTENCE, date];
  }
  if (
    variant.compatibility ===
    SituationVariantCompatibility.ADMITTED_CARRY_FORWARD
  ) {
    const date = releaseDateSentence(
      inputReleaseId,
      "Data release used by the model"
    );
    return date === null
      ? [CARRY_FORWARD_SENTENCE]
      : [CARRY_FORWARD_SENTENCE, date];
  }
  return [];
}

function situationMembershipRows(
  classification: SituationClassification
): SituationPlainMembership[] | null {
  const selectedId = classification.class_id;
  const selectedCount = classification.probabilities.filter(
    (entry) => entry.class_id === selectedId
  ).length;
  const rows: SituationPlainMembership[] = [];
  for (const entry of classification.probabilities) {
    const copy = situationGroupCopy(
      classification.model_id,
      classification.model_version,
      entry.class_id
    );
    const text = Number.isFinite(entry.probability)
      ? formatPlainMembershipPercent(entry.probability)
      : null;
    if (!copy || text === null) {
      return null;
    }
    rows.push({
      assigned: selectedCount === 1 && entry.class_id === selectedId,
      classId: entry.class_id,
      label: copy.label,
      probability: entry.probability,
      text,
    });
  }
  return rows.sort((left, right) => {
    if (left.assigned !== right.assigned) {
      return left.assigned ? -1 : 1;
    }
    if (left.probability !== right.probability) {
      return right.probability - left.probability;
    }
    return left.classId.localeCompare(right.classId);
  });
}

function buildSituationPlain(
  presentationReleaseId: string,
  variant: SituationVariant,
  classification: SituationClassification
): SituationPlainView {
  const group = situationGroupCopy(
    classification.model_id,
    classification.model_version,
    classification.class_id
  );
  return {
    assignedLabel: group?.label ?? classification.class_name,
    groupMeaning: group?.meaning ?? classification.class_description,
    memberships: situationMembershipRows(classification),
    methods: situationMethods(presentationReleaseId, variant, classification),
    modelDescription:
      situationModelDescription(
        classification.model_id,
        classification.model_version
      ) ?? UNRECOGNIZED_MODEL_VERSION_DESCRIPTION,
    technical: membershipFields(classification),
  };
}

function situationStatus(
  id: SurveillanceIntelligencePerspectiveId,
  view: IntelligencePerspectiveView,
  overview: string
): IntelligencePerspectiveView {
  switch (id) {
    case "ecological-situation":
    case "surveillance-situation": {
      return { ...view, overview };
    }
    case "gap-score":
    case "ml-review-priority": {
      return view;
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

function membershipFields(
  classification: SituationClassification
): IntelligenceField[] {
  const selected = classMembershipProbability(
    classification.probabilities,
    classification.class_id
  );
  const fields: IntelligenceField[] = [
    { label: "Class", value: classification.class_name },
    { label: "Class id", value: classification.class_id },
  ];
  if (selected === null) {
    fields.push({
      label: "Selected class membership",
      value: MEMBERSHIP_NOT_RETURNED,
    });
  } else {
    fields.push({
      label: "Selected class membership",
      value: `${formatClassMembership(selected)} (full value ${formatFullProbability(selected)})`,
    });
  }
  for (const entry of classification.probabilities) {
    fields.push({
      label: `Class membership ${entry.class_id}`,
      value: `${formatClassMembership(entry.probability)} (full value ${formatFullProbability(entry.probability)})`,
    });
  }
  return fields;
}

function readProvenanceString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatProvenanceValue(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (!isPlainRecord(value)) {
    return NOT_RETURNED;
  }
  const source =
    readProvenanceString(value, "source_id") ??
    readProvenanceString(value, "source");
  const dataset = readProvenanceString(value, "dataset_id");
  const vintage =
    readProvenanceString(value, "vintage") ??
    readProvenanceString(value, "source_vintage");
  const parts = [
    source,
    dataset,
    vintage === null ? null : `vintage ${vintage}`,
  ].filter((part): part is string => part !== null);
  if (parts.length > 0) {
    return parts.join(" · ");
  }
  const primitives = Object.entries(value)
    .filter(
      (entry): entry is [string, boolean | number | string] =>
        typeof entry[1] === "string" ||
        typeof entry[1] === "number" ||
        typeof entry[1] === "boolean"
    )
    .map(([field, fieldValue]) => `${field} ${String(fieldValue)}`);
  return primitives.length > 0 ? primitives.join(" · ") : NOT_RETURNED;
}

function sourceProvenanceDisclosure(
  provenance: SituationClassification["source_provenance"]
): IntelligenceField[] {
  const entries = Object.entries(provenance);
  if (entries.length === 0) {
    return [{ label: "Source provenance", value: NOT_RETURNED }];
  }
  return entries.map(([key, value]) => ({
    label: `Source ${key}`,
    value: formatProvenanceValue(value),
  }));
}

function situationLineageDisclosure(
  presentationReleaseId: string,
  variant: SituationVariant,
  classification: SituationClassification | null
): IntelligenceField[] {
  const fields: IntelligenceField[] = [
    { label: "Presentation release", value: presentationReleaseId },
    {
      label: "Compatibility with presentation release",
      value: compatibilityLabel(variant.compatibility),
    },
    {
      label: "Input release",
      value:
        variant.input_release_id ??
        classification?.input_release_id ??
        NOT_RETURNED,
    },
  ];
  if (!classification) {
    return fields;
  }
  fields.push(
    { label: "Model version", value: classification.model_version },
    { label: "Batch", value: classification.batch_version },
    ...sourceProvenanceDisclosure(classification.source_provenance)
  );
  return fields;
}

function mapAvailableSituation(
  id: SurveillanceIntelligencePerspectiveId,
  presentationReleaseId: string,
  variant: SituationVariant,
  classification: SituationClassification
): IntelligencePerspectiveView {
  const membership = classMembershipProbability(
    classification.probabilities,
    classification.class_id
  );
  const plain = buildSituationPlain(
    presentationReleaseId,
    variant,
    classification
  );
  return {
    description: classification.class_description,
    disclosure: situationLineageDisclosure(
      presentationReleaseId,
      variant,
      classification
    ),
    fields: membershipFields(classification),
    fullValue: membership === null ? null : formatFullProbability(membership),
    id,
    kind: "ready",
    label: SURVEILLANCE_INTELLIGENCE_LABELS[id],
    limitations: classification.limitations,
    memberships: membershipBars(classification),
    overview: plain.modelDescription,
    primary: plain.assignedLabel,
    qualifier: CLASS_MEMBERSHIP_QUALIFIER,
    reasons: [],
    reviewCategory: null,
    retryable: false,
    situationPlain: plain,
    sufficiency: null,
    supporting:
      membership === null
        ? MEMBERSHIP_NOT_RETURNED
        : `Class membership ${formatClassMembership(membership)}`,
    tier: null,
    track: membershipTrack(membership),
  };
}

function mapSituationVariant(
  id: SurveillanceIntelligencePerspectiveId,
  presentationReleaseId: string,
  variant: SituationVariant,
  countyMatched: boolean
): IntelligencePerspectiveView {
  if (!countyMatched) {
    return situationStatus(
      id,
      emptyPerspective(
        id,
        "unavailable",
        UNAVAILABLE_PRIMARY,
        MEMBERSHIP_NOT_RETURNED,
        "This classification did not match the selected county, so it was not shown.",
        false
      ),
      MODEL_RESULT_UNAVAILABLE
    );
  }
  const incompatible =
    variant.unavailable_reason ===
      SituationVariantUnavailableReason.INCOMPATIBLE_RELEASE ||
    (variant.availability === SituationVariantAvailability.AVAILABLE &&
      variant.compatibility === SituationVariantCompatibility.UNAVAILABLE);
  if (incompatible) {
    return situationStatus(
      id,
      {
        ...emptyPerspective(
          id,
          "incompatible",
          INCOMPATIBLE_PRIMARY,
          "This model release is not compatible with the evidence release. Incompatible is not a class and is not zero.",
          "Compatibility is unavailable or the release is incompatible. No class is shown.",
          false
        ),
        disclosure: situationLineageDisclosure(
          presentationReleaseId,
          variant,
          null
        ),
      },
      MODEL_RESULT_INCOMPATIBLE
    );
  }
  if (variant.availability === SituationVariantAvailability.UNAVAILABLE) {
    const reason = unavailableReasonLabel(variant.unavailable_reason);
    return situationStatus(
      id,
      {
        ...emptyPerspective(
          id,
          "unavailable",
          UNAVAILABLE_PRIMARY,
          reason,
          `${reason}. No class was published for this model. Unavailable is not a class name and is not zero.`,
          false
        ),
        disclosure: situationLineageDisclosure(
          presentationReleaseId,
          variant,
          null
        ),
      },
      plainUnavailableReason(variant.unavailable_reason)
    );
  }
  if (!variant.data) {
    return situationStatus(
      id,
      emptyPerspective(
        id,
        "unavailable",
        UNAVAILABLE_PRIMARY,
        MEMBERSHIP_NOT_RETURNED,
        "No classification was returned for this model.",
        false
      ),
      "No group assignment is available."
    );
  }
  return mapAvailableSituation(
    id,
    presentationReleaseId,
    variant,
    variant.data
  );
}

function mapSituations(
  fips: string,
  state: SituationsQueryState
): [IntelligencePerspectiveView, IntelligencePerspectiveView] {
  const fourId = "surveillance-situation" as const;
  const tickId = "ecological-situation" as const;
  if (state.phase === "loading") {
    return [
      situationStatus(
        fourId,
        loadingPerspective(fourId, "Class membership is loading."),
        LOADING_MODEL_RESULT
      ),
      situationStatus(
        tickId,
        loadingPerspective(tickId, "Class membership is loading."),
        LOADING_MODEL_RESULT
      ),
    ];
  }
  if (state.phase === "idle") {
    return [
      situationStatus(
        fourId,
        emptyPerspective(
          fourId,
          "unavailable",
          UNAVAILABLE_PRIMARY,
          MEMBERSHIP_NOT_RETURNED,
          "Surveillance situation was not requested for this county identifier.",
          false
        ),
        MODEL_RESULT_UNAVAILABLE
      ),
      situationStatus(
        tickId,
        emptyPerspective(
          tickId,
          "unavailable",
          UNAVAILABLE_PRIMARY,
          MEMBERSHIP_NOT_RETURNED,
          "Ecological situation was not requested for this county identifier.",
          false
        ),
        MODEL_RESULT_UNAVAILABLE
      ),
    ];
  }
  if (state.phase === "error") {
    if (state.unverified) {
      return [
        situationStatus(
          fourId,
          unverifiedPerspective(fourId),
          MODEL_RESULT_UNVERIFIED
        ),
        situationStatus(
          tickId,
          unverifiedPerspective(tickId),
          MODEL_RESULT_UNVERIFIED
        ),
      ];
    }
    if (state.errorStatus === 404) {
      return [
        situationStatus(
          fourId,
          emptyPerspective(
            fourId,
            "unavailable",
            UNAVAILABLE_PRIMARY,
            MEMBERSHIP_NOT_RETURNED,
            "No surveillance situation was returned for this county.",
            false
          ),
          MODEL_RESULT_UNAVAILABLE
        ),
        situationStatus(
          tickId,
          emptyPerspective(
            tickId,
            "unavailable",
            UNAVAILABLE_PRIMARY,
            MEMBERSHIP_NOT_RETURNED,
            "No ecological situation was returned for this county.",
            false
          ),
          MODEL_RESULT_UNAVAILABLE
        ),
      ];
    }
    return [
      situationStatus(
        fourId,
        errorPerspective(fourId, "Class membership could not be loaded."),
        MODEL_RESULT_FAILED
      ),
      situationStatus(
        tickId,
        errorPerspective(tickId, "Class membership could not be loaded."),
        MODEL_RESULT_FAILED
      ),
    ];
  }
  const result = state.result;
  const lineageRelease = result?.release_id ?? NOT_RETURNED;
  if (!result || result.county_fips !== fips) {
    return [
      mapSituationVariant(
        fourId,
        lineageRelease,
        unavailableVariant("four-state"),
        false
      ),
      mapSituationVariant(
        tickId,
        lineageRelease,
        unavailableVariant("tick-pathogen"),
        false
      ),
    ];
  }
  return [
    mapSituationVariant(fourId, result.release_id, result.four_state, true),
    mapSituationVariant(tickId, result.release_id, result.tick_pathogen, true),
  ];
}

function unavailableVariant(modelId: string): SituationVariant {
  return {
    availability: SituationVariantAvailability.UNAVAILABLE,
    batch_id: null,
    batch_version: null,
    compatibility: SituationVariantCompatibility.UNAVAILABLE,
    data: null,
    input_release_id: null,
    model_id: modelId,
    unavailable_reason: SituationVariantUnavailableReason.NOT_PUBLISHED,
  };
}

/**
 * Four independent perspectives. There is no composite score and no
 * cross-model comparison.
 */
export function mapCountySurveillanceIntelligence(input: {
  fips: string;
  gapScore: GapScoreQueryState;
  situations: SituationsQueryState;
  tier1: Tier1QueryState;
}): IntelligencePerspectiveView[] {
  const situations = mapSituations(input.fips, input.situations);
  return [
    mapGapScore(input.fips, input.gapScore),
    mapTier1(input.fips, input.tier1),
    situations[0],
    situations[1],
  ];
}

export function intelligenceStatusAnnouncement(
  fips: string,
  perspectives: readonly IntelligencePerspectiveView[]
): string {
  if (perspectives.some((perspective) => perspective.kind === "loading")) {
    return `Loading county surveillance intelligence for FIPS ${fips}.`;
  }
  return `County surveillance intelligence updated for FIPS ${fips}.`;
}
