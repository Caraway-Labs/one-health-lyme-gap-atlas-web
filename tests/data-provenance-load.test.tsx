import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataProvenanceView } from "@/features/ux-reset/data-provenance/data-provenance-page";
import { loadDataProvenanceCatalog } from "@/features/ux-reset/data-provenance/load-catalog";

type CollectionResponse = Promise<{ data: unknown; status: number }>;

const sourcesV1SourcesGet = vi.hoisted(() =>
  vi.fn<(query?: unknown, options?: unknown) => CollectionResponse>()
);
const measuresV1MeasuresGet = vi.hoisted(() =>
  vi.fn<(query?: unknown, options?: unknown) => CollectionResponse>()
);
const indicatorsV1IndicatorsGet = vi.hoisted(() =>
  vi.fn<(query?: unknown, options?: unknown) => CollectionResponse>()
);

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    indicatorsV1IndicatorsGet:
      indicatorsV1IndicatorsGet as unknown as typeof actual.indicatorsV1IndicatorsGet,
    measuresV1MeasuresGet:
      measuresV1MeasuresGet as unknown as typeof actual.measuresV1MeasuresGet,
    sourcesV1SourcesGet:
      sourcesV1SourcesGet as unknown as typeof actual.sourcesV1SourcesGet,
  };
});

const NO_MEASURE = "No governed measure in this release lists this source.";

function envelope(
  data: unknown[],
  nextPageToken: string | null = null,
  releaseId?: string
) {
  return {
    data: {
      data,
      links: { self: "/v1/example" },
      meta: {
        next_page_token: nextPageToken,
        ...(releaseId === undefined ? {} : { release_id: releaseId }),
      },
    },
    status: 200,
  };
}

function source(id: string, label: string) {
  return {
    dataset_id: `dataset-${id}`,
    label,
    lineage_source_id: `lineage-${id}`,
    publisher: "Centers for Disease Control and Prevention",
    release_version: "release-1",
    semantic_version: "semantic-1",
    source_id: id,
  };
}

function measure(id: string, sourceId: string) {
  return {
    definition: "Published county-linked Lyme case information.",
    indicator_id: "human_disease_burden",
    label: "Lyme cases",
    measure_id: id,
    semantic_version: "semantic-1",
    source_ids: [sourceId],
  };
}

function indicator() {
  return {
    definition: null,
    domain: "human",
    indicator_id: "human_disease_burden",
    label: "Human disease",
    measure_ids: ["lyme_cases"],
    semantic_version: "semantic-1",
  };
}

function failed(endpoint: string) {
  return { data: { detail: "unavailable" }, status: 503, endpoint };
}

async function loadCatalog() {
  return loadDataProvenanceCatalog(new AbortController().signal);
}

function showCatalog(
  catalog: Awaited<ReturnType<typeof loadDataProvenanceCatalog>>
) {
  render(<DataProvenanceView catalog={catalog} loadState="ready" />);
}

