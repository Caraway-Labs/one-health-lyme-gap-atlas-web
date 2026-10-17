import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExplorerMapLayerId } from "@/features/ux-reset/review/explorer-map-layers";
import { loadExplorerMapObservations } from "@/features/ux-reset/review/load-explorer-map-observations";
import {
  observationGate,
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
});
