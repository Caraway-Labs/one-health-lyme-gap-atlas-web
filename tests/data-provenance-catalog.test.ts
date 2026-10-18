import { describe, expect, it } from "vitest";

import {
  buildDataProvenanceCatalog,
  dataProvenanceHref,
  dataProvenanceSourceAnchor,
  PROVENANCE_FAMILY_IDS,
  sourceIdFromProvenanceHash,
} from "@/features/ux-reset/data-provenance/catalog";
import { PROVENANCE_PIPELINE } from "@/features/ux-reset/data-provenance/content";
import {
  INVESTIGATE_DOMAIN_ENVIRONMENTAL,
  INVESTIGATE_DOMAIN_HUMAN,
  INVESTIGATE_DOMAIN_PATHOGEN,
  INVESTIGATE_DOMAIN_POPULATION,
  INVESTIGATE_DOMAIN_VECTOR,
} from "@/features/ux-reset/investigate/county-evidence";
import type { Indicator, Measure, Source } from "@/generated/models";

function source(
  id: string,
  label: string,
  extra: Partial<Source> = {}
): Source {
  return {
    dataset_id: `dataset-${id}`,
    label,
    lineage_source_id: `lineage-${id}`,
    publisher: `${label} publisher`,
    release_version: "release-1",
    semantic_version: "semantic-1",
    source_id: id,
    ...extra,
  };
}

function measure(
  id: string,
  indicatorId: string,
  sourceIds: string[]
): Measure {
  return {
    definition: `${id} definition`,
    indicator_id: indicatorId,
    label: id,
    measure_id: id,
    semantic_version: "semantic-1",
    source_ids: sourceIds,
  };
}

function indicator(id: string, domain: string | null): Indicator {
  return {
    definition: null,
    domain,
    indicator_id: id,
    label: id,
    measure_ids: [],
    semantic_version: "semantic-1",
  };
}

describe("data provenance catalog", () => {
  it("keeps the conceptual pipeline in the approved order", () => {
    expect(PROVENANCE_PIPELINE.map((stage) => stage.label)).toStrictEqual([
      "Source",
      "Validate",
      "Transform",
      "Release",
      "Explore",
    ]);
    expect(PROVENANCE_FAMILY_IDS).toStrictEqual([
      "human-surveillance",
      "ticks-and-pathogens",
      "environment",
      "population-context",
    ]);
  });

  it("groups sources only from governed indicator domains", () => {
    const catalog = buildDataProvenanceCatalog({
      indicators: [
        indicator("human_disease_burden", INVESTIGATE_DOMAIN_HUMAN),
        indicator("tick_surveillance", INVESTIGATE_DOMAIN_VECTOR),
        indicator("pathogen_surveillance", INVESTIGATE_DOMAIN_PATHOGEN),
        indicator("climate", INVESTIGATE_DOMAIN_ENVIRONMENTAL),
        indicator("population_context", INVESTIGATE_DOMAIN_POPULATION),
        indicator("blank_domain", null),
        indicator("custom_domain", "literature"),
      ],
      measures: [
        measure("lyme_cases", "human_disease_burden", ["cdc-lyme"]),
        measure("tick_status", "tick_surveillance", ["cdc-ticks"]),
        measure("pathogen_status", "pathogen_surveillance", ["cdc-ticks"]),
        measure("precip", "climate", ["noaa-grid"]),
        measure("svi", "population_context", ["cdc-svi"]),
        measure("unclassified", "blank_domain", ["no-domain"]),
        measure("papers", "custom_domain", ["pubmed-feed"]),
      ],
      sources: [
        source("cdc-lyme", "CDC Lyme surveillance", {
          source_url: "https://example.com/cdc",
          source_vintage: "2023",
        }),
        source("cdc-ticks", "Tick and pathogen records"),
        source("noaa-grid", "Gridded weather"),
        source("cdc-svi", "Social vulnerability"),
        source("no-domain", "Source without a domain"),
        source("pubmed-feed", "Literature feed"),
        source("orphan", "Source with no measure", {
          source_url: "ftp://example.com/not-http",
        }),
      ],
      indicatorsRead: "complete",
      measuresRead: "complete",
      sourcesIncomplete: false,
    });

    expect(
      catalog.families.map((family) => ({
        cards: family.entries
          .filter((entry) => entry.kind === "card")
          .map((entry) => entry.card.sourceId),
        id: family.id,
        links: family.entries
          .filter((entry) => entry.kind === "cross-link")
          .map((entry) => entry.card.sourceId),
      }))
    ).toStrictEqual([
      {
        cards: ["cdc-lyme"],
        id: "human-surveillance",
        links: [],
      },
      {
        cards: ["cdc-ticks"],
        id: "ticks-and-pathogens",
        links: [],
      },
      {
        cards: ["noaa-grid"],
        id: "environment",
        links: [],
      },
      {
        cards: ["cdc-svi"],
        id: "population-context",
        links: [],
      },
    ]);
    expect(catalog.other.map((card) => card.sourceId)).toStrictEqual([
      "pubmed-feed",
      "orphan",
      "no-domain",
    ]);
    expect(
      catalog.sources.find((card) => card.sourceId === "orphan")?.sourceUrl
    ).toBeNull();
    expect(
      catalog.sources.find((card) => card.sourceId === "pubmed-feed")
        ?.primaryFamilyId
    ).toBeNull();
    expect(
      catalog.sources.find((card) => card.sourceId === "pubmed-feed")
        ?.unclassifiedDomains
    ).toStrictEqual(["literature"]);
  });

  it("does not invent a family when domain metadata is unavailable", () => {
    const catalog = buildDataProvenanceCatalog({
      indicators: [],
      indicatorsRead: "unavailable",
      measures: [],
      measuresRead: "unavailable",
      sources: [source("cdc-lyme", "CDC Lyme surveillance")],
      sourcesIncomplete: false,
    });
    expect(catalog.families).toStrictEqual([]);
    expect(catalog.sources.map((card) => card.sourceId)).toStrictEqual([
      "cdc-lyme",
    ]);
    expect(catalog.measuresRead).toBe("unavailable");
    expect(catalog.indicatorsRead).toBe("unavailable");
  });

  it("uses a stable source anchor and leaves unknown ids off the page hash", () => {
    expect(dataProvenanceSourceAnchor("cdc lyme")).toBe("source-cdc%20lyme");
    expect(sourceIdFromProvenanceHash("#source-cdc%20lyme")).toBe("cdc lyme");
    expect(sourceIdFromProvenanceHash("#methods")).toBeNull();
    expect(dataProvenanceHref("cdc-lyme")).toBe(
      "/data-provenance#source-cdc-lyme"
    );
  });

  it("links a blank source id to the provenance page without a hash", () => {
    expect(dataProvenanceHref("  ")).toBe("/data-provenance");
    expect(dataProvenanceHref(null)).toBe("/data-provenance");
  });
});
