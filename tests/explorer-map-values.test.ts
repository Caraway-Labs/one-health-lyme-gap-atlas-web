import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LYME_INCIDENCE_MISSING_COLOR,
  LYME_INCIDENCE_RAMP,
  mixExplorerRampColor,
  SVI_RAMP,
  SVI_NO_DATA_COLOR,
  UNINSURED_POPULATION_MISSING_COLOR,
  UNINSURED_POPULATION_RAMP,
} from "@/features/ux-reset/review/explorer-layer-palettes";
import { paintReadyObservationLayer } from "@/features/ux-reset/review/explorer-map-layer-scale";
import { explorerMapValuesLayerReady } from "@/features/ux-reset/review/load-explorer-map-values";
import type { MapValuesCollection } from "@/features/ux-reset/review/map-values-schema";
import {
  RURALITY_NO_DATA_COLOR,
  ruralityFillForCode,
} from "@/features/ux-reset/review/rurality-palette";
import type { ExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import { useExplorerMapObservations } from "@/features/ux-reset/review/use-explorer-map-observations";
import { mapValuesV1AtlasMapValuesGet } from "@/features/ux-reset/review/map-values-atlas";
import { ValueState } from "@/generated/models";

vi.mock(import("@/features/ux-reset/review/map-values-atlas"), () => ({
  getMapValuesV1AtlasMapValuesGetUrl: vi.fn(),
  mapValuesV1AtlasMapValuesGet: vi.fn(),
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
    expect(ready.rows.find((row) => row.fips === "06037")).toMatchObject({
      numeric: null,
      valueState: ValueState.MISSING,
    });
    expect(ready.rows.find((row) => row.fips === "01001")).toMatchObject({
      numeric: 0,
      valueState: ValueState.ZERO,
    });
    const svi = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "svi",
      requestedFips: ["01001", "08001"],
    });
    expect(svi.rows.find((row) => row.fips === "08001")).toMatchObject({
      numeric: 0,
      valueState: ValueState.ZERO,
    });
    expect(svi.rows.find((row) => row.fips === "01001")).toMatchObject({
      numeric: null,
      valueState: ValueState.MISSING,
    });
  });

  it("excludes Alaska from painted rows and filters by state scope", () => {
    const national = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["08001", "02013", "06037"],
    });
    expect(national.rows.some((row) => row.fips === "02013")).toBe(false);
    const colorado = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "incidence_floor",
      requestedFips: ["08001", "06037"],
      scopeCode: "CO",
    });
    expect(colorado.rows.map((row) => row.fips)).toStrictEqual(["08001"]);
  });

  it("paints through paintReadyObservationLayer with ramp and rurality fills", () => {
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
    expect(paint.colorsByFips.get("06037")).toBe(LYME_INCIDENCE_MISSING_COLOR);
    expect(paint.selectionEvidence).toBeNull();

    const svi = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "svi",
      requestedFips: ["08001", "06037"],
    });
    const sviPaint = paintReadyObservationLayer({
      layerId: "svi",
      omitted: svi.omitted,
      period: svi.period,
      rows: svi.rows,
      sourceLabel: svi.sourceLabel,
      unit: svi.unit,
    });
    expect(sviPaint.colorsByFips.get("08001")).toBe(
      mixExplorerRampColor(SVI_RAMP, 0)
    );
    expect(sviPaint.colorsByFips.get("06037")).not.toBe(SVI_NO_DATA_COLOR);

    const uninsured = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "uninsured",
      requestedFips: ["08001", "06037", "01001"],
    });
    const uninsuredPaint = paintReadyObservationLayer({
      layerId: "uninsured",
      omitted: uninsured.omitted,
      period: uninsured.period,
      rows: uninsured.rows,
      sourceLabel: uninsured.sourceLabel,
      unit: uninsured.unit,
    });
    expect(uninsuredPaint.colorsByFips.get("08001")).toBe(
      mixExplorerRampColor(UNINSURED_POPULATION_RAMP, 0)
    );
    expect(uninsuredPaint.colorsByFips.get("01001")).toBe(
      UNINSURED_POPULATION_MISSING_COLOR
    );

    const rurality = explorerMapValuesLayerReady({
      collection: sampleCollection(),
      layerId: "rurality",
      requestedFips: ["08001", "06037", "01001"],
    });
    const ruralityPaint = paintReadyObservationLayer({
      layerId: "rurality",
      omitted: rurality.omitted,
      period: rurality.period,
      rows: rurality.rows,
      sourceLabel: rurality.sourceLabel,
      unit: rurality.unit,
    });
    expect(ruralityPaint.colorsByFips.get("08001")).toBe(
      ruralityFillForCode(1)
    );
    expect(ruralityPaint.colorsByFips.get("06037")).toBe(
      ruralityFillForCode(9)
    );
    expect(ruralityPaint.colorsByFips.get("01001")).toBe(RURALITY_NO_DATA_COLOR);
    expect(
      mixExplorerRampColor(LYME_INCIDENCE_RAMP, 1)
    ).toBeTruthy();
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
      { initialProps: "incidence_floor" as const, wrapper }
    );
    await waitFor(() => {
      expect(view.result.current.incidence_floor.status).toBe("ready");
    });
    view.rerender("svi");
    await waitFor(() => {
      expect(view.result.current.svi.status).toBe("ready");
    });
    view.rerender("gap_score");
    expect(view.result.current.svi.status).toBe("ready");
    expect(mapValuesGet).toHaveBeenCalledTimes(1);
  });
});
