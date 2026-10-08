import { describe, expect, it } from "vitest";

import type { AtlasMetadata } from "@/generated/models";
import {
  describeMethodologyVersion,
  describeReleaseAssembly,
  formatAtlasTimestamp,
  formatEvidenceSnapshotSummary,
  parseAtlasDateTime,
  parseConfigurationSha256,
  summarizeSourceVintages,
} from "@/lib/atlas-evidence-metadata";

const baseMetadata: AtlasMetadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-08-15T00:00:00Z",
  methodology_version: "semantic-1.0.0",
  release_id: "governed-2026-09-18-unknown-coverage",
  schema_version: "0.2.0",
  scope: "Contiguous U.S. counties included in this release",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      note: "Published floor.",
      url: "https://cdc.gov",
      vintage: "2023",
    },
    {
      key: "tick",
      label: "Tick surveillance",
      note: "Sample.",
      url: "https://example.com",
      vintage: "2022–25",
    },
  ],
  states: [],
};

describe("atlas evidence metadata", () => {
  it("describes releases without leading with raw IDs", () => {
    expect(
      describeReleaseAssembly("governed-2026-09-18-unknown-coverage")
    ).toBe("Governed county release assembled September 18, 2026");
    expect(describeReleaseAssembly("alpha-2026-08-06")).toContain(
      "August 6, 2026"
    );
    expect(describeReleaseAssembly("custom-release-id")).toBe(
      "Governed county release"
    );
  });

  it("maps methodology versions to user-facing labels", () => {
    expect(describeMethodologyVersion("semantic-1.0.0")).toBe(
      "Semantic scoring methodology"
    );
    expect(describeMethodologyVersion("alpha-0.2.0")).toBe(
      "Deterministic scoring methodology"
    );
    expect(describeMethodologyVersion("")).toBe("Unavailable");
  });

  it("summarizes source periods without inventing dates", () => {
    expect(summarizeSourceVintages(baseMetadata.sources)).toBe("2022–25");
    expect(summarizeSourceVintages([])).toBe("Unavailable");
  });

  it("marks missing timestamps unavailable", () => {
    expect(formatAtlasTimestamp("")).toBe("Unavailable");
    expect(formatAtlasTimestamp("not-a-date")).toBe("Unavailable");
    expect(formatAtlasTimestamp("2026-08-06T05:37:16Z")).toContain("2026");
  });

  it("accepts offset date-times and rejects other strings", () => {
    expect({
      blank: parseAtlasDateTime(""),
      dateOnly: parseAtlasDateTime("2026-10-06"),
      impossible: parseAtlasDateTime("2026-02-31T00:00:00Z"),
      offset: parseAtlasDateTime(" 2026-10-06T04:57:46+00:00 "),
      text: parseAtlasDateTime("not-a-timestamp"),
      utc: parseAtlasDateTime("2026-10-06T04:57:46.000Z"),
    }).toStrictEqual({
      blank: null,
      dateOnly: null,
      impossible: null,
      offset: "2026-10-06T04:57:46+00:00",
      text: null,
      utc: "2026-10-06T04:57:46.000Z",
    });
  });

  it("accepts a 64-hex configuration id", () => {
    const digest = "a".repeat(64);
    expect({
      blank: parseConfigurationSha256(""),
      digest: parseConfigurationSha256(digest),
      text: parseConfigurationSha256("not-a-hash"),
    }).toStrictEqual({
      blank: null,
      digest,
      text: null,
    });
  });

  it("builds a summary without raw release or method IDs", () => {
    const summary = formatEvidenceSnapshotSummary(baseMetadata);
    expect(summary).toContain(
      "Governed county release assembled September 18, 2026"
    );
    expect(summary).toContain("Semantic scoring methodology");
    expect(summary).not.toContain("governed-2026-09-18-unknown-coverage");
    expect(summary).not.toContain("semantic-1.0.0");
  });
});
