import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import type { ExploreTimeBound } from "@/features/ux-reset/explore/explore-model";
import type { KnownEmptyObservationSelection } from "@/features/ux-reset/observations/selection-availability";
import {
  ValueState,
  type Geography,
  type Measure,
  type Observation,
} from "@/generated/models";
import { isCountyFips } from "@/lib/county-geography";

/**
 * Explicit family allowlist. A non-empty `domain` is authoritative. Unknown
 * domain tokens such as `climate` stay unclassified. A blank domain uses the
 * governed indicator id allowlist below. Conflicting domains, an indicator
 * seen only on another release, and an indicator id omitted from a successful
 * response stay unclassified. Do not infer a family from a label.
 */

/**
 * Whether the observation bundle was built from a loaded measure catalog.
 * `withheld` is a failed catalog. A synthetic bundle may render a finding.
 * It does not satisfy a handoff that requires loaded observations.
 */
export const countyEvidenceLoadStates = {
  loaded: "loaded",
  withheld: "withheld",
} as const;

export type CountyEvidenceLoadState =
  (typeof countyEvidenceLoadStates)[keyof typeof countyEvidenceLoadStates];

export function countyObservationsLoaded(
  state: CountyEvidenceLoadState
): boolean {
  switch (state) {
    case countyEvidenceLoadStates.loaded: {
      return true;
    }
    case countyEvidenceLoadStates.withheld: {
      return false;
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
export const INVESTIGATE_DOMAIN_HUMAN = "human" as const;
export const INVESTIGATE_DOMAIN_VECTOR = "vector" as const;
export const INVESTIGATE_DOMAIN_PATHOGEN = "pathogen" as const;
export const INVESTIGATE_DOMAIN_ENVIRONMENTAL = "environmental" as const;
export const INVESTIGATE_DOMAIN_POPULATION = "population" as const;

const INVESTIGATE_INDICATOR_FAMILIES = {
  human_disease_burden: "human",
  pathogen_surveillance: "vector_pathogen",
  population_context: "environmental_population",
  rurality_context: "environmental_population",
  tick_surveillance: "vector_pathogen",
} as const;

export const investigateEvidenceFamilyIds = [
  "human",
  "vector_pathogen",
  "environmental_population",
] as const;

export type InvestigateEvidenceFamilyId =
  (typeof investigateEvidenceFamilyIds)[number];

/** Domains used for family assignment. Unresolved ids must not use the id allowlist. */
export type IndicatorDomainIndex = {
  domains: ReadonlyMap<string, string | null>;
  unresolvedIds: ReadonlySet<string>;
};

export const investigateEvidenceClassValues = {
  contextual: "contextual",
  observed: "observed",
} as const;

export type InvestigateEvidenceClass =
  (typeof investigateEvidenceClassValues)[keyof typeof investigateEvidenceClassValues];

export const INVESTIGATE_EVIDENCE_FAMILIES: readonly {
  contextNote: string;
  evidenceClass: InvestigateEvidenceClass;
  id: InvestigateEvidenceFamilyId;
  label: string;
}[] = [
  {
    contextNote:
      "Observed or published human surveillance. Missing or unknown is not zero.",
    evidenceClass: investigateEvidenceClassValues.observed,
    id: "human",
    label: "Human surveillance",
  },
  {
    contextNote:
      "Observed or published vector and pathogen evidence. No record is not absence.",
    evidenceClass: investigateEvidenceClassValues.observed,
    id: "vector_pathogen",
    label: "Vector and pathogen",
  },
  {
    contextNote:
      "Environmental and population evidence is context for interpretation. It does not establish that those conditions caused disease.",
    evidenceClass: investigateEvidenceClassValues.contextual,
    id: "environmental_population",
    label: "Environmental and population",
  },
];

export type InvestigateCountySelection =
  | { kind: "county"; fips: string }
  | { kind: "malformed" }
  | { kind: "missing" };

export type InvestigateContractCode =
  | "identity_mismatch"
  | "rejected"
  | "release_mismatch"
  | "unknown_county";

export class InvestigateContractError extends Error {
  readonly code: InvestigateContractCode;

  constructor(message: string, code: InvestigateContractCode) {
    super(message);
    this.name = "InvestigateContractError";
    this.code = code;
  }
}

export type ResolvedCountyIdentity = {
  fips: string;
  label: string;
  stateCode: string | null;
};

export type CountyEvidenceObservation = {
  evidence: EvidenceObjectModel;
  familyId: InvestigateEvidenceFamilyId | null;
  indicatorDomain: string | null;
  indicatorId: string;
  measureId: string;
  measureLabel: string;
  observation: Observation;
};

export type CountyEvidenceMeasureFailure = {
  measureId: string;
  measureLabel: string;
  message: string;
  /** Epoch ms when a server Retry-After allows the next read. Null when none. */
  retryAtMs: number | null;
  /**
   * False when the API settled the read as absence, such as a 404 for a
   * measure with no published observations. Those reads are not retried.
   */
  retryable?: boolean;
};

export type CountyEvidenceFamilySection = {
  contextNote: string;
  evidenceClass: InvestigateEvidenceClass;
  id: InvestigateEvidenceFamilyId;
  label: string;
  /** Measures in this release whose governed family is this section. */
  measureIds: readonly string[];
  observations: readonly CountyEvidenceObservation[];
};

export type InvestigateEvidenceConflict = {
  measureId: string;
  measureLabel: string;
  observationCount: number;
};

/** What disagrees inside one period. Non-value states do not count as values. */
export type PeriodDisagreement = "both" | "states" | "values";

/** One same-period disagreement. Counts do not span periods. */
export type InvestigatePeriodConflict = InvestigateEvidenceConflict & {
  disagreement: PeriodDisagreement;
  periodEnd: string;
  periodStart: string;
  temporalGrain: string | null;
};

/**
 * Governed county evidence bundle shared by Investigate and later Reset
 * handoffs. Each observation keeps its own identity, period, availability,
 * and limitations.
 */
export type CountyEvidenceBundle = {
  county: ResolvedCountyIdentity;
  domainsRequestFailed: boolean;
  families: readonly CountyEvidenceFamilySection[];
  leadFinding: CountyEvidenceObservation | null;
  leadLimitation: {
    observation: CountyEvidenceObservation;
    text: string;
  } | null;
  knownEmptySelections: readonly KnownEmptyObservationSelection[];
  measureFailures: readonly CountyEvidenceMeasureFailure[];
  readyMeasureIds: readonly string[];
  releaseId: string;
  unassigned: readonly CountyEvidenceObservation[];
  unclassifiedMeasureIds: readonly string[];
  unsupportedPeriodMeasureIds: readonly string[];
};

/** Observation series was not requested because the measure catalog failed. */
export function investigateBundleWithoutObservations(input: {
  county: ResolvedCountyIdentity;
  releaseId: string;
}): CountyEvidenceBundle {
  return {
    county: input.county,
    domainsRequestFailed: false,
    families: INVESTIGATE_EVIDENCE_FAMILIES.map((family) => ({
      contextNote: family.contextNote,
      evidenceClass: family.evidenceClass,
      id: family.id,
      label: family.label,
      measureIds: [],
      observations: [],
    })),
    knownEmptySelections: [],
    leadFinding: null,
    leadLimitation: null,
    measureFailures: [],
    readyMeasureIds: [],
    releaseId: input.releaseId,
    unassigned: [],
    unclassifiedMeasureIds: [],
    unsupportedPeriodMeasureIds: [],
  };
}

export type MeasureObservationOutcome =
  | {
      measureId: string;
      observations: readonly Observation[];
      selectionAvailability?: KnownEmptyObservationSelection | null;
      status: "ready";
    }
  | {
      measureId: string;
      message: string;
      retryAtMs: number | null;
      retryable?: boolean;
      status: "failed";
    }
  | {
      measureId: string;
      status: "unsupported_period";
    };

const STATE_FIPS = /^\d{2}$/;

export type FamilyPublication =
  | "assigned"
  | "classification_unknown"
  | "domains_unavailable"
  | "empty"
  | "not_in_release"
  | "request_failed"
  | "unsupported_period"
  | "unreadable";

export type CountyEvidenceGap =
  | "failed"
  | "mixed"
  | "returned_empty"
  | "unsupported_period";

/**
 * Empty query means the user has not chosen a county. Any other value that is
 * not exactly one canonical FIPS is malformed and must not fall through to a
 * different county.
 */
export function classifyInvestigateCountySelection(
  values: readonly string[]
): InvestigateCountySelection {
  if (values.length === 0) {
    return { kind: "missing" };
  }
  const parsed: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!isCountyFips(trimmed)) {
      return { kind: "malformed" };
    }
    if (!parsed.includes(trimmed)) {
      parsed.push(trimmed);
    }
  }
  if (parsed.length !== 1) {
    return { kind: "malformed" };
  }
  return { kind: "county", fips: parsed[0] ?? "" };
}

export function evidenceFamilyFromIndicatorDomain(
  domain: string | null | undefined
): InvestigateEvidenceFamilyId | null {
  switch (domain?.trim()) {
    case INVESTIGATE_DOMAIN_HUMAN: {
      return "human";
    }
    case INVESTIGATE_DOMAIN_PATHOGEN:
    case INVESTIGATE_DOMAIN_VECTOR: {
      return "vector_pathogen";
    }
    case INVESTIGATE_DOMAIN_ENVIRONMENTAL:
    case INVESTIGATE_DOMAIN_POPULATION: {
      return "environmental_population";
    }
    default: {
      return null;
    }
  }
}

/** Blank domains use the governed indicator id. A label is never a family. */
export function evidenceFamilyFromIndicatorId(
  indicatorId: string | null | undefined
): InvestigateEvidenceFamilyId | null {
  const id = indicatorId?.trim() ?? "";
  switch (id) {
    case "human_disease_burden":
    case "pathogen_surveillance":
    case "population_context":
    case "rurality_context":
    case "tick_surveillance": {
      return INVESTIGATE_INDICATOR_FAMILIES[id];
    }
    default: {
      return null;
    }
  }
}

/**
 * A non-empty domain wins, including unknown tokens that stay unclassified.
 * A blank domain, or a failed indicator request, uses the indicator id.
 * That fallback still assigns allowlisted ids. The indicator request failure
 * is disclosed on its own and does not depend on family publication.
 * Unresolved metadata stays unclassified and does not use that id fallback:
 * conflicting domains, a release that was withheld, or an indicator id that
 * a successful response omitted. An omitted id is not an explicit blank domain.
 */
export function evidenceFamilyForMeasure(input: {
  domain: string | null | undefined;
  domainUnresolved?: boolean;
  domainsRequestFailed: boolean;
  indicatorId: string;
  /** True when a successful indicator response has no record for this id. */
  indicatorOmitted?: boolean;
}): InvestigateEvidenceFamilyId | null {
  if (
    (input.domainUnresolved || input.indicatorOmitted) &&
    !input.domainsRequestFailed
  ) {
    return null;
  }
  if (!input.domainsRequestFailed) {
    const domain = input.domain?.trim() ?? "";
    if (domain) {
      return evidenceFamilyFromIndicatorDomain(domain);
    }
  }
  return evidenceFamilyFromIndicatorId(input.indicatorId);
}

function familyForIndicator(input: {
  domainsRequestFailed: boolean;
  indicatorDomains: IndicatorDomainIndex;
  indicatorId: string;
}): InvestigateEvidenceFamilyId | null {
  const recorded = input.indicatorDomains.domains.has(input.indicatorId);
  return evidenceFamilyForMeasure({
    domain: recorded
      ? input.indicatorDomains.domains.get(input.indicatorId)
      : undefined,
    domainUnresolved: input.indicatorDomains.unresolvedIds.has(
      input.indicatorId
    ),
    domainsRequestFailed: input.domainsRequestFailed,
    indicatorId: input.indicatorId,
    indicatorOmitted: !recorded,
  });
}

export function resolveCountyIdentity(
  geography: Geography,
  requestedFips: string
): ResolvedCountyIdentity {
  const identity = geography.geography;
  if (
    identity.geography_type !== "county" ||
    identity.geography_id !== requestedFips ||
    !isCountyFips(identity.geography_id)
  ) {
    throw new InvestigateContractError(
      "Geography response does not match the requested county.",
      "identity_mismatch"
    );
  }
  const label = geography.label.trim();
  if (!label) {
    throw new InvestigateContractError(
      "Geography response did not include a county name.",
      "identity_mismatch"
    );
  }
  const parent = geography.parent;
  if (
    parent &&
    (parent.geography_type !== "state" ||
      !STATE_FIPS.test(parent.geography_id.trim()))
  ) {
    throw new InvestigateContractError(
      "Geography parent is not a two-digit state FIPS.",
      "identity_mismatch"
    );
  }
  return {
    fips: identity.geography_id,
    label,
    stateCode: null,
  };
}

/**
 * County name and state from the published score directory. That list is the
 * delivered identity contract. `/v1/geographies/{type}/{id}` is still pending
 * and responds 503, so it is not used to open a county.
 */
export function identityFromPublishedCounty(input: {
  county: string;
  fips: string;
  state: string;
}): ResolvedCountyIdentity | null {
  if (!isCountyFips(input.fips)) {
    return null;
  }
  const label = input.county.trim();
  if (!label) {
    return null;
  }
  const stateCode = input.state.trim();
  return {
    fips: input.fips,
    label,
    stateCode: stateCode || null,
  };
}

export function investigateFamilyPublication(input: {
  domainsRequestFailed: boolean;
  failedMeasureIds: ReadonlySet<string>;
  hasUnclassifiedMeasures: boolean;
  measureIds: readonly string[];
  observationCount: number;
  unsupportedMeasureIds: ReadonlySet<string>;
}): FamilyPublication {
  if (
    input.domainsRequestFailed &&
    input.measureIds.length === 0 &&
    input.observationCount === 0
  ) {
    return "domains_unavailable";
  }
  if (input.measureIds.length === 0) {
    return input.hasUnclassifiedMeasures
      ? "classification_unknown"
      : "not_in_release";
  }
  if (input.observationCount > 0) {
    return "assigned";
  }
  const failed = input.measureIds.every((measureId) =>
    input.failedMeasureIds.has(measureId)
  );
  const unsupported = input.measureIds.every((measureId) =>
    input.unsupportedMeasureIds.has(measureId)
  );
  const blocked = input.measureIds.every(
    (measureId) =>
      input.failedMeasureIds.has(measureId) ||
      input.unsupportedMeasureIds.has(measureId)
  );
  if (failed) {
    return "request_failed";
  }
  if (unsupported) {
    return "unsupported_period";
  }
  if (blocked) {
    return "unreadable";
  }
  return "empty";
}

/** Why the page has no lead finding. A failed or unsent query is not "unpublished". */
export function countyEvidenceGap(
  bundle: Pick<
    CountyEvidenceBundle,
    | "leadFinding"
    | "measureFailures"
    | "readyMeasureIds"
    | "unsupportedPeriodMeasureIds"
  >
): CountyEvidenceGap | null {
  if (bundle.leadFinding) {
    return null;
  }
  const ready = bundle.readyMeasureIds.length;
  const failed = bundle.measureFailures.length;
  const unsupported = bundle.unsupportedPeriodMeasureIds.length;
  if (ready === 0 && failed > 0 && unsupported === 0) {
    return "failed";
  }
  if (ready === 0 && unsupported > 0 && failed === 0) {
    return "unsupported_period";
  }
  if (ready === 0 && failed > 0 && unsupported > 0) {
    return "mixed";
  }
  return "returned_empty";
}

function observationInsideTimeBound(
  observation: Observation,
  timeBound: ExploreTimeBound
): boolean {
  const start = observation.period_start;
  const end = observation.period_end;
  switch (timeBound.kind) {
    case "year": {
      const firstDay = `${timeBound.year}-01-01`;
      const lastDay = `${timeBound.year}-12-31`;
      return start >= firstDay && end <= lastDay && start <= end;
    }
    case "day": {
      return start === timeBound.date && end === timeBound.date;
    }
    default: {
      const exhaustive: never = timeBound;
      return exhaustive;
    }
  }
}

/**
 * Accept a measure page only when every row is the requested county, measure,
 * and release, and its own period falls inside the requested time bound.
 * Distinct observation ids are preserved. A repeated id or a foreign county
 * fails the measure instead of being displayed.
 */
export function acceptCountyObservations(input: {
  measureId: string;
  observations: readonly Observation[];
  releaseId: string;
  requestedFips: string;
  timeBound: ExploreTimeBound;
}): Observation[] {
  const seenIds = new Set<string>();
  const accepted: Observation[] = [];
  for (const observation of input.observations) {
    if (observation.measure_id !== input.measureId) {
      throw new InvestigateContractError(
        "Observation measure does not match the request.",
        "identity_mismatch"
      );
    }
    if (observation.release_id !== input.releaseId) {
      throw new InvestigateContractError(
        "Observation release does not match the requested release.",
        "release_mismatch"
      );
    }
    if (
      observation.geography.geography_type !== "county" ||
      observation.geography.geography_id !== input.requestedFips
    ) {
      throw new InvestigateContractError(
        "Observation geography does not match the requested county.",
        "identity_mismatch"
      );
    }
    if (!observationInsideTimeBound(observation, input.timeBound)) {
      throw new InvestigateContractError(
        "Observation period is outside the requested time bound.",
        "identity_mismatch"
      );
    }
    if (
      !observation.observation_id ||
      seenIds.has(observation.observation_id)
    ) {
      throw new InvestigateContractError(
        "Observation response repeats an observation identity.",
        "identity_mismatch"
      );
    }
    seenIds.add(observation.observation_id);
    accepted.push(observation);
  }
  return accepted;
}

function compareObservations(
  left: CountyEvidenceObservation,
  right: CountyEvidenceObservation
): number {
  return (
    left.measureLabel.localeCompare(right.measureLabel, "en") ||
    left.observation.period_start.localeCompare(
      right.observation.period_start
    ) ||
    left.observation.observation_id.localeCompare(
      right.observation.observation_id
    )
  );
}

function orderedRecords(
  byFamily: ReadonlyMap<
    InvestigateEvidenceFamilyId,
    CountyEvidenceObservation[]
  >,
  unassigned: readonly CountyEvidenceObservation[]
): CountyEvidenceObservation[] {
  const ordered: CountyEvidenceObservation[] = [];
  for (const family of INVESTIGATE_EVIDENCE_FAMILIES) {
    const records = byFamily.get(family.id) ?? [];
    ordered.push(...records.toSorted(compareObservations));
  }
  ordered.push(...unassigned.toSorted(compareObservations));
  return ordered;
}

export function selectLeadFinding(
  records: readonly CountyEvidenceObservation[]
): CountyEvidenceObservation | null {
  const available = records.find(
    (record) =>
      record.evidence.availability === evidenceAvailabilityValues.available
  );
  if (available) {
    return available;
  }
  return (
    records.find(
      (record) =>
        record.evidence.availability === evidenceAvailabilityValues.limited
    ) ?? null
  );
}

function visibleBundleRecords(
  bundle: Pick<CountyEvidenceBundle, "families" | "unassigned">
): CountyEvidenceObservation[] {
  const records: CountyEvidenceObservation[] = [];
  for (const family of bundle.families) {
    records.push(...family.observations);
  }
  records.push(...bundle.unassigned);
  return records;
}

function observationsByMeasure(
  bundle: Pick<CountyEvidenceBundle, "families" | "unassigned">
): Map<string, CountyEvidenceObservation[]> {
  const grouped = new Map<string, CountyEvidenceObservation[]>();
  for (const record of visibleBundleRecords(bundle)) {
    const existing = grouped.get(record.measureId);
    if (existing) {
      existing.push(record);
      continue;
    }
    grouped.set(record.measureId, [record]);
  }
  return grouped;
}

function periodBasis(record: CountyEvidenceObservation): string {
  return `${record.observation.period_start}..${record.observation.period_end}`;
}

const VALUE_BEARING_STATES: ReadonlySet<ValueState> = new Set([
  ValueState.OBSERVED,
  ValueState.ZERO,
]);

/**
 * Raw payload for states that publish a value. Missing, unavailable, and
 * suppressed rows may carry a placeholder; that payload is not a value.
 */
function valueBearingKey(record: CountyEvidenceObservation): string | null {
  if (!VALUE_BEARING_STATES.has(record.observation.value_state)) {
    return null;
  }
  const value = record.observation.value;
  if (value === null) {
    return "null";
  }
  return typeof value === "number" ? `number:${value}` : `string:${value}`;
}

/**
 * Values differ only among observed and zero rows. States differ whenever
 * the period mixes value states, including missing versus unavailable.
 */
function classifyPeriodDisagreement(
  records: readonly CountyEvidenceObservation[]
): PeriodDisagreement | null {
  const states = new Set(
    records.map((record) => record.observation.value_state)
  );
  const values = new Set<string>();
  for (const record of records) {
    const key = valueBearingKey(record);
    if (key !== null) {
      values.add(key);
    }
  }
  const valuesDiffer = values.size > 1;
  const statesDiffer = states.size > 1;
  if (valuesDiffer && statesDiffer) {
    return "both";
  }
  if (valuesDiffer) {
    return "values";
  }
  if (statesDiffer) {
    return "states";
  }
  return null;
}

/**
 * One entry per period whose rows do not share a raw value and value state.
 * Display text is not the comparison: formatting can hide a real difference.
 * A later period is a separate entry, not an addition to this count.
 */
function periodDisagreements(
  records: readonly CountyEvidenceObservation[]
): InvestigatePeriodConflict[] {
  const byPeriod = new Map<string, CountyEvidenceObservation[]>();
  for (const record of records) {
    const key = periodBasis(record);
    const existing = byPeriod.get(key);
    if (existing) {
      existing.push(record);
      continue;
    }
    byPeriod.set(key, [record]);
  }
  const conflicts: InvestigatePeriodConflict[] = [];
  for (const periodRecords of byPeriod.values()) {
    const [first] = periodRecords;
    if (!first || periodRecords.length < 2) {
      continue;
    }
    const disagreement = classifyPeriodDisagreement(periodRecords);
    if (!disagreement) {
      continue;
    }
    conflicts.push({
      disagreement,
      measureId: first.measureId,
      measureLabel: first.measureLabel,
      observationCount: periodRecords.length,
      periodEnd: first.observation.period_end,
      periodStart: first.observation.period_start,
      temporalGrain: first.observation.temporal_grain,
    });
  }
  return conflicts;
}

function byMeasureLabel(
  left: InvestigateEvidenceConflict,
  right: InvestigateEvidenceConflict
): number {
  return (
    left.measureLabel.localeCompare(right.measureLabel, "en") ||
    left.measureId.localeCompare(right.measureId)
  );
}

function byPeriodConflict(
  left: InvestigatePeriodConflict,
  right: InvestigatePeriodConflict
): number {
  return (
    byMeasureLabel(left, right) ||
    left.periodStart.localeCompare(right.periodStart) ||
    left.periodEnd.localeCompare(right.periodEnd)
  );
}

/**
 * Same measure and period, with a different raw value or value state. Each
 * disagreeing period is its own count. A series across periods is not a
 * conflict, and equal raw values in the same state are not a conflict.
 * Display formatting stays on the card. This does not choose or average the
 * rows.
 */
export function investigateEvidenceConflicts(
  bundle: Pick<CountyEvidenceBundle, "families" | "unassigned">
): InvestigatePeriodConflict[] {
  const conflicts: InvestigatePeriodConflict[] = [];
  for (const records of observationsByMeasure(bundle).values()) {
    conflicts.push(...periodDisagreements(records));
  }
  return conflicts.toSorted(byPeriodConflict);
}

/**
 * More than one observation for a measure, without a same-period disagreement.
 * These stay separate and are not called conflicts.
 */
export function investigateMultipleObservations(
  bundle: Pick<CountyEvidenceBundle, "families" | "unassigned">
): InvestigateEvidenceConflict[] {
  const conflictIds = new Set(
    investigateEvidenceConflicts(bundle).map((conflict) => conflict.measureId)
  );
  const multiples: InvestigateEvidenceConflict[] = [];
  for (const [measureId, records] of observationsByMeasure(bundle)) {
    const [first] = records;
    if (records.length < 2 || !first || conflictIds.has(measureId)) {
      continue;
    }
    multiples.push({
      measureId,
      measureLabel: first.measureLabel,
      observationCount: records.length,
    });
  }
  return multiples.toSorted(byMeasureLabel);
}

export function selectLeadLimitation(
  records: readonly CountyEvidenceObservation[]
): { observation: CountyEvidenceObservation; text: string } | null {
  for (const record of records) {
    const text = record.evidence.provenance.limitations[0]?.trim();
    if (text) {
      return { observation: record, text };
    }
  }
  return null;
}

function measureLabel(measures: readonly Measure[], measureId: string): string {
  return (
    measures.find((measure) => measure.measure_id === measureId)?.label ??
    measureId
  );
}

/**
 * Ready and unsent outcomes that can be kept while failed measures are retried.
 * Failed measures are omitted so the next load requests only those.
 */
export type MeasureRetryCooldown = {
  measureId: string;
  retryAtMs: number;
};

/** Deadlines for failed measures. A later retry of the same bundle must wait. */
export function retryCooldownsFromBundle(
  bundle: CountyEvidenceBundle
): MeasureRetryCooldown[] {
  const cooldowns: MeasureRetryCooldown[] = [];
  for (const failure of bundle.measureFailures) {
    if (failure.retryAtMs !== null) {
      cooldowns.push({
        measureId: failure.measureId,
        retryAtMs: failure.retryAtMs,
      });
    }
  }
  return cooldowns;
}

export function reusableMeasureOutcomes(
  bundle: CountyEvidenceBundle
): MeasureObservationOutcome[] {
  const knownEmptyByMeasure = new Map(
    bundle.knownEmptySelections.map((selection) => [
      selection.measureId,
      selection,
    ])
  );
  const observationsByMeasure = new Map<string, Observation[]>();
  const records = [
    ...bundle.families.flatMap((family) => [...family.observations]),
    ...bundle.unassigned,
  ];
  for (const record of records) {
    const existing = observationsByMeasure.get(record.measureId);
    if (existing) {
      existing.push(record.observation);
      continue;
    }
    observationsByMeasure.set(record.measureId, [record.observation]);
  }
  const outcomes: MeasureObservationOutcome[] = [];
  for (const measureId of bundle.readyMeasureIds) {
    outcomes.push({
      measureId,
      observations: observationsByMeasure.get(measureId) ?? [],
      selectionAvailability: knownEmptyByMeasure.get(measureId) ?? null,
      status: "ready",
    });
  }
  for (const measureId of bundle.unsupportedPeriodMeasureIds) {
    outcomes.push({
      measureId,
      status: "unsupported_period",
    });
  }
  return outcomes;
}

export function buildCountyEvidenceBundle(input: {
  domainsRequestFailed: boolean;
  identity: ResolvedCountyIdentity;
  indicatorDomains: IndicatorDomainIndex;
  measures: readonly Measure[];
  outcomes: readonly MeasureObservationOutcome[];
  releaseId: string;
}): CountyEvidenceBundle {
  const measuresById = new Map(
    input.measures.map((measure) => [measure.measure_id, measure])
  );
  const familyMeasures = new Map<InvestigateEvidenceFamilyId, string[]>();
  for (const family of INVESTIGATE_EVIDENCE_FAMILIES) {
    familyMeasures.set(family.id, []);
  }
  for (const measure of input.measures) {
    const familyId = familyForIndicator({
      domainsRequestFailed: input.domainsRequestFailed,
      indicatorDomains: input.indicatorDomains,
      indicatorId: measure.indicator_id,
    });
    if (!familyId) {
      continue;
    }
    familyMeasures.get(familyId)?.push(measure.measure_id);
  }

  const byFamily = new Map<
    InvestigateEvidenceFamilyId,
    CountyEvidenceObservation[]
  >();
  for (const family of INVESTIGATE_EVIDENCE_FAMILIES) {
    byFamily.set(family.id, []);
  }
  const unclassifiedMeasureIds: string[] = [];
  for (const measure of input.measures) {
    const familyId = familyForIndicator({
      domainsRequestFailed: input.domainsRequestFailed,
      indicatorDomains: input.indicatorDomains,
      indicatorId: measure.indicator_id,
    });
    if (!familyId) {
      unclassifiedMeasureIds.push(measure.measure_id);
    }
  }
  const unassigned: CountyEvidenceObservation[] = [];
  const knownEmptySelections: KnownEmptyObservationSelection[] = [];
  const measureFailures: CountyEvidenceMeasureFailure[] = [];
  const readyMeasureIds: string[] = [];
  const unsupportedPeriodMeasureIds: string[] = [];

  for (const outcome of input.outcomes) {
    switch (outcome.status) {
      case "failed": {
        measureFailures.push({
          measureId: outcome.measureId,
          measureLabel: measureLabel(input.measures, outcome.measureId),
          message: outcome.message,
          retryAtMs: outcome.retryAtMs,
          retryable: outcome.retryable,
        });
        break;
      }
      case "unsupported_period": {
        unsupportedPeriodMeasureIds.push(outcome.measureId);
        break;
      }
      case "ready": {
        readyMeasureIds.push(outcome.measureId);
        if (
          outcome.observations.length === 0 &&
          outcome.selectionAvailability
        ) {
          knownEmptySelections.push(outcome.selectionAvailability);
        }
        const measure = measuresById.get(outcome.measureId);
        const indicatorId = measure?.indicator_id ?? "";
        // A missing map entry is unresolved, not an explicit blank domain.
        // Family assignment records that omission. This display field stays null.
        const indicatorDomain =
          input.domainsRequestFailed ||
          !input.indicatorDomains.domains.has(indicatorId)
            ? null
            : (input.indicatorDomains.domains.get(indicatorId) ?? null);
        const familyId = measure
          ? familyForIndicator({
              domainsRequestFailed: input.domainsRequestFailed,
              indicatorDomains: input.indicatorDomains,
              indicatorId,
            })
          : null;
        for (const observation of outcome.observations) {
          if (observation.geography.geography_id !== input.identity.fips) {
            throw new InvestigateContractError(
              "Bundle observation does not match the county identity.",
              "identity_mismatch"
            );
          }
          const record: CountyEvidenceObservation = {
            evidence: evidenceObjectFromObservation({
              claimLabel: measure?.label ?? outcome.measureId,
              measureType: measure?.measure_type,
              observation,
            }),
            familyId,
            indicatorDomain,
            indicatorId,
            measureId: outcome.measureId,
            measureLabel: measure?.label ?? outcome.measureId,
            observation,
          };
          if (familyId) {
            byFamily.get(familyId)?.push(record);
          } else {
            unassigned.push(record);
          }
        }
        break;
      }
      default: {
        const exhaustive: never = outcome;
        return exhaustive;
      }
    }
  }

  const records = orderedRecords(byFamily, unassigned);
  const families: CountyEvidenceFamilySection[] =
    INVESTIGATE_EVIDENCE_FAMILIES.map((family) => ({
      contextNote: family.contextNote,
      evidenceClass: family.evidenceClass,
      id: family.id,
      label: family.label,
      measureIds: familyMeasures.get(family.id) ?? [],
      observations: (byFamily.get(family.id) ?? []).toSorted(
        compareObservations
      ),
    }));

  return {
    county: input.identity,
    domainsRequestFailed: input.domainsRequestFailed,
    families,
    knownEmptySelections,
    leadFinding: selectLeadFinding(records),
    leadLimitation: selectLeadLimitation(records),
    measureFailures,
    readyMeasureIds,
    releaseId: input.releaseId,
    unassigned: unassigned.toSorted(compareObservations),
    unclassifiedMeasureIds,
    unsupportedPeriodMeasureIds,
  };
}

/** Display a bundle only when it is the county and release currently requested. */
export function countyEvidenceForRequest(
  bundle: CountyEvidenceBundle | null | undefined,
  requested: { fips: string | null; releaseId: string | null }
): CountyEvidenceBundle | null {
  if (!(bundle && requested.fips && requested.releaseId)) {
    return null;
  }
  if (
    bundle.county.fips !== requested.fips ||
    bundle.releaseId !== requested.releaseId
  ) {
    return null;
  }
  return bundle;
}
