import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LYME_INCIDENCE_MISSING_COLOR,
  mixExplorerRampColor,
  SVI_RAMP,
  UNINSURED_POPULATION_MISSING_COLOR,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { paintReadyObservationLayer } from "@/features/ux-reset/review/explorer-map-layer-scale";
import type { ExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import { explorerMapValuesLayerReady } from "@/features/ux-reset/review/load-explorer-map-values";
import { mapValuesV1AtlasMapValuesGet } from "@/features/ux-reset/review/map-values-atlas";
import type { MapValuesCollection } from "@/features/ux-reset/review/map-values-schema";
import {
  RURALITY_NO_DATA_COLOR,
  ruralityFillForCode,
} from "@/features/ux-reset/review/rurality-palette";
import { useExplorerMapObservations } from "@/features/ux-reset/review/use-explorer-map-observations";
import { ValueState } from "@/generated/models";

vi.mock(import("@/features/ux-reset/review/map-values-atlas"), () => ({
  getMapValuesV1AtlasMapValuesGetUrl:
    vi.fn<
      typeof import("@/features/ux-reset/review/map-values-atlas").getMapValuesV1AtlasMapValuesGetUrl
    >(),
  mapValuesV1AtlasMapValuesGet:
    vi.fn<
      typeof import("@/features/ux-reset/review/map-values-atlas").mapValuesV1AtlasMapValuesGet
    >(),
}));

const mapValuesGet = vi.mocked(mapValuesV1AtlasMapValuesGet);

function sampleCollection(): MapValuesCollection {
  return {
    release_id: "release-1",
    counties: [
      {
        fips: "08001",
        incidence_floor_2023: 12.5,
        svi_percentile: 0,
        uninsured_percent: 0,
        rucc_2023: 1,
      },
      {
        fips: "06037",
        incidence_floor_2023: null,
        svi_percentile: 0.5,
        uninsured_percent: 18.2,
        rucc_2023: 9,
      },
      {
        fips: "01001",
        incidence_floor_2023: 0,
        svi_percentile: null,
        uninsured_percent: null,
        rucc_2023: null,
      },
      {
        fips: "02013",
        incidence_floor_2023: 1,
        svi_percentile: 0.1,
        uninsured_percent: 5,
        rucc_2023: 3,
      },
    ],
  };
}

describe("explorer map values adapter", () => {
  beforeEach(() => {
    mapValuesGet.mockReset();
    mapValuesGet.mockResolvedValue({
      data: sampleCollection(),
      headers: new Headers(),
      status: 200,
    });
  });

  it("maps null as missing and numeric zero as zero", () => {
    const ready = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["01001", "06037", "08001"],
    });
    expect({
      missing: ready.rows.find((row) => row.fips === "06037"),
      zero: ready.rows.find((row) => row.fips === "01001"),
      sviZero: explorerMapValuesLayerReady({
        collection: sampleCollection(),
        layerId: "svi",
        requestedFips: ["01001", "08001"],
      }).rows.find((row) => row.fips === "08001"),
      sviMissing: explorerMapValuesLayerReady({
        collection: sampleCollection(),
        layerId: "svi",
        requestedFips: ["01001", "08001"],
      }).rows.find((row) => row.fips === "01001"),
    }).toStrictEqual({
      missing: {
        categoryLabel: null,
        fips: "06037",
        numeric: null,
        raw: null,
        valueState: ValueState.MISSING,
      },
      zero: {
        categoryLabel: null,
        fips: "01001",
        numeric: 0,
        raw: "0",
        valueState: ValueState.ZERO,
      },
      sviZero: {
        categoryLabel: null,
        fips: "08001",
        numeric: 0,
        raw: "0",
        valueState: ValueState.ZERO,
      },
      sviMissing: {
        categoryLabel: null,
        fips: "01001",
        numeric: null,
        raw: null,
        valueState: ValueState.MISSING,
      },
    });
  });

  it("excludes Alaska from painted rows and filters by state scope", () => {
    const national = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["08001", "02013", "06037"],
    });
    const colorado = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["08001", "06037"],
      scopeCode: "CO",
    });
    expect({
      includesAlaska: national.rows.some((row) => row.fips === "02013"),
      coloradoFips: colorado.rows.map((row) => row.fips),
    }).toStrictEqual({
      includesAlaska: false,
      coloradoFips: ["08001"],
    });
  });

  it("paints incidence missing counties gray without legend evidence", () => {
    const incidence = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["08001", "06037", "01001"],
    });
    const paint = paintReadyObservationLayer({
      layerId: "incidence_floor",
      omitted: incidence.omitted,
      period: incidence.period,
      releaseId: "release-1",
      rows: incidence.rows,
      sourceLabel: incidence.sourceLabel,
      unit: incidence.unit,
    });
    expect({
      missingColor: paint.colorsByFips.get("06037"),
      selectionEvidence: paint.selectionEvidence,
    }).toStrictEqual({
      missingColor: LYME_INCIDENCE_MISSING_COLOR,
      selectionEvidence: null,
    });
  });

  it("paints svi, uninsured, and rurality through existing ramps", () => {
    const sviPaint = paintReadyObservationLayer({
      layerId: "svi",
      omitted: 0,
      period: "ACS",
      rows: explorerMapValuesLayerReady({
        collection: sampleCollection(),
        layerId: "svi",
        requestedFips: ["08001", "06037"],
      }).rows,
      sourceLabel: null,
      unit: "percentile",
    });
    const uninsuredPaint = paintReadyObservationLayer({
      layerId: "uninsured",
      omitted: 0,
      period: "ACS",
      rows: explorerMapValuesLayerReady({
        collection: sampleCollection(),
        layerId: "uninsured",
        requestedFips: ["08001", "01001"],
      }).rows,
      sourceLabel: null,
      unit: "percent",
    });
    const ruralityPaint = paintReadyObservationLayer({
      layerId: "rurality",
      omitted: 0,
      period: "Vintage 2023",
      rows: explorerMapValuesLayerReady({
        collection: sampleCollection(),
        layerId: "rurality",
        requestedFips: ["08001", "06037", "01001"],
      }).rows,
      sourceLabel: null,
      unit: "code",
    });
    expect({
      sviZero: sviPaint.colorsByFips.get("08001"),
      uninsuredZero: uninsuredPaint.colorsByFips.get("08001"),
      uninsuredMissing: uninsuredPaint.colorsByFips.get("01001"),
      ruralityOne: ruralityPaint.colorsByFips.get("08001"),
      ruralityNine: ruralityPaint.colorsByFips.get("06037"),
      ruralityMissing: ruralityPaint.colorsByFips.get("01001"),
    }).toStrictEqual({
      sviZero: mixExplorerRampColor(SVI_RAMP, 0),
      uninsuredZero: mixExplorerRampColor(UNINSURED_POPULATION_RAMP, 0),
      uninsuredMissing: UNINSURED_POPULATION_MISSING_COLOR,
      ruralityOne: ruralityFillForCode(1),
      ruralityNine: ruralityFillForCode(9),
      ruralityMissing: RURALITY_NO_DATA_COLOR,
    });
  });

  it("loads map values once when switching among data layers", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const view = renderHook(
      (activeLayerId: ExplorerMapLayerId) =>
        useExplorerMapObservations({
          activeLayerId,
          fips: ["08001", "06037"],
          geometryStatus: "ready",
          releaseId: "release-1",
        }),
      { initialProps: "incidence_floor" as ExplorerMapLayerId, wrapper }
    );
    await waitFor(() => {
      expect(view.result.current.incidence_floor.status).toBe("ready");
    });
    view.rerender("svi");
    await waitFor(() => {
      expect(view.result.current.svi.status).toBe("ready");
    });
    view.rerender("gap_score");
    expect({
      calls: mapValuesGet.mock.calls.length,
      svi: view.result.current.svi.status,
    }).toStrictEqual({
      calls: 1,
      svi: "ready",
    });
  });
});
