import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import type { ExploreTimeBound } from "@/features/ux-reset/explore/explore-model";
import type { Geography, Measure, Observation } from "@/generated/models";
import { isCountyFips } from "@/lib/county-geography";

/**
 * Explicit family allowlist. Current governed metadata projects `domain` as
 * NULL, and other reviewed values such as `climate` are not members of this
 * list. Those measures stay unclassified. Do not infer a family from a label.
 */
export const INVESTIGATE_DOMAIN_HUMAN = "human" as const;
export const INVESTIGATE_DOMAIN_VECTOR = "vector" as const;
export const INVESTIGATE_DOMAIN_PATHOGEN = "pathogen" as const;
export const INVESTIGATE_DOMAIN_ENVIRONMENTAL = "environmental" as const;
export const INVESTIGATE_DOMAIN_POPULATION = "population" as const;

export const investigateEvidenceFamilyIds = [
  "human",
  "vector_pathogen",
  "environmental_population",
] as const;

export type InvestigateEvidenceFamilyId =
  (typeof investigateEvidenceFamilyIds)[number];

export const INVESTIGATE_EVIDENCE_FAMILIES: readonly {
  contextNote: string | null;
  id: InvestigateEvidenceFamilyId;
  label: string;
}[] = [
  {
    contextNote: null,
    id: "human",
    label: "Human",
  },
  {
    contextNote: null,
    id: "vector_pathogen",
    label: "Vector and pathogen",
  },
  {
    contextNote:
      "Environmental and population evidence is context for interpretation. It does not establish that those conditions caused disease.",
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
};

export type CountyEvidenceFamilySection = {
  contextNote: string | null;
  id: InvestigateEvidenceFamilyId;
  label: string;
  /** Measures in this release whose indicator domain maps to the family. */
  measureIds: readonly string[];
  observations: readonly CountyEvidenceObservation[];
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
  measureFailures: readonly CountyEvidenceMeasureFailure[];
  readyMeasureIds: readonly string[];
  releaseId: string;
  unassigned: readonly CountyEvidenceObservation[];
  unclassifiedMeasureIds: readonly string[];
  unsupportedPeriodMeasureIds: readonly string[];
};

export type MeasureObservationOutcome =
  | {
      measureId: string;
      observations: readonly Observation[];
      status: "ready";
    }
  | {
      measureId: string;
      message: string;
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

export function buildCountyEvidenceBundle(input: {
  domainsRequestFailed: boolean;
  identity: ResolvedCountyIdentity;
  indicatorDomains: ReadonlyMap<string, string | null>;
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
  if (!input.domainsRequestFailed) {
    for (const measure of input.measures) {
      const domain = input.indicatorDomains.get(measure.indicator_id) ?? null;
      const familyId = evidenceFamilyFromIndicatorDomain(domain);
      if (!familyId) {
        continue;
      }
      familyMeasures.get(familyId)?.push(measure.measure_id);
    }
  }

  const byFamily = new Map<
    InvestigateEvidenceFamilyId,
    CountyEvidenceObservation[]
  >();
  for (const family of INVESTIGATE_EVIDENCE_FAMILIES) {
    byFamily.set(family.id, []);
  }
  const unclassifiedMeasureIds: string[] = [];
  if (!input.domainsRequestFailed) {
    for (const measure of input.measures) {
      const domain = input.indicatorDomains.get(measure.indicator_id) ?? null;
      if (!evidenceFamilyFromIndicatorDomain(domain)) {
        unclassifiedMeasureIds.push(measure.measure_id);
      }
    }
  }
  const unassigned: CountyEvidenceObservation[] = [];
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
        });
        break;
      }
      case "unsupported_period": {
        unsupportedPeriodMeasureIds.push(outcome.measureId);
        break;
      }
      case "ready": {
        readyMeasureIds.push(outcome.measureId);
        const measure = measuresById.get(outcome.measureId);
        const indicatorId = measure?.indicator_id ?? "";
        const indicatorDomain = input.domainsRequestFailed
          ? null
          : (input.indicatorDomains.get(indicatorId) ?? null);
        const familyId = input.domainsRequestFailed
          ? null
          : evidenceFamilyFromIndicatorDomain(indicatorDomain);
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
