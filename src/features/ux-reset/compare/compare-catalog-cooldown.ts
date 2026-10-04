import { AtlasApiError } from "@/lib/api-mutator";

const MILLISECONDS_PER_SECOND = 1000;
const UNSCHEDULED_RETRY_CAP_MS = 30_000;

/**
 * Deadlines for the governed measure catalog, keyed like the measures query.
 * Kept outside the query so an abort or remount does not drop the server's wait.
 */
const catalogRetryDeadlines = new Map<string, number>();

type CatalogRetryDelaySetting =
  | number
  | ((failureCount: number, error: Error) => number)
  | undefined;

function catalogCooldownKey(releaseId: string): string {
  return `ux-reset-compare-measures\u0000${releaseId}`;
}

export function clearCompareCatalogRetryDeadlines(): void {
  catalogRetryDeadlines.clear();
}

export function rememberCompareCatalogCooldown(
  releaseId: string,
  retryAfterSeconds: number | null
): void {
  if (retryAfterSeconds === null || retryAfterSeconds < 0) {
    return;
  }
  const retryAtMs = Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND;
  const key = catalogCooldownKey(releaseId);
  const existing = catalogRetryDeadlines.get(key);
  if (existing === undefined || retryAtMs > existing) {
    catalogRetryDeadlines.set(key, retryAtMs);
  }
}

export function forgetCompareCatalogCooldown(releaseId: string): void {
  catalogRetryDeadlines.delete(catalogCooldownKey(releaseId));
}

export function compareCatalogRetryAtMs(releaseId: string): number | null {
  return catalogRetryDeadlines.get(catalogCooldownKey(releaseId)) ?? null;
}

export function compareCatalogCoolingDown(releaseId: string | null): boolean {
  if (!releaseId) {
    return false;
  }
  const retryAtMs = compareCatalogRetryAtMs(releaseId);
  return retryAtMs !== null && retryAtMs > Date.now();
}

function retryAfterDelayMs(error: unknown): number | null {
  if (!(error instanceof AtlasApiError) || error.retryAfterSeconds === null) {
    return null;
  }
  if (error.retryAfterSeconds < 0) {
    return null;
  }
  return error.retryAfterSeconds * MILLISECONDS_PER_SECOND;
}

export function compareCatalogRetryDelay(
  failureCount: number,
  error: unknown,
  configured: CatalogRetryDelaySetting
): number {
  const governed = retryAfterDelayMs(error);
  if (governed !== null) {
    return governed;
  }
  if (typeof configured === "number") {
    return configured;
  }
  if (typeof configured === "function" && error instanceof Error) {
    return configured(failureCount, error);
  }
  return Math.min(
    MILLISECONDS_PER_SECOND * 2 ** failureCount,
    UNSCHEDULED_RETRY_CAP_MS
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

/** Waits out a stored catalog deadline. Aborting the wait does not clear it. */
export async function waitForCompareCatalogCooldown(
  releaseId: string,
  signal: AbortSignal
): Promise<void> {
  const retryAtMs = compareCatalogRetryAtMs(releaseId) ?? 0;
  await delay(retryAtMs - Date.now(), signal);
}
