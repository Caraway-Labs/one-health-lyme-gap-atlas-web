import { evidenceObjectFromObservation } from "@/features/ux-reset/evidence/from-observation";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import type { KnownEmptyObservationSelection } from "@/features/ux-reset/observations/selection-availability";
import { DatedObservationContractError } from "@/features/ux-reset/review/dated-observation-envelope";
import { MINIMUM_REPORTED_INCIDENCE_LABEL } from "@/features/ux-reset/review/published-human-case-copy";
import type {
  CountyContextObservation,
  EvidenceReference,
  Observation,
  ValueState,
} from "@/generated/models";
import { ValueState as ValueStateValue } from "@/generated/models";

export class ExplorerMapContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplorerMapContractError";
  }
}

export const EXPLORER_OBSERVATION_LAYER_IDS = [
  "incidence_floor",
  "svi",
  "uninsured",
  "rurality",
] as const;

export type ExplorerObservationLayerId =
  (typeof EXPLORER_OBSERVATION_LAYER_IDS)[number];

/** Fields the shared evidence contract needs for one governed map value. */
export type ExplorerMapRowProvenance = {
  atlasAcquiredAt: string | null;
  evidence: EvidenceReference;
  limitations: readonly string[];
  measureId: string;
  methodology: string | null;
  methodologyId: string | null;
  methodologyVersion: string;
  observationId: string;
  periodEnd: string | null;
  periodStart: string | null;
  provenanceRef: string;
  publishedValue: number | string | null;
  releaseId: string;
  semanticVersion: string;
  sourceId: string;
  sourceLabel: string | null;
  sourcePublishedAt: string | null;
  sourceUrl: string | null;
  sourceVintage: string | null;
  temporalGrain: string;
  unit: string;
};

export type ExplorerMapNumericRow = {
  categoryLabel: string | null;
  fips: string;
  numeric: number | null;
  provenance?: ExplorerMapRowProvenance;
  raw: string | null;
  valueState: ValueState;
};

const LAYER_CLAIM_LABEL = {
  incidence_floor: MINIMUM_REPORTED_INCIDENCE_LABEL,
  rurality: "Rurality",
  svi: "Social vulnerability",
  uninsured: "Uninsured population",
} as const;

export function explorerMapLayerClaimLabel(
  layerId: ExplorerObservationLayerId
): string {
  return LAYER_CLAIM_LABEL[layerId];
}

/**
 * Selected-county readout for a governed map row.
 * Availability, limitations, method, freshness, and provenance stay on the
 * shared evidence contract instead of a display-only reduction.
 */
export function evidenceObjectForExplorerMapRow(
  row: ExplorerMapNumericRow,
  claimLabel: string
): EvidenceObjectModel {
  const provenance = row.provenance;
  if (!provenance) {
    throw new ExplorerMapContractError(
      "Map row is missing governed provenance."
    );
  }
  const periodStart = provenance.periodStart ?? "";
  const periodEnd = provenance.periodEnd ?? "";
  const model = evidenceObjectFromObservation({
    claimLabel,
    observation: {
      atlas_acquired_at: provenance.atlasAcquiredAt,
      denominator: null,
      evidence: provenance.evidence,
      geography: { geography_id: row.fips, geography_type: "county" },
      limitations: [...provenance.limitations],
      measure_id: provenance.measureId,
      methodology: provenance.methodology,
      methodology_id: provenance.methodologyId,
      methodology_version: provenance.methodologyVersion,
      observation_id: provenance.observationId,
      period_end: periodEnd,
      period_start: periodStart,
      provenance_ref: provenance.provenanceRef,
      release_id: provenance.releaseId,
      semantic_version: provenance.semanticVersion,
      source_id: provenance.sourceId,
      source_label: provenance.sourceLabel,
      source_published_at: provenance.sourcePublishedAt,
      source_url: provenance.sourceUrl,
      source_vintage: provenance.sourceVintage,
      temporal_grain: provenance.temporalGrain,
      unit: provenance.unit,
      value: provenance.publishedValue,
      value_state: row.valueState,
    },
  });
  const resourceType = provenance.evidence.resource_type.trim();
  const resourceId = provenance.evidence.resource_id.trim();
  const reference =
    resourceType && resourceId ? `${resourceType} ${resourceId}` : "";
  if (!reference) {
    return model;
  }
  return {
    ...model,
    provenance: {
      ...model.provenance,
      referenceLines: [reference],
    },
  };
}