describe("data provenance metadata reads", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps loaded sources when measures fail", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([source("cdc-lyme", "CDC Lyme surveillance")])
    );
    measuresV1MeasuresGet.mockResolvedValue(failed("/v1/measures"));
    indicatorsV1IndicatorsGet.mockResolvedValue(envelope([]));

    const catalog = await loadCatalog();
    expect(catalog.measuresRead).toBe("unavailable");
    expect(catalog.sources.map((card) => card.sourceId)).toStrictEqual([
      "cdc-lyme",
    ]);

    showCatalog(catalog);
    fireEvent.click(screen.getByText("CDC Lyme surveillance"));
    expect(
      screen.getAllByText("Related measure metadata could not be loaded.")
        .length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(NO_MEASURE)).toBeNull();
  });

  it("keeps loaded measures when indicators fail", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([source("cdc-lyme", "CDC Lyme surveillance")])
    );
    measuresV1MeasuresGet.mockResolvedValue(
      envelope([measure("lyme_cases", "cdc-lyme")])
    );
    indicatorsV1IndicatorsGet.mockResolvedValue(failed("/v1/indicators"));

    const catalog = await loadCatalog();
    expect(catalog.indicatorsRead).toBe("unavailable");
    expect(catalog.measuresRead).toBe("complete");

    showCatalog(catalog);
    fireEvent.click(screen.getByText("CDC Lyme surveillance"));
    expect(screen.getByText("Lyme cases")).toBeTruthy();
    expect(
      screen.queryByText(/No governed indicator domain places them/)
    ).toBeNull();
    expect(
      screen.getAllByText(/Indicator metadata could not be loaded/).length
    ).toBeGreaterThan(0);
  });

  it("says a source has no measure only after an empty complete read", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([source("cdc-lyme", "CDC Lyme surveillance")])
    );
    measuresV1MeasuresGet.mockResolvedValue(envelope([]));
    indicatorsV1IndicatorsGet.mockResolvedValue(envelope([indicator()]));

    const catalog = await loadCatalog();
    expect(catalog.measuresRead).toBe("complete");
    expect(catalog.sources[0]?.measures).toStrictEqual([]);

    showCatalog(catalog);
    fireEvent.click(screen.getByText("CDC Lyme surveillance"));
    expect(screen.getByText(NO_MEASURE)).toBeTruthy();
    expect(
      screen.queryByText("Related measure metadata could not be loaded.")
    ).toBeNull();
    expect(
      screen.getByText(/No governed indicator domain places them/)
    ).toBeTruthy();
  });

  it("does not treat a page-capped measure read as no relationship", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([
        source("cdc-lyme", "CDC Lyme surveillance"),
        source("unlisted", "Source absent from the loaded pages"),
      ])
    );
    measuresV1MeasuresGet.mockImplementation(() => {
      const page = measuresV1MeasuresGet.mock.calls.length;
      return Promise.resolve(
        envelope(
          page === 1 ? [measure("lyme_cases", "cdc-lyme")] : [],
          `page-${page}`
        )
      );
    });
    indicatorsV1IndicatorsGet.mockResolvedValue(envelope([indicator()]));

    const catalog = await loadCatalog();
    expect(measuresV1MeasuresGet).toHaveBeenCalledTimes(20);
    expect(catalog.measuresRead).toBe("incomplete");
    expect(
      catalog.sources
        .find((card) => card.sourceId === "cdc-lyme")
        ?.measures.map((item) => item.measureId)
    ).toStrictEqual(["lyme_cases"]);

    showCatalog(catalog);
    fireEvent.click(screen.getByText("Source absent from the loaded pages"));
    expect(
      screen.getByText(/this source's measures may be missing/)
    ).toBeTruthy();
    expect(screen.queryByText(NO_MEASURE)).toBeNull();
  });

  it("does not join a measure from a different governed release", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([source("cdc-lyme", "CDC Lyme surveillance")], null, "release-a")
    );
    measuresV1MeasuresGet.mockResolvedValue(
      envelope([measure("lyme_cases", "cdc-lyme")], null, "release-b")
    );
    indicatorsV1IndicatorsGet.mockResolvedValue(
      envelope([indicator()], null, "release-a")
    );

    const catalog = await loadCatalog();
    expect(sourcesV1SourcesGet).toHaveBeenCalledTimes(2);
    expect(catalog.measuresRead).toBe("unavailable");
    expect(catalog.indicatorsRead).toBe("complete");
    expect(catalog.sources[0]?.measures).toStrictEqual([]);
    expect(catalog.sources.map((card) => card.sourceId)).toStrictEqual([
      "cdc-lyme",
    ]);
  });

  it("reports a repeated continuation token as an incomplete read", async () => {
    sourcesV1SourcesGet.mockResolvedValue(
      envelope([
        source("cdc-lyme", "CDC Lyme surveillance"),
        source("unlisted", "Source absent from the loaded pages"),
      ])
    );
    measuresV1MeasuresGet.mockImplementation(() => {
      const page = measuresV1MeasuresGet.mock.calls.length;
      return Promise.resolve(
        envelope(page === 1 ? [measure("lyme_cases", "cdc-lyme")] : [], "again")
      );
    });
    indicatorsV1IndicatorsGet.mockResolvedValue(envelope([indicator()]));

    const catalog = await loadCatalog();
    expect(measuresV1MeasuresGet).toHaveBeenCalledTimes(2);
    expect(catalog.measuresRead).toBe("incomplete");
    expect(
      catalog.sources
        .find((card) => card.sourceId === "cdc-lyme")
        ?.measures.map((item) => item.measureId)
    ).toStrictEqual(["lyme_cases"]);

    showCatalog(catalog);
    fireEvent.click(screen.getByText("Source absent from the loaded pages"));
    expect(
      screen.getByText(/this source's measures may be missing/)
    ).toBeTruthy();
    expect(screen.queryByText(NO_MEASURE)).toBeNull();
  });
});
