import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import {
  evidenceReasonLabel,
  reasonCodeForEvidence,
} from "@/features/ux-reset/evidence/value-state-contract";
import {
  CountyContextObservationTemporalGrain,
  CountyContextValueType,
  ValueState,
  type CountyContextObservation,
  type Observation,
} from "@/generated/models";

/**
 * API 212 county context on Explorer county details.
 * Vintage 2022 is the SVI/ACS product. Vintage 2023 is the RUCC classification.
 * These rows are descriptive context. They are not surveillance and not a risk score.
 */
export const POPULATION_RURALITY_CONTRACT =
  "atlas-county-context-consumer/1" as const;

export const POPULATION_RURALITY_ACS_PERIOD = {
  end: "2022-12-31",
  start: "2018-01-01",
} as const;

const CATEGORY_MEASURE = {
  claimLabel: "Rural-urban classification",
  dates: "none",
  denominator: "NONE",
  kind: "category",
  maximum: 9,
  measureId: "rucc_2023",
  minimum: 1,
  sourceField: "RUCC_2023",
  temporalGrain: CountyContextObservationTemporalGrain.VINTAGE_YEAR,
  unit: "code",
  valueType: CountyContextValueType.integer,
  vintageYear: 2023,
} as const;

const QUANTITY_MEASURES = [
  {
    claimLabel: "Population",
    dates: "period",
    denominator: "NONE",
    kind: "people",
    maximum: null,
    measureId: "population_2022",
    minimum: 0,
    periodEnd: POPULATION_RURALITY_ACS_PERIOD.end,
    periodStart: POPULATION_RURALITY_ACS_PERIOD.start,
    sourceField: "E_TOTPOP",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "people",
    valueType: CountyContextValueType.integer,
    vintageYear: 2022,
  },
  {
    claimLabel: "Social vulnerability percentile",
    dates: "period",
    denominator: "NONE",
    kind: "percentile",
    maximum: 1,
    measureId: "svi_percentile_2022",
    minimum: 0,
    periodEnd: POPULATION_RURALITY_ACS_PERIOD.end,
    periodStart: POPULATION_RURALITY_ACS_PERIOD.start,
    sourceField: "RPL_THEMES",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percentile",
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
  {
    claimLabel: "Uninsured percentage",
    dates: "period",
    denominator: "civilian_noninstitutionalized_population",
    kind: "percent",
    maximum: 100,
    measureId: "uninsured_percent_2022",
    minimum: 0,
    periodEnd: POPULATION_RURALITY_ACS_PERIOD.end,
    periodStart: POPULATION_RURALITY_ACS_PERIOD.start,
    sourceField: "EP_UNINSUR",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percent",
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
  {
    claimLabel: "Uninsured percentile",
    dates: "period",
    denominator: "NONE",
    kind: "percentile",
    maximum: 1,
    measureId: "uninsured_percentile_2022",
    minimum: 0,
    periodEnd: POPULATION_RURALITY_ACS_PERIOD.end,
    periodStart: POPULATION_RURALITY_ACS_PERIOD.start,
    sourceField: "EPL_UNINSUR",
    temporalGrain: CountyContextObservationTemporalGrain.PERIOD,
    unit: "percentile",
    valueType: CountyContextValueType.number,
    vintageYear: 2022,
  },
] as const;

export const POPULATION_RURALITY_MEASURES = [
  CATEGORY_MEASURE,
  ...QUANTITY_MEASURES,
] as const;

export type PopulationRuralityMeasure =
  (typeof POPULATION_RURALITY_MEASURES)[number];

export type PopulationRuralityMeasureId =
  PopulationRuralityMeasure["measureId"];

export const populationRuralityMeasureIds: readonly PopulationRuralityMeasureId[] =
  POPULATION_RURALITY_MEASURES.map((measure) => measure.measureId);

export function populationRuralityMeasure(
  measureId: string
): PopulationRuralityMeasure | null {
  for (const measure of POPULATION_RURALITY_MEASURES) {
    if (measure.measureId === measureId) {
      return measure;
    }
  }
  return null;
}

/** Cache identity is the governed release, county, vintage, and measure. */
export function populationRuralityQueryKey(input: {
  fips: string;
  measureId: string;
  releaseId: string;
  vintageYear: number;
}): readonly [string, string, string, string, string] {
  return [
    "population-rurality-context",
    input.releaseId,
    input.fips,
    String(input.vintageYear),
    input.measureId,
  ];
}

const PLAIN_DECIMAL = /^-?\d+(?:\.\d+)?$/;

const NULL_VALUE_STATES: ReadonlySet<ValueState> = new Set([
  ValueState.MISSING,
  ValueState.NO_COUNTY_LINKED_RECORD,
  ValueState.NO_RECORDS,
  ValueState.SUPPRESSED,
  ValueState.UNAVAILABLE,
]);

export class PopulationRuralityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PopulationRuralityContractError";
  }
}

