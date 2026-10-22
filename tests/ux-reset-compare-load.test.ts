import { afterEach, describe, expect, it, vi } from "vitest";

import {
  compareWithholdReasonValues,
  type CompareCell,
  type CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import { compareReaderState } from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  COMPARE_PUBLIC_READ_LIMIT,
  resetCompareReadLimit,
} from "@/features/ux-reset/compare/compare-read-limit";
import {
  clearCompareObservationRetryDeadlines,
  compareObservationRequestRejection,
  compareRetryCooldowns,
  loadCompareEvidence,
  preservedCompareMeasures,
} from "@/features/ux-reset/compare/load-compare-evidence";
import { loadCompareCountyProfiles } from "@/features/ux-reset/compare/load-compare-profile";
import type { Measure } from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";

import {
  COMPARE_CANOPY_MEASURE_ID,
  COMPARE_CASES_MEASURE_ID,
  COMPARE_LEFT_FIPS,
  COMPARE_RELEASE_ID,
  COMPARE_RIGHT_FIPS,
  COMPARE_TICK_MEASURE_ID,
  compareMeasuresFixture,
  compareObservation,
  compareObservationsFor,
} from "./fixtures/compare-api-fixtures";

const requests: string[] = [];
const COMPARE_READ_POLL_ATTEMPTS = 20;

async function waitForCompareReads(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < COMPARE_READ_POLL_ATTEMPTS; attempt += 1) {
    if (ready()) {
      return;
    }
    const pending = Promise.withResolvers<boolean>();
    setTimeout(() => {
      pending.resolve(true);
    }, 0);
    await pending.promise;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    headers: { "content-type": "application/json" },
    status,
  });
}

function observationRecord(cell: CompareCell) {
  if (cell.kind !== "observations") {
    throw new Error("Expected observation records.");
  }
  const record = cell.records[0];
  if (!record) {
    throw new Error("Expected an observation record.");
  }
  return record;
}

function withheldRelation(relation: CompareRelation) {
  if (relation.kind !== "withheld") {
    throw new Error("Expected a withheld comparison.");
  }
  return relation;
}

function observationsForRequest(url: URL) {
  const measureId = url.searchParams.get("measure_id") ?? "";
  const fips = url.searchParams.getAll("geography_id");
  if (measureId === COMPARE_TICK_MEASURE_ID) {
    return [
      compareObservation({
        fips: "08014",
        measureId,
        unit: "detections",
        value: 1,
      }),
    ];
  }
  if (measureId === "bad-shape") {
    return [{ measure_id: 12 }];
  }
  return compareObservationsFor({ fips, measureId });
}

