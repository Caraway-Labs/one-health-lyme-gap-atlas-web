import { afterEach, describe, expect, it, vi } from "vitest";

import {
  identityFromPublishedCounty,
  retryCooldownsFromBundle,
  reusableMeasureOutcomes,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  clearObservationRetryDeadlines,
  INVESTIGATE_OBSERVATION_CONCURRENCY,
  loadCountyEvidenceBundle,
} from "@/features/ux-reset/investigate/load-county-evidence";
import type { Measure } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  INVESTIGATE_RELEASE_ID,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const calls: string[] = [];
let inFlight = 0;
let maxInFlight = 0;
const transientRemaining = new Map<string, number>();
let retryAfterSeconds = 0;
let transientStatus = 429;

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    observationsV1ObservationsGet: vi.fn<
      typeof import("@/generated/atlas").observationsV1ObservationsGet
    >(async (params) => {
      const measureId = params.measure_id;
      calls.push(measureId);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const remaining = transientRemaining.get(measureId) ?? 0;
      if (remaining > 0) {
        transientRemaining.set(measureId, remaining - 1);
        throw new AtlasApiError(
          "rate limited",
          "/v1/observations",
          transientStatus,
          null,
          retryAfterSeconds
        );
      }
      return {
        data: {
          data: investigateObservationsFor({
            fips: "08001",
            measureId: "reported-cases",
            scenario: "sparse",
          }).map((observation) => ({
            ...observation,
            measure_id: measureId,
            observation_id: `obs-${measureId}`,
          })),
          links: { self: "/v1/observations" },
          meta: {},
        },
        headers: new Headers(),
        status: 200,
      } as never;
    }),
  };
});

function measures(count: number): Measure[] {
  return Array.from({ length: count }, (_, index) => ({
    ...(investigateMeasuresFixture[0] as Measure),
    measure_id: `measure-${index}`,
  }));
}

