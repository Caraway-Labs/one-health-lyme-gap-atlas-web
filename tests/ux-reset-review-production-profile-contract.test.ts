import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { CountyV1CountiesFipsGetResponse } from "@/generated/zod/atlas";

import autauga from "./fixtures/review-al-01001.json";
import baldwin from "./fixtures/review-al-01003.json";
import barbour from "./fixtures/review-al-01005.json";

describe("Captured production county responses through the existing loader", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([autauga, baldwin, barbour])(
    "accepts the exact county and release for $fips",
    async (detail) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(detail));
      const loaded = await loadInvestigateCountyRecord({
        fips: detail.fips,
        releaseId: detail.release.release_id,
        signal: new AbortController().signal,
      });
      expect(loaded).toStrictEqual(
        CountyV1CountiesFipsGetResponse.parse(detail)
      );
    }
  );

  it("rejects a county identity mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(baldwin));
    await expect(
      loadInvestigateCountyRecord({
        fips: "01001",
        releaseId: baldwin.release.release_id,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("County record does not match");
  });

  it("rejects a release mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(baldwin));
    await expect(
      loadInvestigateCountyRecord({
        fips: "01003",
        releaseId: "different-release",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("County record release does not match");
  });
});
