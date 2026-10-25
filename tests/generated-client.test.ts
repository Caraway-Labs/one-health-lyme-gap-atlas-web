import { describe, expect, it } from "vitest";

import {
  getGetAtlasMetadataUrl,
  getGetAtlasScoresUrl,
} from "../src/generated/atlas";

describe("generated API client", () => {
  it("preserves dataset and scoring parameters", () => {
    expect(
      getGetAtlasScoresUrl({
        dataset_version: "alpha-2026-08-06",
        ecological_share: 65,
        smooth_k: 50,
        missing_human_weakness: 75,
      })
    ).toContain("dataset_version=alpha-2026-08-06");
  });

  it("uses the versioned metadata route", () => {
    expect(getGetAtlasMetadataUrl()).toBe("/v1/atlas/metadata");
  });
});
