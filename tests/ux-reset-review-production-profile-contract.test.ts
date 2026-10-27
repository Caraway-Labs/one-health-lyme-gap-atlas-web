import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { GetCountyResponse } from "@/generated/zod/atlas";

import legacyCapture from "./fixtures/review-al-01001.json";
import autauga from "./fixtures/review-al-v11-01001.json";
import baldwin from "./fixtures/review-al-v11-01003.json";
import barbour from "./fixtures/review-al-v11-01005.json";

describe("Source-backed v1.1 regression projections through the existing loader", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a captured legacy response instead of relabeling it as v1.1", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(legacyCapture)
    );
    await expect(
      loadInvestigateCountyRecord({
        fips: legacyCapture.fips,
        releaseId: legacyCapture.release.release_id,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Atlas scoring versions do not match");
  });

  it.each([autauga, baldwin, barbour])(
    "accepts the exact county and release for $fips",
    async (detail) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(detail));
      const loaded = await loadInvestigateCountyRecord({
        fips: detail.fips,
        releaseId: detail.release.release_id,
        signal: new AbortController().signal,
      });
      expect(loaded).toStrictEqual(GetCountyResponse.parse(detail));
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
