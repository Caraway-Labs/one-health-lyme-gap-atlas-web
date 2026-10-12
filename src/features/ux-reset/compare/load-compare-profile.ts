"use client";

import {
  alignCompareCountyProfiles,
  compareCountyFailureSide,
  compareCountySideStatuses,
  type CompareCountySide,
  type CompareProfileAlignment,
} from "@/features/ux-reset/compare/compare-county-profile";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function loadCompareCountySide(input: {
  fips: string;
  releaseId: string;
  signal: AbortSignal;
}): Promise<CompareCountySide> {
  try {
    const detail = await loadInvestigateCountyRecord(input);
    if (!detail) {
      return { status: compareCountySideStatuses.missing };
    }
    return { detail, status: compareCountySideStatuses.ready };
  } catch (error) {
    if (isAbortError(error) || input.signal.aborted) {
      throw error;
    }
    return compareCountyFailureSide(error);
  }
}

export async function loadCompareCountyProfiles(input: {
  leftFips: string;
  releaseId: string;
  rightFips: string;
  signal: AbortSignal;
}): Promise<CompareProfileAlignment> {
  const [left, right] = await Promise.all([
    loadCompareCountySide({
      fips: input.leftFips,
      releaseId: input.releaseId,
      signal: input.signal,
    }),
    loadCompareCountySide({
      fips: input.rightFips,
      releaseId: input.releaseId,
      signal: input.signal,
    }),
  ]);
  return alignCompareCountyProfiles({
    left,
    leftFips: input.leftFips,
    right,
    rightFips: input.rightFips,
  });
}
