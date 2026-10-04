import { formatGovernedMeasureType } from "./format-period";

/** Governed measure/signal kind from catalog metadata (`Measure.measure_type`). */
export function evidenceTypeFromGovernedMetadata(
  measureType: string | null | undefined
): string {
  if (!measureType?.trim()) {
    return "Unavailable";
  }
  return formatGovernedMeasureType(measureType);
}