export type PopulationRuralityLoad =
  | { count: number; kind: "conflict" }
  | { kind: "absent" }
  | { kind: "observation"; observation: CountyContextObservation };

function fail(message: string): never {
  throw new PopulationRuralityContractError(message);
}

function decimalNumber(value: number | string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("A published value is not a finite number.");
    }
    return value;
  }
  const raw = value.trim();
  if (!PLAIN_DECIMAL.test(raw)) {
    fail("A published value is not a plain decimal.");
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    fail("A published value is not a finite number.");
  }
  return numeric;
}

function assertBounded(
  numeric: number,
  minimum: number,
  maximum: number
): void {
  if (numeric < minimum || numeric > maximum) {
    fail("A published value was outside the governed scale for this measure.");
  }
}

function assertScale(
  measure: PopulationRuralityMeasure,
  numeric: number
): void {
  switch (measure.kind) {
    case "people": {
      if (!Number.isInteger(numeric) || numeric < measure.minimum) {
        fail("A population estimate was not a whole number of people.");
      }
      return;
    }
    case "category": {
      if (!Number.isInteger(numeric)) {
        fail("A rural-urban code was not a whole number from 1 through 9.");
      }
      assertBounded(numeric, measure.minimum, measure.maximum);
      return;
    }
    case "percent":
    case "percentile": {
      assertBounded(numeric, measure.minimum, measure.maximum);
      return;
    }
    default: {
      const exhaustive: never = measure;
      fail(exhaustive);
    }
  }
}

function assertNullValue(value: CountyContextObservation["value"]): null {
  if (value !== null) {
    fail(
      "A missing, suppressed, unavailable, or no-record value was sent as a number. That state is not zero."
    );
  }
  return null;
}

function assertObserved(
  measure: PopulationRuralityMeasure,
  value: CountyContextObservation["value"]
): number {
  if (value === null) {
    fail("An observed value was empty. Observed is not the same as missing.");
  }
  const numeric = decimalNumber(value);
  if (numeric === 0) {
    fail(
      "A numeric zero was marked observed. Observed zero uses the ZERO state."
    );
  }
  assertScale(measure, numeric);
  return numeric;
}

function assertValue(
  measure: PopulationRuralityMeasure,
  observation: CountyContextObservation
): number | null {
  const { value, value_state: valueState } = observation;
  switch (valueState) {
    case ValueState.MISSING:
    case ValueState.NO_COUNTY_LINKED_RECORD:
    case ValueState.NO_RECORDS:
    case ValueState.SUPPRESSED:
    case ValueState.UNAVAILABLE: {
      return assertNullValue(value);
    }
    case ValueState.ZERO: {
      if (value !== 0) {
        fail("An observed zero was not the integer 0.");
      }
      assertScale(measure, 0);
      return 0;
    }
    case ValueState.OBSERVED: {
      return assertObserved(measure, value);
    }
    default: {
      const exhaustive: never = valueState;
      return exhaustive;
    }
  }
}

function assertContextShape(
  measure: PopulationRuralityMeasure,
  observation: CountyContextObservation
): void {
  const context = observation.county_context;
  if (
    context.contract_version !== POPULATION_RURALITY_CONTRACT ||
    context.vintage_year !== measure.vintageYear ||
    context.source_field !== measure.sourceField ||
    context.value_type !== measure.valueType
  ) {
    fail(
      "County context did not match the governed vintage, source field, and value type."
    );
  }
  if (!context.allowed_value_states.includes(observation.value_state)) {
    fail("A value state was outside the states admitted for this measure.");
  }
  if (observation.unit !== measure.unit) {
    fail(`An observation used a unit other than ${measure.unit}.`);
  }
  if ((observation.denominator ?? null) !== measure.denominator) {
    fail(
      "An observation used a denominator other than the governed one for this measure."
    );
  }
  if (measure.dates === "none") {
    if (observation.period_start !== null || observation.period_end !== null) {
      fail(
        "A rural-urban code included an observation date. This classification does not accept dates."
      );
    }
    if (observation.temporal_grain !== measure.temporalGrain) {
      fail("A rural-urban code did not use the vintage-year grain.");
    }
    if (!context.category_label?.trim()) {
      fail("A rural-urban code was missing its published category label.");
    }
    return;
  }
  if (
    observation.period_start !== measure.periodStart ||
    observation.period_end !== measure.periodEnd ||
    observation.temporal_grain !== measure.temporalGrain
  ) {
    fail(
      "A county-context period did not match the governed ACS reference period."
    );
  }
  if (context.category_label !== null) {
    fail("A numeric county-context measure included a category label.");
  }
}