describe("county evidence loading", () => {
  afterEach(() => {
    clearObservationRetryDeadlines();
    transientStatus = 429;
    retryAfterSeconds = 0;
    transientRemaining.clear();
  });

  it("limits concurrent reads and retries a rate limit", async () => {
    calls.length = 0;
    inFlight = 0;
    maxInFlight = 0;
    transientRemaining.clear();
    transientRemaining.set("measure-0", 1);
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const bundle = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(7),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect({
      failures: bundle.measureFailures.length,
      maxInFlight,
      observations: bundle.unassigned.length,
      retried: calls.filter((measureId) => measureId === "measure-0").length,
    }).toStrictEqual({
      failures: 0,
      maxInFlight: INVESTIGATE_OBSERVATION_CONCURRENCY,
      observations: 7,
      retried: 2,
    });
  });

  it("waits the full Retry-After before the next attempt", async () => {
    vi.useFakeTimers();
    calls.length = 0;
    transientRemaining.clear();
    transientRemaining.set("measure-0", 1);
    retryAfterSeconds = 60;
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    try {
      const pending = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: new AbortController().signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      const atStart = calls.length;
      await vi.advanceTimersByTimeAsync(59_000);
      const beforeRetry = calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      const bundle = await pending;
      expect({
        atStart,
        beforeRetry,
        calls: [...calls],
        failures: bundle.measureFailures.length,
      }).toStrictEqual({
        atStart: 1,
        beforeRetry: 1,
        calls: ["measure-0", "measure-0"],
        failures: 0,
      });
    } finally {
      retryAfterSeconds = 0;
      vi.useRealTimers();
    }
  });

  it("reloads failed measures and keeps observations from the same context", async () => {
    calls.length = 0;
    transientRemaining.clear();
    transientRemaining.set("measure-1", 99);
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const first = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(2),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    const caseCalls = calls.filter(
      (measureId) => measureId === "measure-0"
    ).length;
    transientRemaining.clear();
    transientRemaining.set("measure-0", 99);
    const second = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(2),
      period: null,
      preserve: {
        fips: "08001",
        outcomes: reusableMeasureOutcomes(first),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
      },
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect({
      caseCalls: calls.filter((measureId) => measureId === "measure-0").length,
      failures: second.measureFailures.map((failure) => failure.measureId),
      firstFailures: first.measureFailures.map((failure) => failure.measureId),
      ready: [...second.readyMeasureIds],
      unchangedCaseCalls: caseCalls,
    }).toStrictEqual({
      caseCalls,
      failures: [],
      firstFailures: ["measure-1"],
      ready: ["measure-0", "measure-1"],
      unchangedCaseCalls: caseCalls,
    });
  });

  it("keeps Retry-After after automatic attempts are exhausted", async () => {
    vi.useFakeTimers();
    calls.length = 0;
    transientRemaining.clear();
    transientRemaining.set("measure-0", 99);
    retryAfterSeconds = 60;
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const signal = new AbortController();
    try {
      const firstLoad = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: signal.signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      const attempt1 = calls.length;
      await vi.advanceTimersByTimeAsync(60_000);
      const attempt2 = calls.length;
      await vi.advanceTimersByTimeAsync(60_000);
      const first = await firstLoad;
      const attempt3 = calls.length;
      const retryAtMs = first.measureFailures[0]?.retryAtMs ?? 0;
      const cooldownHeld = retryAtMs > Date.now();
      const manual = loadCountyEvidenceBundle({
        cooldowns: retryCooldownsFromBundle(first),
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: signal.signal,
      });
      await vi.advanceTimersByTimeAsync(1000);
      const manualAt121 = calls.length;
      await vi.advanceTimersByTimeAsync(59_000);
      const manualAtDeadline = calls.length;
      signal.abort();
      await manual.catch(() => false);
      expect({
        attempt1,
        attempt2,
        attempt3,
        cooldownHeld,
        manualAt121,
        manualAtDeadline,
      }).toStrictEqual({
        attempt1: 1,
        attempt2: 2,
        attempt3: 3,
        cooldownHeld: true,
        manualAt121: 3,
        manualAtDeadline: 4,
      });
    } finally {
      signal.abort();
      retryAfterSeconds = 0;
      transientRemaining.clear();
      vi.useRealTimers();
    }
  });

  async function cooldownAfterAbortedRead(status: number) {
    vi.useFakeTimers();
    calls.length = 0;
    transientRemaining.set("measure-0", 99);
    retryAfterSeconds = 60;
    transientStatus = status;
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const boulder = identityFromPublishedCounty({
      county: "Boulder",
      fips: "08013",
      state: "CO",
    });
    const started = new AbortController();
    const firstLoad = loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(1),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: started.signal,
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      const atResponse = calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      started.abort();
      await firstLoad.catch(() => false);
      const resumed = new AbortController();
      const secondLoad = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: resumed.signal,
      });
      await vi.advanceTimersByTimeAsync(58_000);
      const whileCooling = calls.length;
      await vi.advanceTimersByTimeAsync(1000);
      const atDeadline = calls.length;
      resumed.abort();
      await secondLoad.catch(() => false);
      calls.length = 0;
      const otherCountySignal = new AbortController();
      const otherCountyLoad = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08013",
        identity: boulder!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: otherCountySignal.signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      const otherCounty = calls.length;
      otherCountySignal.abort();
      await otherCountyLoad.catch(() => false);
      calls.length = 0;
      const otherPeriodSignal = new AbortController();
      const otherPeriodLoad = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: "2024-06-01",
        releaseId: INVESTIGATE_RELEASE_ID,
        signal: otherPeriodSignal.signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      const otherPeriod = calls.length;
      otherPeriodSignal.abort();
      await otherPeriodLoad.catch(() => false);
      calls.length = 0;
      const otherReleaseSignal = new AbortController();
      const otherReleaseLoad = loadCountyEvidenceBundle({
        domainsRequestFailed: false,
        fips: "08001",
        identity: identity!,
        indicators: [],
        measures: measures(1),
        period: null,
        releaseId: "other-release",
        signal: otherReleaseSignal.signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      const otherRelease = calls.length;
      otherReleaseSignal.abort();
      await otherReleaseLoad.catch(() => false);
      return {
        atDeadline,
        atResponse,
        otherCounty,
        otherPeriod,
        otherRelease,
        whileCooling,
      };
    } finally {
      started.abort();
      vi.useRealTimers();
    }
  }

  it("keeps a 429 Retry-After when the wait is aborted", async () => {
    const result = await cooldownAfterAbortedRead(429);
    expect(result).toStrictEqual({
      atDeadline: 2,
      atResponse: 1,
      otherCounty: 1,
      otherPeriod: 1,
      otherRelease: 1,
      whileCooling: 1,
    });
  });

  it("keeps a 503 Retry-After when the wait is aborted", async () => {
    const result = await cooldownAfterAbortedRead(503);
    expect(result).toStrictEqual({
      atDeadline: 2,
      atResponse: 1,
      otherCounty: 1,
      otherPeriod: 1,
      otherRelease: 1,
      whileCooling: 1,
    });
  });

  it("does not reuse evidence from a different county or period", async () => {
    calls.length = 0;
    transientRemaining.clear();
    const identity = identityFromPublishedCounty({
      county: "Denver",
      fips: "08001",
      state: "CO",
    });
    const boulder = identityFromPublishedCounty({
      county: "Boulder",
      fips: "08013",
      state: "CO",
    });
    const first = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(1),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    const preserved = {
      fips: "08001",
      outcomes: reusableMeasureOutcomes(first),
      period: null,
      releaseId: INVESTIGATE_RELEASE_ID,
    };
    const beforePeriod = calls.length;
    await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(1),
      period: "2024-06-01",
      preserve: preserved,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    const afterPeriod = calls.length;
    calls.length = 0;
    await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08001",
      identity: identity!,
      indicators: [],
      measures: measures(1),
      period: null,
      preserve: {
        ...preserved,
        releaseId: "other-release",
      },
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    const afterRelease = calls.length;
    calls.length = 0;
    const crossed = await loadCountyEvidenceBundle({
      domainsRequestFailed: false,
      fips: "08013",
      identity: boulder!,
      indicators: [],
      measures: measures(1),
      period: null,
      preserve: preserved,
      releaseId: INVESTIGATE_RELEASE_ID,
      signal: new AbortController().signal,
    });
    expect({
      carriedDenver: crossed.unassigned.some(
        (record) => record.observation.geography.geography_id === "08001"
      ),
      county: crossed.county.fips,
      periodRefetched: afterPeriod > beforePeriod,
      releaseRefetched: afterRelease > 0,
      requestedBoulder: calls.length > 0,
    }).toStrictEqual({
      carriedDenver: false,
      county: "08013",
      periodRefetched: true,
      releaseRefetched: true,
      requestedBoulder: true,
    });
  });
});
