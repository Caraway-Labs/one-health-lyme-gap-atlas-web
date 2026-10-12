"use client";

import {
  compareCountyFailureSide,
  compareCountySideStatuses,
  type CompareCountySide,
} from "@/features/ux-reset/compare/compare-county-profile";
import { withCompareReadLimit } from "@/features/ux-reset/compare/compare-read-limit";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { AtlasApiError } from "@/lib/api-mutator";

const MILLISECONDS_PER_SECOND = 1000;

/**
 * Deadlines received from Retry-After on county records. Kept outside the
 * profile query so a remount does not drop the server's wait.
 */
const profileRetryDeadlines = new Map<string, number>();

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function profileCooldownKey(releaseId: string): string {
  return releaseId;
}

export function clearCompareProfileRetryDeadlines(): void {
  profileRetryDeadlines.clear();
}

export function rememberCompareProfileCooldown(
  releaseId: string,
  retryAfterSeconds: number | null
): void {
  if (retryAfterSeconds === null || retryAfterSeconds < 0) {
    return;
  }
  const retryAtMs = Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND;
  const key = profileCooldownKey(releaseId);
  const existing = profileRetryDeadlines.get(key);
  if (existing === undefined || retryAtMs > existing) {
    profileRetryDeadlines.set(key, retryAtMs);
  }
}

export function forgetCompareProfileCooldown(releaseId: string): void {
  profileRetryDeadlines.delete(profileCooldownKey(releaseId));
}

export function compareProfileCoolingDown(releaseId: string | null): boolean {
  if (!releaseId) {
    return false;
  }
  const retryAtMs =
    profileRetryDeadlines.get(profileCooldownKey(releaseId)) ?? null;
  return retryAtMs !== null && retryAtMs > Date.now();
}

function preservesRetryAfter(error: unknown): error is AtlasApiError {
  return (
    error instanceof AtlasApiError &&
    (error.status === 429 || (error.status >= 500 && error.status < 600)) &&
    error.retryAfterSeconds !== null
  );
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (ms <= 0) {
    return;
  }
  const { promise, reject, resolve } = Promise.withResolvers<boolean>();
  const timer = setTimeout(() => {
    signal.removeEventListener("abort", onAbort);
    resolve(true);
  }, ms);
  const onAbort = () => {
    clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  };
  signal.addEventListener("abort", onAbort, { once: true });
  await promise;
}

/** Waits out a stored county-record deadline. Aborting the wait does not clear it. */
export async function waitForCompareProfileCooldown(
  releaseId: string,
  signal: AbortSignal
): Promise<void> {
  const retryAtMs =
    profileRetryDeadlines.get(profileCooldownKey(releaseId)) ?? 0;
  await delay(retryAtMs - Date.now(), signal);
}

export type CompareProfileRecords = {
  left: CompareCountySide;
  leftFips: string;
  right: CompareCountySide;
  rightFips: string;
};

export async function loadCompareCountySide(input: {
  fips: string;
  releaseId: string;
  signal: AbortSignal;
}): Promise<CompareCountySide> {
  try {
    const detail = await withCompareReadLimit(input.signal, () =>
      loadInvestigateCountyRecord(input)
    );
    if (!detail) {
      return { status: compareCountySideStatuses.missing };
    }
    return { detail, status: compareCountySideStatuses.ready };
  } catch (error) {
    if (isAbortError(error) || input.signal.aborted) {
      throw error;
    }
    if (preservesRetryAfter(error)) {
      rememberCompareProfileCooldown(input.releaseId, error.retryAfterSeconds);
      throw error;
    }
    return compareCountyFailureSide(error);
  }
}

function preferredRetryError(errors: readonly unknown[]): unknown {
  let preferred: AtlasApiError | null = null;
  for (const error of errors) {
    if (!preservesRetryAfter(error)) {
      continue;
    }
    if (
      preferred === null ||
      (error.retryAfterSeconds ?? 0) > (preferred.retryAfterSeconds ?? 0)
    ) {
      preferred = error;
    }
  }
  return preferred ?? errors[0];
}

export async function loadCompareCountyProfiles(input: {
  leftFips: string;
  releaseId: string;
  rightFips: string;
  signal: AbortSignal;
}): Promise<CompareProfileRecords> {
  await waitForCompareProfileCooldown(input.releaseId, input.signal);
  const [left, right] = await Promise.allSettled([
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
  const rejected = [left, right].flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (rejected.length > 0) {
    if (
      input.signal.aborted ||
      rejected.some((reason) => isAbortError(reason))
    ) {
      throw rejected.find((reason) => isAbortError(reason)) ?? rejected[0];
    }
    throw preferredRetryError(rejected);
  }
  if (left.status !== "fulfilled" || right.status !== "fulfilled") {
    throw new Error("County records did not settle.");
  }
  forgetCompareProfileCooldown(input.releaseId);
  return {
    left: left.value,
    leftFips: input.leftFips,
    right: right.value,
    rightFips: input.rightFips,
  };
}