function assertIdentity(
  measure: PopulationRuralityMeasure,
  observation: CountyContextObservation,
  releaseId: string,
  requestedFips: string
): void {
  if (observation.measure_id !== measure.measureId) {
    fail("An observation used a different measure than the one requested.");
  }
  if (observation.release_id !== releaseId) {
    fail("An observation used a release other than the requested release.");
  }
  if (
    observation.geography.geography_type !== "county" ||
    observation.geography.geography_id !== requestedFips
  ) {
    fail("An observation was returned for a county that was not requested.");
  }
}

/**
 * Keeps one county-context row when it matches the requested county, measure,
 * vintage, and release. A second matching row is a conflict. An empty
 * collection is absence, which is not zero.
 */
export function acceptPopulationRuralityRows(input: {
  measureId: PopulationRuralityMeasureId;
  releaseId: string;
  requestedFips: string;
  rows: readonly CountyContextObservation[];
}): PopulationRuralityLoad {
  const measure = populationRuralityMeasure(input.measureId);
  if (!measure) {
    fail("This population and rurality measure is not in the shipped set.");
  }
  for (const row of input.rows) {
    assertIdentity(measure, row, input.releaseId, input.requestedFips);
    assertContextShape(measure, row);
    assertValue(measure, row);
  }
  if (input.rows.length === 0) {
    return { kind: "absent" };
  }
  if (input.rows.length > 1) {
    return { count: input.rows.length, kind: "conflict" };
  }
  const observation = input.rows[0];
  if (!observation) {
    return { kind: "absent" };
  }
  return { kind: "observation", observation };
}

export function observationMatchesPopulationRuralityRequest(
  observation: CountyContextObservation,
  request: {
    fips: string;
    measureId: string;
    releaseId: string;
    vintageYear: number;
  }
): boolean {
  return (
    observation.measure_id === request.measureId &&
    observation.release_id === request.releaseId &&
    observation.geography.geography_type === "county" &&
    observation.geography.geography_id === request.fips &&
    observation.county_context.vintage_year === request.vintageYear
  );
}

function quantityText(value: number | string, unit: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? `${trimmed} ${unit}` : "Unavailable";
  }
  if (!Number.isFinite(value)) {
    return "Unavailable";
  }
  if (Number.isInteger(value)) {
    return `${value.toLocaleString("en-US")} ${unit}`;
  }
  return `${String(value)} ${unit}`;
}

function displayValue(
  measure: PopulationRuralityMeasure,
  observation: CountyContextObservation
): string {
  const { value, value_state: valueState } = observation;
  if (NULL_VALUE_STATES.has(valueState) || value === null) {
    return valueState === ValueState.SUPPRESSED ? "Suppressed" : "Unavailable";
  }
  if (measure.kind === "category") {
    const label = observation.county_context.category_label?.trim() ?? "";
    if (!label || typeof value !== "number") {
      return "Unavailable";
    }
    return `${label} (code ${value})`;
  }
  return quantityText(value, measure.unit);
}

function interpretation(measure: PopulationRuralityMeasure): string {
  switch (measure.kind) {
    case "category": {
      return "USDA category label for this code. 2023 is the classification vintage, not an annual observation.";
    }
    case "people": {
      return "Population estimate in people for the ACS 2018–2022 reference period.";
    }
    case "percentile": {
      return "Percentile from 0 to 1. A percentile is not a percent of the population.";
    }
    case "percent": {
      return "Percent of the civilian noninstitutionalized population. A percent is not a percentile.";
    }
    default: {
      const exhaustive: never = measure;
      return exhaustive;
    }
  }
}

function valueNote(
  measure: PopulationRuralityMeasure,
  observation: CountyContextObservation
): string {
  const notes = [interpretation(measure)];
  if (
    observation.value === null ||
    NULL_VALUE_STATES.has(observation.value_state)
  ) {
    notes.push("No numeric value was returned. Null is not shown as zero.");
  } else if (observation.value_state === ValueState.ZERO) {
    notes.push("Published zero. This is an observed zero, not missing data.");
  }
  return notes.join(" ");
}

function referencePeriod(measure: PopulationRuralityMeasure): string {
  if (measure.dates === "none") {
    return "No observation period is published.";
  }
  return `${measure.periodStart} through ${measure.periodEnd}`;
}

