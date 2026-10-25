import {
  EXPLORER_OBSERVATION_SPECS,
  ExplorerMapContractError,
  explorerMapLayerPeriod,
  type ExplorerMapNumericRow,
  type ExplorerMapObservationReady,
  type ExplorerObservationLayerId,
} from "@/features/ux-reset/review/explorer-map-observation";
import { mapValuesV1AtlasMapValuesGet } from "@/features/ux-reset/review/map-values-atlas";
import {
  mapValuesCollectionSchema,
  type MapValuesCollection,
} from "@/features/ux-reset/review/map-values-schema";
import { RUCC_2023_LABELS } from "@/features/ux-reset/review/review-rationale";
import {
  isLower48CountyFips,
  stateFipsPrefix,
} from "@/features/ux-reset/review/review-state-fips";
import { ValueState } from "@/generated/models";
import { validateApiResponse } from "@/lib/api-response-validation";

export const explorerMapValuesQueryKey = (releaseId: string) =>
  ["ux-reset-explorer-map-values", releaseId] as const;

export async function loadExplorerMapValues(input: {
  releaseId: string;
  signal: AbortSignal;
}): Promise<MapValuesCollection> {
  const response = await mapValuesV1AtlasMapValuesGet(
    { dataset_version: input.releaseId },
    { signal: input.signal }
  );
  const parsed = validateApiResponse(
    "Atlas map values",
    mapValuesCollectionSchema,
    response.data
  );
  if (parsed.release_id !== input.releaseId) {
    throw new ExplorerMapContractError(
      "Map values used a release other than the requested release."
    );
  }
  return parsed;
}

function rawDecimal(value: number): string {
  return String(value);
}

function valueStateForQuantity(
  value: number | null
): { numeric: number | null; raw: string | null; valueState: ValueState } {
  if (value === null) {
    return { numeric: null, raw: null, valueState: ValueState.MISSING };
  }
  if (!Number.isFinite(value)) {
    throw new ExplorerMapContractError(
      "A published value is not a finite number."
    );
  }
  if (value === 0) {
    return { numeric: 0, raw: "0", valueState: ValueState.ZERO };
  }
  return {
    numeric: value,
    raw: rawDecimal(value),
    valueState: ValueState.OBSERVED,
  };
}

function valueStateForRurality(
  code: number | null
): {
  categoryLabel: string | null;
  numeric: number | null;
  raw: string | null;
  valueState: ValueState;
} {
  if (code === null) {
    return {
      categoryLabel: null,
      numeric: null,
      raw: null,
      valueState: ValueState.MISSING,
    };
  }
  if (!Number.isInteger(code) || code < 1 || code > 9) {
    return {
      categoryLabel: null,
      numeric: null,
      raw: null,
      valueState: ValueState.MISSING,
    };
  }
  const categoryLabel = RUCC_2023_LABELS[code] ?? null;
  if (!categoryLabel) {
    return {
      categoryLabel: null,
      numeric: null,
      raw: null,
      valueState: ValueState.MISSING,
    };
  }
  return {
    categoryLabel,
    numeric: code,
    raw: String(code),
    valueState: ValueState.OBSERVED,
  };
}

function fieldValue(
  county: MapValuesCollection["counties"][number],
  layerId: ExplorerObservationLayerId
): number | null {
  switch (layerId) {
    case "incidence_floor": {
      return county.incidence_floor_2023;
    }
    case "svi": {
      return county.svi_percentile;
    }
    case "uninsured": {
      return county.uninsured_percent;
    }
    case "rurality": {
      return county.rucc_2023;
    }
    default: {
      const exhaustive: never = layerId;
      return exhaustive;
    }
  }
}

function rowForCounty(
  county: MapValuesCollection["counties"][number],
  layerId: ExplorerObservationLayerId
): ExplorerMapNumericRow {
  const value = fieldValue(county, layerId);
  if (layerId === "rurality") {
    const parsed = valueStateForRurality(value);
    return {
      categoryLabel: parsed.categoryLabel,
      fips: county.fips,
      numeric: parsed.numeric,
      raw: parsed.raw,
      valueState: parsed.valueState,
    };
  }
  const parsed = valueStateForQuantity(value);
  return {
    categoryLabel: null,
    fips: county.fips,
    numeric: parsed.numeric,
    raw: parsed.raw,
    valueState: parsed.valueState,
  };
}

export function explorerMapValuesLayerReady(input: {
  collection: MapValuesCollection;
  layerId: ExplorerObservationLayerId;
  requestedFips: readonly string[];
  scopeCode?: string | null;
}): ExplorerMapObservationReady {
  const scopePrefix = input.scopeCode ? stateFipsPrefix(input.scopeCode) : null;
  const requested = new Set(input.requestedFips);
  const rows: ExplorerMapNumericRow[] = [];
  for (const county of input.collection.counties) {
    if (!isLower48CountyFips(county.fips)) {
      continue;
    }
    if (scopePrefix !== null && !county.fips.startsWith(scopePrefix)) {
      continue;
    }
    rows.push(rowForCounty(county, input.layerId));
  }
  const seen = new Set(rows.map((row) => row.fips));
  const omitted = [...requested].filter((fips) => !seen.has(fips)).length;
  const spec = EXPLORER_OBSERVATION_SPECS[input.layerId];
  return {
    omitted,
    period: explorerMapLayerPeriod(input.layerId),
    rows,
    sourceLabel: null,
    unit: spec.unit,
  };
}
