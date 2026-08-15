import { describe, expect, it } from "vitest";
import {
  getMetadataV1AtlasMetadataGetUrl,
  getScoresV1AtlasScoresGetUrl,
} from "../src/generated/atlas";

describe("generated API client", () => {
  it("preserves dataset and scoring parameters", () => {
    expect(
      getScoresV1AtlasScoresGetUrl({
        dataset_version: "alpha-2026-08-06",
        ecological_share: 65,
        low_incidence_breakpoint: 10,
        missing_human_weakness: 75,
      }),
    ).toContain("dataset_version=alpha-2026-08-06");
  });

  it("uses the versioned metadata route", () => {
    expect(getMetadataV1AtlasMetadataGetUrl()).toBe("/v1/atlas/metadata");
  });
});