function vintageLabel(measure: PopulationRuralityMeasure): string {
  if (measure.dates === "none") {
    return `${measure.vintageYear} classification vintage`;
  }
  return `${measure.vintageYear} product vintage`;
}

function periodSentence(measure: PopulationRuralityMeasure): string {
  if (measure.dates === "none") {
    return `Classification vintage ${measure.vintageYear}. No observation dates are published for this classification.`;
  }
  return `ACS reference period ${measure.periodStart} through ${measure.periodEnd}. Product vintage ${measure.vintageYear}.`;
}

function denominatorLabel(denominator: string): string {
  if (denominator === "NONE") {
    return "No person denominator is published.";
  }
  if (denominator === "civilian_noninstitutionalized_population") {
    return "Civilian noninstitutionalized population";
  }
  return denominator;
}

function observationForEvidence(
  observation: CountyContextObservation
): Observation {
  return {
    atlas_acquired_at: observation.atlas_acquired_at,
    atlas_processed_at: observation.atlas_processed_at,
    dataset_id: observation.dataset_id,
    denominator: observation.denominator,
    environmental_context: observation.environmental_context,
    evidence: observation.evidence,
    geography: observation.geography,
    limitations: observation.limitations,
    lineage_source_id: observation.lineage_source_id,
    measure_id: observation.measure_id,
    methodology: observation.methodology,
    methodology_id: observation.methodology_id,
    methodology_version: observation.methodology_version,
    observation_id: observation.observation_id,
    period_end: observation.period_end ?? "",
    period_start: observation.period_start ?? "",
    provenance_ref: observation.provenance_ref,
    release_id: observation.release_id,
    release_methodology_version: observation.release_methodology_version,
    semantic_version: observation.semantic_version,
    source_id: observation.source_id,
    source_label: observation.source_label,
    source_published_at: observation.source_published_at,
    source_url: observation.source_url,
    source_vintage: observation.source_vintage,
    surveillance_context: observation.surveillance_context,
    temporal_grain: observation.temporal_grain,
    unit: observation.unit,
    value: observation.value,
    value_state: observation.value_state,
  };
}

export type PopulationRuralityPresentation = {
  claimLabel: string;
  definition: string;
  denominatorLabel: string;
  evidence: EvidenceObjectModel;
  measureId: string;
  methodVersion: string;
  provenanceRef: string;
  referencePeriod: string;
  sourceField: string;
  sourceLabel: string;
  sourceUrl: string | null;
  valueStateLabel: string;
  vintageLabel: string;
};

export function presentPopulationRuralityObservation(input: {
  claimLabel: string;
  observation: CountyContextObservation;
}): PopulationRuralityPresentation {
  const measure = populationRuralityMeasure(input.observation.measure_id);
  if (!measure) {
    fail("This population and rurality measure is not in the shipped set.");
  }
  const base = evidenceObjectFromObservation({
    claimLabel: input.claimLabel,
    observation: observationForEvidence(input.observation),
  });
  const reasonCode = reasonCodeForEvidence({
    hasMaterialLimitations: base.provenance.limitations.length > 0,
    valueState: input.observation.value_state,
  });
  const sourceField =
    input.observation.county_context.source_field.trim() || "Unavailable";
  const governedDenominator = denominatorLabel(measure.denominator);
  const evidence: EvidenceObjectModel = {
    ...base,
    displayValue: displayValue(measure, input.observation),
    provenance: {
      ...base.provenance,
      observationPeriod: periodSentence(measure),
      referenceLines: [
        `Source field ${sourceField}.`,
        `Denominator ${governedDenominator}`,
      ],
    },
    valueNote: valueNote(measure, input.observation),
  };
  return {
    claimLabel: input.claimLabel,
    definition:
      input.observation.county_context.definition.trim() || "Unavailable",
    denominatorLabel: governedDenominator,
    evidence,
    measureId: input.observation.measure_id,
    methodVersion:
      input.observation.methodology_version.trim() || "Unavailable",
    provenanceRef: input.observation.provenance_ref.trim() || "Unavailable",
    referencePeriod: referencePeriod(measure),
    sourceField,
    sourceLabel:
      input.observation.source_label?.trim() ||
      input.observation.source_id.trim() ||
      "Unavailable",
    sourceUrl: input.observation.source_url?.trim() || null,
    valueStateLabel: `Value state ${input.observation.value_state}. ${evidenceReasonLabel(reasonCode)}.`,
    vintageLabel: vintageLabel(measure),
  };
}
