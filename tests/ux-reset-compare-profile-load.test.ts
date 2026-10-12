import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearCompareProfileRetryDeadlines,
  compareProfileCoolingDown,
  loadCompareCountyProfiles,
} from "@/features/ux-reset/compare/load-compare-profile";

import {
  COMPARE_LEFT_FIPS,
  COMPARE_RELEASE_ID,
  COMPARE_RIGHT_FIPS,
} from "./fixtures/compare-api-fixtures";

let countyStatus = 429;
let retryAfter: string | null = "60";
let countyCalls = 0;

function countyResponse(): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (retryAfter !== null) {
    headers.set("Retry-After", retryAfter);
  }
  return Response.json(
    { detail: "county record unavailable" },
    { headers, status: countyStatus }
  );
}

describe("compare county-record loading", () => {
  afterEach(() => {
    clearCompareProfileRetryDeadlines();
    countyCalls = 0;
    countyStatus = 429;
    retryAfter = "60";
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rethrows a rate limit and waits out Retry-After before the next read", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (!url.pathname.includes("/v1/counties/")) {
        return Response.json({ detail: "unused" }, { status: 404 });
      }
      countyCalls += 1;
      return countyResponse();
    });
    const signal = new AbortController().signal;
    const first = loadCompareCountyProfiles({
      leftFips: COMPARE_LEFT_FIPS,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      signal,
    });
    await expect(first).rejects.toMatchObject({
      retryAfterSeconds: 60,
      status: 429,
    });
    expect({
      calls: countyCalls,
      cooling: compareProfileCoolingDown(COMPARE_RELEASE_ID),
    }).toStrictEqual({
      calls: 2,
      cooling: true,
    });

    let secondError: unknown = null;
    const captureSecond = async () => {
      try {
        await loadCompareCountyProfiles({
          leftFips: COMPARE_LEFT_FIPS,
          releaseId: COMPARE_RELEASE_ID,
          rightFips: COMPARE_RIGHT_FIPS,
          signal,
        });
      } catch (error) {
        secondError = error;
      }
    };
    const second = captureSecond();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(countyCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    await second;
    expect(secondError).toMatchObject({ status: 429 });
    expect(countyCalls).toBe(4);
  });

  it("keeps a county failure without Retry-After as a failed side", async () => {
    countyStatus = 400;
    retryAfter = null;
    vi.stubGlobal("fetch", async () => countyResponse());
    const records = await loadCompareCountyProfiles({
      leftFips: COMPARE_LEFT_FIPS,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      signal: new AbortController().signal,
    });
    expect(records.left.status).toBe("failed");
    expect(records.right.status).toBe("failed");
    expect(compareProfileCoolingDown(COMPARE_RELEASE_ID)).toBeFalsy();
  });

  it("rethrows a 503 that carries Retry-After", async () => {
    countyStatus = 503;
    retryAfter = "15";
    vi.stubGlobal("fetch", async () => countyResponse());
    const pending = loadCompareCountyProfiles({
      leftFips: COMPARE_LEFT_FIPS,
      releaseId: COMPARE_RELEASE_ID,
      rightFips: COMPARE_RIGHT_FIPS,
      signal: new AbortController().signal,
    });
    await expect(pending).rejects.toMatchObject({
      retryAfterSeconds: 15,
      status: 503,
    });
    expect(compareProfileCoolingDown(COMPARE_RELEASE_ID)).toBeTruthy();
  });
});
