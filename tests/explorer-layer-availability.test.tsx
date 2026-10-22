import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ExplorerMapLayerAvailability,
  LAYER_AVAILABILITY_ALL_AVAILABLE_COPY,
  LAYER_AVAILABILITY_RANKING_COPY,
} from "@/features/ux-reset/review/explorer-map-layer-control";
import {
  EXPLORER_MAP_LAYERS,
  type ExplorerLayerGate,
  type ExplorerMapLayerId,
} from "@/features/ux-reset/review/explorer-map-layers";

function gates(
  patch: Partial<Record<ExplorerMapLayerId, ExplorerLayerGate>> = {}
): Record<ExplorerMapLayerId, ExplorerLayerGate> {
  const next = {} as Record<ExplorerMapLayerId, ExplorerLayerGate>;
  for (const layer of EXPLORER_MAP_LAYERS) {
    next[layer.id] = patch[layer.id] ?? { reason: null, selectable: true };
  }
  return next;
}

describe(ExplorerMapLayerAvailability, () => {
  afterEach(() => {
    cleanup();
  });

  it("states shared availability once and keeps the release id", () => {
    render(
      <ExplorerMapLayerAvailability
        gates={gates()}
        releaseId=" governed-2026-10-15 "
      />
    );
    const disclosure = screen.getByTestId("explorer-layer-availability");
    const text = disclosure.textContent ?? "";
    expect({
      allAvailable: text.includes(LAYER_AVAILABILITY_ALL_AVAILABLE_COPY),
      oldCompleteness: text.includes("Evidence completeness"),
      oldScore: text.includes("Atlas gap score"),
      rankingCount: text.match(/Changing the map layer/g)?.length ?? 0,
      ranking: text.includes(LAYER_AVAILABILITY_RANKING_COPY),
      release: text.includes("Release governed-2026-10-15"),
      list: disclosure.querySelector("ul"),
    }).toStrictEqual({
      allAvailable: true,
      list: null,
      oldCompleteness: false,
      oldScore: false,
      ranking: true,
      rankingCount: 1,
      release: true,
    });
  });

  it("lists only unavailable layers with selector names and their reasons", () => {
    render(
      <ExplorerMapLayerAvailability
        gates={gates({
          completeness: {
            reason:
              "No published evidence-completeness value in the 0–100 range was available.",
            selectable: false,
          },
          gap_score: {
            reason: "Published values for this layer are still loading.",
            selectable: false,
          },
          incidence_floor: {
            reason: "Published incidence values failed validation.",
            selectable: false,
          },
        })}
        releaseId="alpha-2026"
      />
    );
    const disclosure = screen.getByTestId("explorer-layer-availability");
    const items = [...disclosure.querySelectorAll("li")].map(
      (item) => item.textContent
    );
    const text = disclosure.textContent ?? "";
    expect({
      allAvailable: text.includes(LAYER_AVAILABILITY_ALL_AVAILABLE_COPY),
      items,
      oldScore: text.includes("Atlas gap score"),
      ranking: text.includes(LAYER_AVAILABILITY_RANKING_COPY),
      release: text.includes("Release alpha-2026"),
      social: text.includes("Social vulnerability"),
    }).toStrictEqual({
      allAvailable: false,
      items: [
        "Gap review score. Published values for this layer are still loading.",
        "Lyme disease incidence. Published incidence values failed validation.",
        "Evidence completeness. No published evidence-completeness value in the 0–100 range was available.",
      ],
      oldScore: false,
      ranking: true,
      release: true,
      social: false,
    });
  });

  it("omits a release line when no release id is available", () => {
    render(<ExplorerMapLayerAvailability gates={gates()} releaseId="  " />);
    expect(
      screen.getByTestId("explorer-layer-availability").textContent
    ).not.toContain("Release");
  });
});