function provenanceFromObservation(
  row: CountyContextObservation | Observation
): ExplorerMapRowProvenance {
  return {
    atlasAcquiredAt: row.atlas_acquired_at ?? null,
    evidence: row.evidence,
    limitations: [...row.limitations],
    measureId: row.measure_id,
    methodology: row.methodology?.trim() ? row.methodology : null,
    methodologyId: row.methodology_id,
    methodologyVersion: row.methodology_version,
    observationId: row.observation_id,
    periodEnd: row.period_end,
    periodStart: row.period_start,
    provenanceRef: row.provenance_ref,
    publishedValue: row.value,
    releaseId: row.release_id,
    semanticVersion: row.semantic_version,
    sourceId: row.source_id,
    sourceLabel: row.source_label ?? null,
    sourcePublishedAt: row.source_published_at ?? null,
    sourceUrl: row.source_url ?? null,
    sourceVintage: row.source_vintage ?? null,
    temporalGrain: row.temporal_grain,
    unit: row.unit,
  };
}

export type ExplorerMapObservationReady = {
  knownEmptySelection?: KnownEmptyObservationSelection | null;
  omitted: number;
  period: string;
  rows: ExplorerMapNumericRow[];
  sourceLabel: string | null;
  unit: string;
};

type DatedSpec = {
  context: false;
  denominator: null;
  id: "incidence_floor";
  maximum: number | null;
  measureId: "incidence_floor_2023";
  minimum: number;
  periodEnd: "2023-12-31";
  periodStart: "2023-01-01";
  temporalGrain: "YEAR";
  unit: "per 100,000";
  year: 2023;
};

type ContextQuantitySpec = {
  context: true;
  dates: "period";
  denominator: string;
  id: "svi" | "uninsured";
  maximum: number;
  measureId: "svi_percentile_2022" | "uninsured_percent_2022";
  minimum: number;
  periodEnd: "2022-12-31";
  periodStart: "2018-01-01";
  sourceField: string;
  temporalGrain: "PERIOD";
  unit: "percentile" | "percent";
  vintageYear: 2022;
};

type ContextCategorySpec = {
  context: true;
  dates: "none";
  denominator: "NONE";
  id: "rurality";
  maximum: 9;
  measureId: "rucc_2023";
  minimum: 1;
  sourceField: "RUCC_2023";
  temporalGrain: "VINTAGE_YEAR";
  unit: "code";
  vintageYear: 2023;
};

export type ExplorerObservationSpec =
  | ContextCategorySpec
  | ContextQuantitySpec
  | DatedSpec;

export const EXPLORER_OBSERVATION_SPECS = {
  incidence_floor: {
    context: false,
    denominator: null,
    id: "incidence_floor",
    maximum: null,
    measureId: "incidence_floor_2023",
    minimum: 0,
    periodEnd: "2023-12-31",
    periodStart: "2023-01-01",
    temporalGrain: "YEAR",
    unit: "per 100,000",
    year: 2023,
  },
  rurality: {
    context: true,
    dates: "none",
    denominator: "NONE",
    id: "rurality",
    maximum: 9,
    measureId: "rucc_2023",
    minimum: 1,
    sourceField: "RUCC_2023",
    temporalGrain: "VINTAGE_YEAR",
    unit: "code",
    vintageYear: 2023,
  },
  svi: {
    context: true,
    dates: "period",
    denominator: "NONE",
    id: "svi",
    maximum: 1,
    measureId: "svi_percentile_2022",
    minimum: 0,
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "RPL_THEMES",
    temporalGrain: "PERIOD",
    unit: "percentile",
    vintageYear: 2022,
  },
  uninsured: {
    context: true,
    dates: "period",
    denominator: "civilian_noninstitutionalized_population",
    id: "uninsured",
    maximum: 100,
    measureId: "uninsured_percent_2022",
    minimum: 0,
    periodEnd: "2022-12-31",
    periodStart: "2018-01-01",
    sourceField: "EP_UNINSUR",
    temporalGrain: "PERIOD",
    unit: "percent",
    vintageYear: 2022,
  },
} as const satisfies Record<
  ExplorerObservationLayerId,
  ExplorerObservationSpec
>;

const CONTEXT_CONTRACT = "atlas-county-context-consumer/1";
function plainDecimal(value: number | string): {
  numeric: number;
  raw: string;
} {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ExplorerMapContractError(
        "A published value is not a finite number."
      );
    }
    return { numeric: value, raw: String(value) };
  }
  const raw = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) {
    throw new ExplorerMapContractError(
      "A published value is not a plain decimal."
    );
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    throw new ExplorerMapContractError(
      "A published value is not a finite number."
    );
  }
  return { numeric, raw };
}