describe("compare evidence loading through the generated client", () => {
  afterEach(() => {
    clearCompareObservationRetryDeadlines();
    resetCompareReadLimit();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    requests.length = 0;
  });

  it("loads one comparable measure through the generated client", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(`${url.pathname}?${url.searchParams.toString()}`);
      const rejection = compareObservationRequestRejection({
        geography_id: url.searchParams.getAll("geography_id"),
        geography_type: "county",
        measure_id: url.searchParams.get("measure_id") ?? "",
        page_size: 100,
        year: Number(url.searchParams.get("year")),
      });
      if (rejection || url.searchParams.get("page_token") === "null") {
        return jsonResponse({ detail: "invalid request" }, rejection ?? 400);
      }
      const measureId = url.searchParams.get("measure_id") ?? "";
      if (measureId === "bad-shape") {
        return jsonResponse({ data: observationsForRequest(url) });
      }
      const envelope = ObservationsV1ObservationsGetResponse.parse({
        data: observationsForRequest(url),
        links: { self: "/v1/observations" },
        meta: {},
      });
      return jsonResponse(envelope);
    });

    const measures = compareMeasuresFixture.filter((measure) =>
      [COMPARE_CASES_MEASURE_ID, COMPARE_CANOPY_MEASURE_ID].includes(
        measure.measure_id
      )
    );
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const cases = alignment.rows.find(
      (row) => row.measureId === COMPARE_CASES_MEASURE_ID
    );
    if (!cases) {
      throw new Error("Expected the comparable cases row.");
    }
    expect(cases.relation).toMatchObject({
      kind: "different",
      signedDifference: -12,
    });
    expect(
      observationRecord(cases.left).observation.geography.geography_id
    ).toBe(COMPARE_LEFT_FIPS);
    expect(observationRecord(cases.left).evidence.displayValue).toContain("12");
    expect(observationRecord(cases.right).observation.value_state).toBe("ZERO");
    expect(observationRecord(cases.right).evidence.displayValue).toContain("0");
  });

  it("withholds a period mismatch returned by the generated client", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(`${url.pathname}?${url.searchParams.toString()}`);
      const envelope = ObservationsV1ObservationsGetResponse.parse({
        data: observationsForRequest(url),
        links: { self: "/v1/observations" },
        meta: {},
      });
      return jsonResponse(envelope);
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: compareMeasuresFixture.filter(
        (measure) => measure.measure_id === COMPARE_CANOPY_MEASURE_ID
      ),
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const canopy = alignment.rows.find(
      (row) => row.measureId === COMPARE_CANOPY_MEASURE_ID
    );
    if (!canopy) {
      throw new Error("Expected the canopy row.");
    }
    const relation = withheldRelation(canopy.relation);
    expect(relation.reasons).toContain(
      compareWithholdReasonValues.periodMismatch
    );
    expect(relation.explanation).toContain("periods differ");
    expect(
      requests.some(
        (request) =>
          request.includes(`measure_id=${COMPARE_CANOPY_MEASURE_ID}`) &&
          request.includes("geography_id=08001") &&
          request.includes("geography_id=08013")
      )
    ).toBeTruthy();
  });

  it("requests both counties together for the comparable measure", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(`${url.pathname}?${url.searchParams.toString()}`);
      const envelope = ObservationsV1ObservationsGetResponse.parse({
        data: observationsForRequest(url),
        links: { self: "/v1/observations" },
        meta: {},
      });
      return jsonResponse(envelope);
    });
    await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: compareMeasuresFixture.filter(
        (measure) => measure.measure_id === COMPARE_CASES_MEASURE_ID
      ),
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    expect(
      requests.some(
        (request) =>
          request.includes("measure_id=reported-cases") &&
          request.includes("geography_id=08001") &&
          request.includes("geography_id=08013")
      )
    ).toBeTruthy();
  });

  it("rejects an invalid pair before calling the API", async () => {
    vi.stubGlobal("fetch", async () => {
      requests.push("called");
      return jsonResponse({ detail: "invalid request" }, 400);
    });
    await expect(
      loadCompareEvidence({
        leftFips: COMPARE_LEFT_FIPS,
        leftLabel: "Denver",
        measures: compareMeasuresFixture,
        period: null,
        releaseId: COMPARE_RELEASE_ID,
        rightFips: COMPARE_LEFT_FIPS,
        rightLabel: "Denver",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/two different county/i);
    expect(requests).toStrictEqual([]);
  });

  it("fails a foreign county without shifting the comparable row", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url.toString());
      const measureId = url.searchParams.get("measure_id") ?? "";
      const fips = url.searchParams.getAll("geography_id");
      const data =
        measureId === COMPARE_TICK_MEASURE_ID
          ? observationsForRequest(url)
          : compareObservationsFor({ fips, measureId });
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data,
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });

    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver",
      measures: compareMeasuresFixture.filter((measure) =>
        [COMPARE_CASES_MEASURE_ID, COMPARE_TICK_MEASURE_ID].includes(
          measure.measure_id
        )
      ) as Measure[],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder",
      signal: new AbortController().signal,
    });
    const cases = alignment.rows.find(
      (row) => row.measureId === COMPARE_CASES_MEASURE_ID
    );
    const tick = alignment.rows.find(
      (row) => row.measureId === COMPARE_TICK_MEASURE_ID
    );
    if (!(cases && tick)) {
      throw new Error("Expected the comparable row and the failed row.");
    }
    expect(cases.relation.kind).toBe("different");
    expect(observationRecord(cases.left).observation.value).toBe(12);
    expect(tick.relation.kind).toBe("withheld");
    expect(tick.left).toMatchObject({ kind: "empty", reason: "failed" });
    expect(tick.right).toMatchObject({ kind: "empty", reason: "failed" });
  });

  it("rejects a noncomparable response shape and an invalid observation request", async () => {
    expect(
      compareObservationRequestRejection({
        geography_id: [COMPARE_LEFT_FIPS, COMPARE_LEFT_FIPS],
        geography_type: "county",
        measure_id: COMPARE_CASES_MEASURE_ID,
        year: 2023,
      })
    ).toBe(400);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.getAll("geography_id").length !== 2) {
        return jsonResponse({ detail: "invalid request" }, 400);
      }
      return jsonResponse({ data: [{ measure_id: false }] });
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver",
      measures: [compareMeasuresFixture[0] as Measure],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder",
      signal: new AbortController().signal,
    });
    expect(alignment.rows[0]?.relation.kind).toBe("withheld");
    expect(alignment.rows[0]?.left).toMatchObject({
      kind: "empty",
      reason: "failed",
    });
  });

  it("retries a 503 and uses the later successful observation", async () => {
    let failures = 1;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url.searchParams.get("measure_id") ?? "");
      if (failures > 0) {
        failures -= 1;
        return jsonResponse({ detail: "unavailable" }, 503);
      }
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: observationsForRequest(url),
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: compareMeasuresFixture.filter(
        (measure) => measure.measure_id === COMPARE_CASES_MEASURE_ID
      ),
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    expect({
      relation: alignment.rows[0]?.relation.kind,
      requests: [...requests],
    }).toStrictEqual({
      relation: "different",
      requests: [COMPARE_CASES_MEASURE_ID, COMPARE_CASES_MEASURE_ID],
    });
  });

  it("waits the full Retry-After before the next observation attempt", async () => {
    vi.useFakeTimers();
    let failures = 1;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url.searchParams.get("measure_id") ?? "");
      if (failures > 0) {
        failures -= 1;
        return Response.json(
          { detail: "slow" },
          {
            headers: {
              "content-type": "application/json",
              "retry-after": "60",
            },
            status: 429,
          }
        );
      }
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: observationsForRequest(url),
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const pending = loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: compareMeasuresFixture.filter(
        (measure) => measure.measure_id === COMPARE_CASES_MEASURE_ID
      ),
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    await vi.advanceTimersByTimeAsync(0);
    const atStart = requests.length;
    await vi.advanceTimersByTimeAsync(59_000);
    const beforeRetry = requests.length;
    await vi.advanceTimersByTimeAsync(1000);
    const alignment = await pending;
    expect({
      atStart,
      beforeRetry,
      relation: alignment.rows[0]?.relation.kind,
      requests: requests.length,
    }).toStrictEqual({
      atStart: 1,
      beforeRetry: 1,
      relation: "different",
      requests: 2,
    });
  });

  it("retries a failed measure without requesting one that already loaded", async () => {
    const failures = new Map<string, number>([[COMPARE_TICK_MEASURE_ID, 99]]);
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const measureId = url.searchParams.get("measure_id") ?? "";
      requests.push(measureId);
      const remaining = failures.get(measureId) ?? 0;
      if (remaining > 0) {
        failures.set(measureId, remaining - 1);
        return jsonResponse({ detail: "unavailable" }, 503);
      }
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: compareObservationsFor({
            fips: url.searchParams.getAll("geography_id"),
            measureId,
          }),
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const measures = compareMeasuresFixture.filter((measure) =>
      [COMPARE_CASES_MEASURE_ID, COMPARE_TICK_MEASURE_ID].includes(
        measure.measure_id
      )
    );
    const first = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const caseCalls = requests.filter(
      (measureId) => measureId === COMPARE_CASES_MEASURE_ID
    ).length;
    failures.set(COMPARE_TICK_MEASURE_ID, 0);
    const second = await loadCompareEvidence({
      cooldowns: compareRetryCooldowns(first),
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      preserve: preservedCompareMeasures({
        alignment: first,
        leftFips: COMPARE_LEFT_FIPS,
        period: null,
        releaseId: COMPARE_RELEASE_ID,
        rightFips: COMPARE_RIGHT_FIPS,
      }),
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const outcomeStatus = (alignment: typeof first, measureId: string) =>
      alignment.outcomes.find((outcome) => outcome.measureId === measureId)
        ?.status ?? "";
    expect({
      caseCallsAfter: requests.filter(
        (measureId) => measureId === COMPARE_CASES_MEASURE_ID
      ).length,
      firstTick: outcomeStatus(first, COMPARE_TICK_MEASURE_ID),
      secondCases: outcomeStatus(second, COMPARE_CASES_MEASURE_ID),
      secondTick: outcomeStatus(second, COMPARE_TICK_MEASURE_ID),
      unchangedCaseCalls: caseCalls,
    }).toStrictEqual({
      caseCallsAfter: caseCalls,
      firstTick: "failed",
      secondCases: "ready",
      secondTick: "ready",
      unchangedCaseCalls: caseCalls,
    });
  });

  it("refetches a known-empty comparison and then shows rows or a failure", async () => {
    const phase = {
      value: "known-empty" as "failure" | "known-empty" | "rows",
    };
    const limitation =
      "No published observations match this selection in the checked release. This does not establish biological absence, source coverage, or geography membership.";
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const measureId = url.searchParams.get("measure_id") ?? "";
      requests.push(measureId);
      if (measureId === COMPARE_CASES_MEASURE_ID && phase.value === "failure") {
        return jsonResponse({ detail: "unavailable" }, 503);
      }
      if (
        measureId === COMPARE_CASES_MEASURE_ID &&
        phase.value === "known-empty"
      ) {
        return jsonResponse(
          ObservationsV1ObservationsGetResponse.parse({
            data: [],
            links: { self: "/v1/observations" },
            meta: {
              availability: "UNAVAILABLE",
              limitations: [limitation],
              next_page_token: null,
              reason: "NO_PUBLISHED_RESULTS",
              release_id: COMPARE_RELEASE_ID,
              response_at: "2026-10-18T00:00:00.000Z",
            },
          })
        );
      }
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: compareObservationsFor({
            fips: url.searchParams.getAll("geography_id"),
            measureId,
          }),
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const measures = compareMeasuresFixture.filter((measure) =>
      [COMPARE_CASES_MEASURE_ID, COMPARE_TICK_MEASURE_ID].includes(
        measure.measure_id
      )
    );
    const first = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const tickCalls = requests.filter(
      (measureId) => measureId === COMPARE_TICK_MEASURE_ID
    ).length;
    const caseCalls = requests.filter(
      (measureId) => measureId === COMPARE_CASES_MEASURE_ID
    ).length;
    const preserved = preservedCompareMeasures({
      alignment: first,
      leftFips: COMPARE_LEFT_FIPS,
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
    });
    phase.value = "rows";
    const withRows = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      preserve: preserved,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    phase.value = "failure";
    const failed = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      preserve: preserved,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const readyCases = (alignment: typeof first) => {
      const outcome = alignment.outcomes.find(
        (entry) => entry.measureId === COMPARE_CASES_MEASURE_ID
      );
      if (outcome?.status !== "ready") {
        return null;
      }
      return outcome;
    };
    const firstCases = readyCases(first);
    const rowCases = readyCases(withRows);
    expect({
      caseCalls: requests.filter(
        (measureId) => measureId === COMPARE_CASES_MEASURE_ID
      ).length,
      failedCases: failed.outcomes.find(
        (outcome) => outcome.measureId === COMPARE_CASES_MEASURE_ID
      )?.status,
      firstKnownEmpty: Boolean(firstCases?.selectionAvailability),
      firstRows: firstCases?.observations.length ?? -1,
      rowKnownEmpty: rowCases?.selectionAvailability ?? null,
      rowRows: rowCases?.observations.length ?? 0,
      tickCalls: requests.filter(
        (measureId) => measureId === COMPARE_TICK_MEASURE_ID
      ).length,
    }).toStrictEqual({
      caseCalls: caseCalls + 1 + 3,
      failedCases: "failed",
      firstKnownEmpty: true,
      firstRows: 0,
      rowKnownEmpty: null,
      rowRows: 2,
      tickCalls,
    });
  });

  it("keeps county records and observations within five concurrent reads", async () => {
    const controller = new AbortController();
    let inFlight = 0;
    let maxInFlight = 0;
    let started = 0;
    const release: (() => void)[] = [];
    vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
      started += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const pending = Promise.withResolvers<Response>();
      const finish = (aborted: boolean) => {
        inFlight -= 1;
        if (aborted) {
          pending.reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        pending.resolve(
          Response.json(
            { detail: "held" },
            {
              headers: { "content-type": "application/json" },
              status: 400,
            }
          )
        );
      };
      init?.signal?.addEventListener("abort", () => finish(true), {
        once: true,
      });
      release.push(() => finish(false));
      return pending.promise;
    });
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    const measures = ["m1", "m2", "m3", "m4", "m5"].map((measureId) => ({
      ...base,
      measure_id: measureId,
    }));
    const evidence = loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures,
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: controller.signal,
    });
    const profile = loadCompareCountyProfiles({
      leftFips: COMPARE_LEFT_FIPS,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      signal: controller.signal,
    });
    await waitForCompareReads(() => started >= COMPARE_PUBLIC_READ_LIMIT);
    const first = release.shift();
    if (!first) {
      throw new Error("No read was waiting on the shared limit.");
    }
    const held = started;
    const peak = maxInFlight;
    first();
    await waitForCompareReads(() => started >= held + 1);
    expect({
      nextStarted: started,
      peak,
      queued: held,
    }).toStrictEqual({
      nextStarted: COMPARE_PUBLIC_READ_LIMIT + 1,
      peak: COMPARE_PUBLIC_READ_LIMIT,
      queued: COMPARE_PUBLIC_READ_LIMIT,
    });
    controller.abort();
    await Promise.allSettled([evidence, profile]);
  });

  it("tries governed-date, shared day, 2023, then 2025-12-31 before a plain missing cell", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    const measure: Measure = {
      ...base,
      label: "Seasonal canopy",
      measure_id: "unbound-gap",
      temporal_grains: ["CUSTOM"],
      temporal_semantics: "2024-06-01",
    };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const year = url.searchParams.get("year");
      const start = url.searchParams.get("start_date");
      requests.push(year ? `year:${year}` : `day:${start ?? ""}`);
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: [],
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: [measure],
      period: "2025-01-15",
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const cell = alignment.rows[0]?.left;
    expect({
      bounds: requests,
      message: cell?.kind === "empty" ? cell.message : "",
      reason: cell?.kind === "empty" ? cell.reason : "",
      status: alignment.outcomes[0]?.status ?? "",
      unsupported: alignment.outcomes.some(
        (outcome) => outcome.status === "unsupported_period"
      ),
    }).toStrictEqual({
      bounds: [
        "day:2024-06-01",
        "day:2025-01-15",
        "year:2023",
        "day:2025-12-31",
      ],
      message: "No observation. This absence is not zero.",
      reason: "missing",
      status: "ready",
      unsupported: false,
    });
  });

  it("falls through a rejected fallback bound and stops on the first observations", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const year = url.searchParams.get("year");
      const start = url.searchParams.get("start_date");
      requests.push(year ? `year:${year}` : `day:${start ?? ""}`);
      if (year === "2023") {
        return jsonResponse(
          ObservationsV1ObservationsGetResponse.parse({
            data: compareObservationsFor({
              fips: url.searchParams.getAll("geography_id"),
              measureId: "unbound-gap",
            }),
            links: { self: "/v1/observations" },
            meta: {},
          })
        );
      }
      return jsonResponse(
        {
          code: "UNSUPPORTED_FILTER",
          detail: "This time filter is not supported for the measure.",
        },
        400
      );
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: [
        {
          ...base,
          label: "Seasonal canopy",
          measure_id: "unbound-gap",
          temporal_grains: ["CUSTOM"],
          temporal_semantics: "2024-06-01",
        },
      ],
      period: "2025-01-15",
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    expect({
      bounds: requests,
      kind: alignment.rows[0]?.left.kind ?? "",
    }).toStrictEqual({
      bounds: ["day:2024-06-01", "day:2025-01-15", "year:2023"],
      kind: "observations",
    });
  });

  it("fails the measure when every fallback is unauthorized", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    const statuses = [401, 403];
    const loaded = [];
    for (const status of statuses) {
      requests.length = 0;
      vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(
          url.searchParams.get("start_date") ??
            url.searchParams.get("year") ??
            ""
        );
        return jsonResponse({ detail: "not allowed" }, status);
      });
      const alignment = await loadCompareEvidence({
        leftFips: COMPARE_LEFT_FIPS,
        leftLabel: "Denver, Colorado (08001)",
        measures: [
          {
            ...base,
            label: "Seasonal canopy",
            measure_id: "unbound-gap",
            temporal_grains: ["CUSTOM"],
            temporal_semantics: "2024-06-01",
          },
        ],
        period: null,
        releaseId: COMPARE_RELEASE_ID,
        rightFips: COMPARE_RIGHT_FIPS,
        rightLabel: "Boulder, Colorado (08013)",
        signal: new AbortController().signal,
      });
      const cell = alignment.rows[0]?.left;
      loaded.push({
        laterBound: requests.includes("2023"),
        reader:
          cell?.kind === "empty"
            ? compareReaderState(cell.reason, cell.message)
            : "",
        reason: cell?.kind === "empty" ? cell.reason : "",
        status: alignment.outcomes[0]?.status ?? "",
      });
    }
    expect(loaded).toStrictEqual([
      {
        laterBound: false,
        reader: "Couldn\u2019t load this evidence.",
        reason: "failed",
        status: "failed",
      },
      {
        laterBound: false,
        reader: "Couldn\u2019t load this evidence.",
        reason: "failed",
        status: "failed",
      },
    ]);
  });

  it("does not turn a rejected 400 or 422 into an empty read", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    const statuses = [400, 422];
    const loaded = [];
    for (const status of statuses) {
      requests.length = 0;
      vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(
          url.searchParams.get("start_date") ??
            url.searchParams.get("year") ??
            ""
        );
        return jsonResponse(
          { code: "INVALID_REQUEST", detail: "rejected filter" },
          status
        );
      });
      const alignment = await loadCompareEvidence({
        leftFips: COMPARE_LEFT_FIPS,
        leftLabel: "Denver, Colorado (08001)",
        measures: [
          {
            ...base,
            label: "Seasonal canopy",
            measure_id: "unbound-gap",
            temporal_grains: ["CUSTOM"],
            temporal_semantics: "2024-06-01",
          },
        ],
        period: null,
        releaseId: COMPARE_RELEASE_ID,
        rightFips: COMPARE_RIGHT_FIPS,
        rightLabel: "Boulder, Colorado (08013)",
        signal: new AbortController().signal,
      });
      const cell = alignment.rows[0]?.left;
      loaded.push({
        laterBound: requests.includes("2023"),
        reason: cell?.kind === "empty" ? cell.reason : "",
        status: alignment.outcomes[0]?.status ?? "",
      });
    }
    expect(loaded).toStrictEqual([
      { laterBound: false, reason: "failed", status: "failed" },
      { laterBound: false, reason: "failed", status: "failed" },
    ]);
  });

  it("does not report a missing value when every time filter is incompatible", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(
        url.searchParams.get("start_date") ?? url.searchParams.get("year") ?? ""
      );
      return jsonResponse(
        {
          code: "UNSUPPORTED_FILTER",
          detail: "This time filter is not supported for the measure.",
        },
        400
      );
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: [
        {
          ...base,
          label: "Seasonal canopy",
          measure_id: "unbound-gap",
          temporal_grains: ["CUSTOM"],
          temporal_semantics: "2024-06-01",
        },
      ],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    const cell = alignment.rows[0]?.left;
    expect({
      bounds: requests,
      reader:
        cell?.kind === "empty"
          ? compareReaderState(cell.reason, cell.message)
          : "",
      status: alignment.outcomes[0]?.status ?? "",
    }).toStrictEqual({
      bounds: ["2024-06-01", "2023", "2025-12-31"],
      reader: "Couldn\u2019t load this evidence.",
      status: "failed",
    });
  });

  it("does not try the next bound after a 429", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(
        url.searchParams.get("start_date") ?? url.searchParams.get("year") ?? ""
      );
      return jsonResponse({ detail: "slow down" }, 429);
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: [
        {
          ...base,
          label: "Seasonal canopy",
          measure_id: "unbound-gap",
          temporal_grains: ["CUSTOM"],
          temporal_semantics: "2024-06-01",
        },
      ],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    expect({
      laterBound: requests.includes("2023"),
      status: alignment.outcomes[0]?.status ?? "",
      tried: new Set(requests),
    }).toStrictEqual({
      laterBound: false,
      status: "failed",
      tried: new Set(["2024-06-01"]),
    });
  });

  it("never requests an nclimgrid measure", async () => {
    const base = compareMeasuresFixture[0];
    if (!base) {
      throw new Error("Missing compare measure fixture.");
    }
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url.searchParams.get("measure_id") ?? "");
      return jsonResponse(
        ObservationsV1ObservationsGetResponse.parse({
          data: compareObservationsFor({
            fips: url.searchParams.getAll("geography_id"),
            measureId: url.searchParams.get("measure_id") ?? "",
          }),
          links: { self: "/v1/observations" },
          meta: {},
        })
      );
    });
    const alignment = await loadCompareEvidence({
      leftFips: COMPARE_LEFT_FIPS,
      leftLabel: "Denver, Colorado (08001)",
      measures: [
        base,
        {
          ...base,
          label: "nClimGrid average temperature",
          measure_id: "nclimgrid_tavg_county_day",
        },
      ],
      period: null,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      rightLabel: "Boulder, Colorado (08013)",
      signal: new AbortController().signal,
    });
    expect(alignment.rows.map((row) => row.measureId)).toStrictEqual([
      base.measure_id,
    ]);
  });
});
