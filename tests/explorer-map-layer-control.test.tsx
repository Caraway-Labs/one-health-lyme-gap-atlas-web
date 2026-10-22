import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExplorerMapLayerControl } from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  EXPLORER_MAP_LAYERS,
  explorerMapLayerMenuLabel,
  type ExplorerLayerGate,
  type ExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";

const gates = Object.fromEntries(
  EXPLORER_MAP_LAYERS.map((layer) => [
    layer.id,
    { reason: null, selectable: true },
  ])
) as Record<ExplorerMapLayerId, ExplorerLayerGate>;

describe("Explorer map layer control", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists thematic layers and omits County boundaries", () => {
    render(
      <ExplorerMapLayerControl
        gates={gates}
        layerId="gap_score"
        onLayerChange={() => {}}
      />
    );
    expect(screen.getByTestId("explorer-map-layer").textContent).toContain(
      "Gap review score"
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Map layer" }));
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toStrictEqual(
      EXPLORER_MAP_LAYERS.map((layer) => explorerMapLayerMenuLabel(layer))
    );
    expect(options).not.toContain("County boundaries");
  });
});
