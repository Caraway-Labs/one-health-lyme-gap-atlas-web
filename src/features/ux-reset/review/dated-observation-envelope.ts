import type { Observation } from "@/generated/models";

export class DatedObservationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatedObservationContractError";
  }
}

function rowRecord(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  return row as Record<string, unknown>;
}

/**
 * Dated Explore, Investigate, Compare, and PDF consumers keep the original
 * observation period. A county-context row is rejected instead of given a
 * manufactured date.
 */
export function readDatedObservations(rows: readonly unknown[]): Observation[] {
  const dated: Observation[] = [];
  for (const row of rows) {
    const record = rowRecord(row);
    if (!record) {
      throw new DatedObservationContractError(
        "A dated observation row is missing."
      );
    }
    if (record.county_context != null) {
      throw new DatedObservationContractError(
        "A dated observation request returned county context. This consumer does not invent dates for that row."
      );
    }
    if (
      typeof record.period_start !== "string" ||
      record.period_start.length === 0 ||
      typeof record.period_end !== "string" ||
      record.period_end.length === 0
    ) {
      throw new DatedObservationContractError(
        "A dated observation is missing its governed period."
      );
    }
    dated.push(row as Observation);
  }
  return dated;
}
