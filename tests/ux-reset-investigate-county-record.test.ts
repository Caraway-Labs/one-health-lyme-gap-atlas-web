import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { AtlasApiError } from "@/lib/api-mutator";

const releaseId = "governed-2026-09-18-unknown-coverage";

function countyRecordRequest(fips: string) {
  return loadInvestigateCountyRecord({
    fips,
    releaseId,
    signal: new AbortController().signal,
  });
}

describe(loadInvestigateCountyRecord, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats a mutator 404 as an unpublished county record", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ detail: "County not found" }, { status: 404 })
      );

    const record = await countyRecordRequest("09001");
    const [url] = fetchMock.mock.calls[0] ?? [];

    expect({
      record,
      requestedCounty: String(url).includes("/v1/counties/09001"),
    }).toStrictEqual({
      record: null,
      requestedCounty: true,
    });
  });

  it("keeps a non-404 county record failure as a request error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ detail: "unavailable" }, { status: 503 })
    );

    const error = await countyRecordRequest("36027").then(
      () => null,
      (error: unknown) => error
    );

    expect({
      isApiError: error instanceof AtlasApiError,
      status: error instanceof AtlasApiError ? error.status : null,
    }).toStrictEqual({
      isApiError: true,
      status: 503,
    });
  });
});
