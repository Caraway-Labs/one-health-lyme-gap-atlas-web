import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import { ExplorerMapContractError } from "@/features/ux-reset/review/explorer-map-observation";
import { loadExplorerMapObservations } from "@/features/ux-reset/review/load-explorer-map-observations";
import {
  observationGate,
  observationPaintState,
  useExplorerMapObservations,
} from "@/features/ux-reset/review/use-explorer-map-observations";

vi.mock(
  import("@/features/ux-reset/review/load-explorer-map-observations"),
  () => ({
    loadExplorerMapObservations:
      vi.fn<
        typeof import("@/features/ux-reset/review/load-explorer-map-observations").loadExplorerMapObservations
      >(),
  })
);

const loadObservations = vi.mocked(loadExplorerMapObservations);

function readyPayload(unit: string) {
  return {
    omitted: 0,
    period: "2023",
    rows: [],
    sourceLabel: "Published source",
    unit,
  };
}

function renderLoader(initialLayer: ExplorerMapLayerId) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    (activeLayerId: ExplorerMapLayerId) =>
      useExplorerMapObservations({
        activeLayerId,
        fips: ["08001", "06037", "02013"],
        geometryStatus: "ready",
        releaseId: "release-1",
        scopeCode: "CO",
      }),
    { initialProps: initialLayer, wrapper }
  );
}

describe("explorer observation loading", () => {
  beforeEach(() => {
    loadObservations.mockReset();
    loadObservations.mockImplementation(async ({ spec }) =>
      readyPayload(spec.unit)
    );
  });

  it("does not request observations for the default gap-score layer", async () => {
    const view = renderLoader("gap_score");
    await waitFor(() => {
      expect(view.result.current.svi.status).toBe("unloaded");
    });
    expect(loadObservations).not.toHaveBeenCalled();
    expect(
      observationGate(view.result.current.incidence_floor).selectable
    ).toBeTruthy();
  });

  it("loads only the selected layer and keeps that result when the layer changes", async () => {
    const view = renderLoader("svi");
    await waitFor(() => {
      expect(view.result.current.svi.status).toBe("ready");
    });
    view.rerender("incidence_floor");
    await waitFor(() => {
      expect(view.result.current.incidence_floor.status).toBe("ready");
    });
    view.rerender("gap_score");
    expect({
      calls: loadObservations.mock.calls.map((call) => ({
        fips: call[0].fips,
        id: call[0].spec.id,
      })),
      svi: view.result.current.svi.status,
      uninsured: view.result.current.uninsured.status,
    }).toStrictEqual({
      calls: [
        { fips: ["08001"], id: "svi" },
        { fips: ["08001"], id: "incidence_floor" },
      ],
      svi: "ready",
      uninsured: "unloaded",
    });
  });

  it("does not request observations while shapes are missing", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const view = renderHook(
      (geometryStatus: "error" | "loading" | "ready") =>
        useExplorerMapObservations({
          activeLayerId: "svi",
          fips: geometryStatus === "ready" ? [] : ["08001"],
          geometryStatus,
          releaseId: geometryStatus === "loading" ? null : "release-1",
          scopeCode: "CO",
        }),
      { initialProps: "loading" as "error" | "loading" | "ready", wrapper }
    );
    const loading = observationGate(view.result.current.svi);
    view.rerender("error");
    const failedShapes = observationGate(view.result.current.svi);
    view.rerender("ready");
    expect({
      called: loadObservations.mock.calls.length,
      empty: view.result.current.svi,
      failedShapes,
      loading,
      paint: observationPaintState(view.result.current.svi).status,
    }).toStrictEqual({
      called: 0,
      empty: {
        reason: "No lower-48 county shapes were available to check this layer.",
        status: "error",
      },
      failedShapes: {
        reason:
          "County shapes could not be loaded, so this layer cannot be checked against the release.",
        selectable: false,
      },
      loading: {
        reason:
          "County shapes are still loading, so this layer cannot be checked against the release.",
        selectable: false,
      },
      paint: "error",
    });
  });

  it("disables a layer when its observation request fails", async () => {
    loadObservations.mockRejectedValue(
      new ExplorerMapContractError(
        "The observation collection returned no rows for the requested counties."
      )
    );
    const view = renderLoader("svi");
    await waitFor(() => {
      expect(view.result.current.svi.status).toBe("error");
    });
    expect({
      gate: observationGate(view.result.current.svi),
      paint: observationPaintState(view.result.current.svi),
      uninsured: view.result.current.uninsured.status,
    }).toStrictEqual({
      gate: {
        reason:
          "The observation collection returned no rows for the requested counties.",
        selectable: false,
      },
      paint: {
        reason:
          "The observation collection returned no rows for the requested counties.",
        status: "error",
      },
      uninsured: "unloaded",
    });
  });
});