function nullStateValue(value: number | string | null): {
  numeric: null;
  raw: null;
} {
  if (value !== null) {
    throw new ExplorerMapContractError(
      "A missing, suppressed, unavailable, or no-record value was sent as a number. That state is not zero."
    );
  }
  return { numeric: null, raw: null };
}

function valueForState(
  state: ValueState,
  value: number | string | null
): { numeric: number | null; raw: string | null } {
  switch (state) {
    case ValueStateValue.MISSING:
    case ValueStateValue.NO_COUNTY_LINKED_RECORD:
    case ValueStateValue.NO_RECORDS:
    case ValueStateValue.SUPPRESSED:
    case ValueStateValue.UNAVAILABLE: {
      return nullStateValue(value);
    }
    case ValueStateValue.ZERO: {
      if (value !== 0) {
        throw new ExplorerMapContractError(
          "An observed zero was not the integer 0."
        );
      }
      return { numeric: 0, raw: "0" };
    }
    case ValueStateValue.OBSERVED: {
      if (value === null) {
        throw new ExplorerMapContractError(
          "An observed value was empty. Observed is not the same as missing."
        );
      }
      const parsed = plainDecimal(value);
      if (parsed.numeric === 0) {
        throw new ExplorerMapContractError(
          "A numeric zero was marked observed. Observed zero uses the ZERO state."
        );
      }
      return parsed;
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function requireText(
  value: string | null | undefined,
  message: string
): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new ExplorerMapContractError(message);
  }
  return trimmed;
}

function sharedText(
  current: string | null,
  next: string | null | undefined,
  message: string
): string {
  const trimmed = requireText(next, message);
  if (current !== null && current !== trimmed) {
    throw new ExplorerMapContractError(message);
  }
  return trimmed;
}

export function acceptExplorerMapObservations(input: {
  releaseId: string;
  requestedFips: readonly string[];
  rows: readonly (CountyContextObservation | Observation)[];
  spec: ExplorerObservationSpec;
}): ExplorerMapObservationReady {
  if (input.rows.length === 0) {
    throw new ExplorerMapContractError(
      "The observation collection returned no rows for the requested counties."
    );
  }
  const requested = new Set(input.requestedFips);
  const seen = new Set<string>();
  const categoryLabels = new Map<number, string>();
  const accepted: ExplorerMapNumericRow[] = [];
  let sourceLabel: string | null = null;
  let sourceVintage: string | null = null;
  for (const row of input.rows) {
    if (row.measure_id !== input.spec.measureId) {
      throw new ExplorerMapContractError(
        "An observation used a different measure than the one requested."
      );
    }
    if (row.release_id !== input.releaseId) {
      throw new ExplorerMapContractError(
        "An observation used a release other than the requested release."
      );
    }
    if (row.unit !== input.spec.unit) {
      throw new ExplorerMapContractError(
        `An observation used a unit other than ${input.spec.unit}.`
      );
    }
    if (row.geography.geography_type !== "county") {
      throw new ExplorerMapContractError(
        "An observation was not a county geography."
      );
    }
    const fips = row.geography.geography_id;
    if (!requested.has(fips)) {
      throw new ExplorerMapContractError(
        "An observation was returned for a county that was not requested."
      );
    }
    if (seen.has(fips)) {
      throw new ExplorerMapContractError(
        "Two rows were returned for the same county."
      );
    }
    seen.add(fips);
    if ((row.denominator ?? null) !== input.spec.denominator) {
      throw new ExplorerMapContractError(
        "An observation used a denominator other than the governed one for this measure."
      );
    }
    const parsed = valueForState(row.value_state, row.value);
    let categoryLabel: string | null = null;
    if (input.spec.context) {
      if (!("county_context" in row) || row.county_context == null) {
        throw new ExplorerMapContractError(
          "A county-context measure was returned without county context."
        );
      }
      const context = row.county_context;
      if (
        context.contract_version !== CONTEXT_CONTRACT ||
        context.vintage_year !== input.spec.vintageYear ||
        context.source_field !== input.spec.sourceField
      ) {
        throw new ExplorerMapContractError(
          "County context did not match the governed vintage and source field for this layer."
        );
      }
      if (!context.allowed_value_states.includes(row.value_state)) {
        throw new ExplorerMapContractError(
          "A value state was outside the states admitted for this measure."
        );
      }
      if (input.spec.dates === "none") {
        if (row.period_start !== null || row.period_end !== null) {
          throw new ExplorerMapContractError(
            "A rural-urban code included an observation date. This layer does not invent or accept dates for that vintage."
          );
        }
        if (row.temporal_grain !== "VINTAGE_YEAR") {
          throw new ExplorerMapContractError(
            "A rural-urban code did not use the vintage-year grain."
          );
        }
        if (
          parsed.numeric === null ||
          !Number.isInteger(parsed.numeric) ||
          parsed.numeric < input.spec.minimum ||
          parsed.numeric > input.spec.maximum
        ) {
          throw new ExplorerMapContractError(
            "A rural-urban code was outside the published codes 1 through 9."
          );
        }
        categoryLabel = requireText(
          context.category_label,
          "A rural-urban code was missing its published category label."
        );
        const previous = categoryLabels.get(parsed.numeric);
        if (previous !== undefined && previous !== categoryLabel) {
          throw new ExplorerMapContractError(
            "One rural-urban code was published with two different category labels."
          );
        }
        categoryLabels.set(parsed.numeric, categoryLabel);
      } else if (
        row.period_start !== input.spec.periodStart ||
        row.period_end !== input.spec.periodEnd ||
        row.temporal_grain !== input.spec.temporalGrain
      ) {
        throw new ExplorerMapContractError(
          "A county-context period did not match the governed ACS reference period."
        );
      } else if (context.category_label !== null) {
        throw new ExplorerMapContractError(
          "A numeric county-context measure included a category label."
        );
      }
    } else if ("county_context" in row && row.county_context != null) {
      throw new DatedObservationContractError(
        "A dated observation request returned county context. This consumer does not invent dates for that row."
      );
    } else if (
      row.period_start !== input.spec.periodStart ||
      row.period_end !== input.spec.periodEnd ||
      row.temporal_grain !== input.spec.temporalGrain
    ) {
      throw new ExplorerMapContractError(
        "An incidence observation was outside the published 2023 period."
      );
    }
    if (
      parsed.numeric !== null &&
      input.spec.id !== "rurality" &&
      (parsed.numeric < input.spec.minimum ||
        (input.spec.maximum !== null && parsed.numeric > input.spec.maximum))
    ) {
      throw new ExplorerMapContractError(
        "A published value was outside the governed scale for this measure."
      );
    }
    sourceLabel = sharedText(
      sourceLabel,
      row.source_label,
      "Observations for this layer did not share one source label."
    );
    sourceVintage = sharedText(
      sourceVintage,
      row.source_vintage,
      "Observations for this layer did not share one source vintage."
    );
    accepted.push({
      categoryLabel,
      fips,
      numeric: parsed.numeric,
      provenance: provenanceFromObservation(row),
      raw: parsed.raw,
      valueState: row.value_state,
    });
  }
  const omitted = input.requestedFips.filter((fips) => !seen.has(fips)).length;
  return {
    omitted,
    period: observationPeriod(input.spec, sourceLabel, sourceVintage),
    rows: accepted,
    sourceLabel,
    unit: input.spec.unit,
  };
}

export function explorerMapLayerPeriod(
  layerId: ExplorerObservationLayerId
): string {
  return observationPeriod(EXPLORER_OBSERVATION_SPECS[layerId], null, null);
}

function observationPeriod(
  spec: ExplorerObservationSpec,
  sourceLabel: string | null,
  sourceVintage: string | null
): string {
  const source = [sourceLabel, sourceVintage].filter(Boolean).join(" ");
  const prefix = source ? `${source}. ` : "";
  switch (spec.id) {
    case "incidence_floor": {
      return `${prefix}2023-01-01 through 2023-12-31. Published lower bound for 2023.`;
    }
    case "svi": {
      return `${prefix}ACS 2018-01-01 through 2022-12-31. Vintage 2022. National county percentile from 0 to 1.`;
    }
    case "uninsured": {
      return `${prefix}ACS 2018-01-01 through 2022-12-31. Vintage 2022. Percent of the civilian noninstitutionalized population, from 0 to 100.`;
    }
    case "rurality": {
      return `${prefix}Vintage 2023. No observation dates are published for this classification.`;
    }
    default: {
      const exhaustive: never = spec;
      return exhaustive;
    }
  }
}
