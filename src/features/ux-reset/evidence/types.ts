import type { ValueState } from "@/generated/models";

/** Top-level UX Reset availability (issue 409, UX Reset constitution). */
export const evidenceAvailabilityValues = {
  available: "available",
  limited: "limited",
  unavailable: "unavailable",
} as const;

export type EvidenceAvailability =
  (typeof evidenceAvailabilityValues)[keyof typeof evidenceAvailabilityValues];

/**
 * Governed reason codes rendered behind the three availability states.
 * Primary codes come from API `value_state`; `MATERIAL_LIMITATION` is derived
 * from non-empty observation limitations when availability is otherwise available.
 */
export type EvidenceReasonCode = ValueState | "MATERIAL_LIMITATION";

export type EvidenceTechnicalProvenance = {
  observationId?: string | null;
  provenanceRef?: string | null;
  releaseId?: string | null;
  methodologyVersion?: string | null;
  sourceId?: string | null;
  /** Human-readable evaluation time. Omit to leave the row out of this disclosure. */
  evaluatedAt?: string | null;
  /** Raw evaluation timestamp. Omit when this disclosure has no evaluation time. */
  evaluatedAtRaw?: string | null;
  /** Configuration identity for the result. Omit to leave the row out of this disclosure. */
  configurationSha256?: string | null;
};

/** Human-readable provenance fields shown beside evidence (default + inspect). */
export type EvidenceProvenanceModel = {
  sourceFamily: string;
  observationPeriod: string;
  /** Dataset or source vintage from API metadata (distinct from observation period). */
  datasetVintage?: string | null;
  evidenceType: string;
  /** First limitation for compact strip copy. */
  materialCaveat?: string | null;
  /** All governed limitations for provenance inspect. */
  limitations: string[];
  /** One-paragraph human summary retained for callers that quote provenance. */
  inspectSummary: string;
  /**
   * Per-reference provenance lines. Omit when the record has no evidence
   * references. These are not inferred source families or observation periods.
   */
  referenceLines?: readonly string[];
  /** Governed method narrative from `Observation.methodology`. */
  methodLabel?: string | null;
  /** Governed `methodology_version`. Blank values stay unset. */
  methodVersion?: string | null;
  /**
   * Formatted `source_published_at`. Null when the API omits it or the
   * timestamp cannot be read. This is not a staleness judgment.
   */
  sourcePublishedAt?: string | null;
  technical?: EvidenceTechnicalProvenance | null;
  sourceUrl?: string | null;
};

/** Typed domain representation consumed by Reset evidence UI. */
export type EvidenceObjectModel = {
  claimLabel: string;
  availability: EvidenceAvailability;
  reasonCode: EvidenceReasonCode;
  displayValue: string;
  valueNote?: string | null;
  provenance: EvidenceProvenanceModel;
};

/** Release-level context shared across Review, Explore, Investigate, and Compare. */
export type ReleaseEvidenceContextModel = {
  availability: EvidenceAvailability;
  releaseSummary: string;
  sourcePeriods: string;
  evidenceScope: string;
  methodologyLabel: string;
  limitation?: string | null;
};

/** Release strip load lifecycle (not an evidence availability state). */
export const releaseEvidenceLoadStateValues = {
  error: "error",
  loading: "loading",
  ready: "ready",
} as const;

export type ReleaseEvidenceLoadState =
  (typeof releaseEvidenceLoadStateValues)[keyof typeof releaseEvidenceLoadStateValues];
