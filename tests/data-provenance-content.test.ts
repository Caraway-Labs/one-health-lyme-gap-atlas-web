import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  dataProvenanceContent,
  dataProvenanceFilterCount,
  dataProvenanceReleaseDatasetIds,
  type DataProvenanceDataset,
} from "@/lib/data-provenance-content";
import { pageMetadataForRoute } from "@/lib/navigation";

const BANNED = [
  "Not provided",
  "Planned",
  "governed-",
  "semantic",
  "lineage",
  "TODO",
] as const;

const LEGACY_ANCHORS = [
  "human",
  "tick",
  "pathogen",
  "context_svi",
  "context_rucc",
  "context_nlcd_2025",
] as const;

const BULLETIN_ANCHORS = [
  "cdc-mmwr",
  "cdc-eid-ahead-of-print",
  "cdc-eid-expedited",
  "cdc-outbreaks",
  "cdc-newsroom",
  "cdc-vital-signs",
  "nih-news-releases",
  "niaid-news",
  "who-newsroom",
  "who-disease-outbreaks",
] as const;

const REQUIRED_FIELDS = [
  "anchorId",
  "cadence",
  "coverage",
  "edition",
  "evidenceType",
  "id",
  "ingest",
  "keepInMind",
  "name",
  "publisher",
  "sourceLabel",
  "sourceUrl",
  "uses",
] as const satisfies readonly (keyof DataProvenanceDataset)[];

type RecordedSource = {
  dataset_id: string;
  source_id: string;
};

describe("data provenance content", () => {
  it("publishes the approved metadata and version", () => {
    expect(dataProvenanceContent.version).toBe("1.0.0");
    expect(dataProvenanceContent.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataProvenanceContent.hero.title).toBe(
      "Where Atlas evidence comes from"
    );
    expect(pageMetadataForRoute("/data-provenance")).toStrictEqual({
      description:
        "The public datasets behind One Health Atlas, who publishes them, how Atlas validates and releases them, and how to read the evidence responsibly.",
      title: "Data Provenance | One Health Lyme Gap Atlas",
    });
  });

  it("lists twenty sources, including ten public-health bulletins", () => {
    const bulletins = dataProvenanceContent.datasets.filter(
      (item) => item.evidenceType === "bulletin"
    );
    expect(dataProvenanceContent.datasets).toHaveLength(20);
    expect(bulletins).toHaveLength(10);
    expect(bulletins.map((item) => item.id)).toStrictEqual([
      ...BULLETIN_ANCHORS,
    ]);
  });

  it("keeps every public field filled and every source link on https", () => {
    for (const item of dataProvenanceContent.datasets) {
      for (const field of REQUIRED_FIELDS) {
        expect(item[field].trim().length).toBeGreaterThan(0);
      }
      expect(item.sourceUrl.startsWith("https://")).toBeTruthy();
      expect(item.anchorId).toBe(`source-${item.id}`);
    }
  });

  it("keeps unique anchors, including the legacy cards and NOAA", () => {
    const ids = dataProvenanceContent.datasets.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const anchor of [
      ...LEGACY_ANCHORS,
      "noaa_nclimgrid_daily_202501",
      ...BULLETIN_ANCHORS,
    ]) {
      expect(ids).toContain(anchor);
    }
  });

  it("derives filter counts from the catalog", () => {
    const counts = dataProvenanceContent.filters.map((filter) =>
      dataProvenanceFilterCount(filter.id)
    );
    expect(counts).toStrictEqual([20, 1, 2, 2, 2, 1, 2, 10]);
    expect(counts.slice(1).reduce((total, count) => total + count, 0)).toBe(
      dataProvenanceContent.datasets.length
    );
  });

  it("does not publish internal identifiers or status labels", () => {
    const copy = JSON.stringify(dataProvenanceContent);
    expect({
      banned: BANNED.filter((phrase) => copy.includes(phrase)),
      issueNumbers: copy.match(/#\d{2,}/g),
    }).toStrictEqual({
      banned: [],
      issueNumbers: null,
    });
  });

  it("maps every recorded /v1/sources dataset id onto a catalog source", () => {
    const fixture = JSON.parse(
      readFileSync("tests/fixtures/v1-sources.json", "utf-8")
    ) as { data: RecordedSource[] };
    const catalogIds = new Set(
      dataProvenanceContent.datasets.map((item) => item.id)
    );
    expect(fixture.data.length).toBeGreaterThan(0);
    for (const source of fixture.data) {
      expect(dataProvenanceReleaseDatasetIds[source.dataset_id]).toBe(
        source.source_id
      );
      expect(catalogIds.has(source.source_id)).toBeTruthy();
    }
  });
});
