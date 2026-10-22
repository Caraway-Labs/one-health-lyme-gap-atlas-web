import { describe, expect, it } from "vitest";

import {
  EXPLORER_MAP_LOADING_DELAY_MS,
  acceptExplorerMapPaintSettlement,
  explorerMapFrameReady,
  explorerMapLoadView,
  explorerMapLoadingMode,
  explorerMapPaintRevision,
  explorerMapRenderedFrameSignature,
  initialExplorerMapLoadState,
  reduceExplorerMapLoad,
  type ExplorerMapLoadState,
} from "@/features/ux-reset/review/explorer-map-loading";

function sync(
  state: ExplorerMapLoadState,
  key: string,
  mode: "error" | "idle" | "pending",
  now: number
): ExplorerMapLoadState {
  return reduceExplorerMapLoad(state, { key, mode, now, type: "sync" });
}

describe("explorer map loading lifecycle", () => {
  it("hides the overlay during the debounce and cancels it when render finishes first", () => {
    let state = sync(initialExplorerMapLoadState(), "gap", "pending", 0);
    expect(explorerMapLoadView(state)).toStrictEqual({
      blockMap: false,
      busy: true,
      overlay: "hidden",
    });
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      now: EXPLORER_MAP_LOADING_DELAY_MS - 1,
      type: "delay-elapsed",
    });
    expect(explorerMapLoadView(state).overlay).toBe("hidden");
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      type: "fetch-ready",
    });
    expect(explorerMapLoadView(state)).toMatchObject({
      busy: true,
      overlay: "hidden",
    });
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      type: "rendered",
    });
    expect(explorerMapLoadView(state)).toStrictEqual({
      blockMap: false,
      busy: false,
      overlay: "hidden",
    });
    const finished = state.generation;
    state = reduceExplorerMapLoad(state, {
      generation: finished,
      now: 5000,
      type: "delay-elapsed",
    });
    expect(explorerMapLoadView(state).overlay).toBe("hidden");
  });

  it("shows after the delay and removes the overlay as soon as the current layer renders", () => {
    let state = sync(initialExplorerMapLoadState(), "svi", "pending", 10);
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      now: 10 + EXPLORER_MAP_LOADING_DELAY_MS,
      type: "delay-elapsed",
    });
    expect(explorerMapLoadView(state)).toStrictEqual({
      blockMap: true,
      busy: true,
      overlay: "loading",
    });
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      type: "rendered",
    });
    expect(explorerMapLoadView(state).overlay).toBe("hidden");
  });

  it("ignores stale success and failure while a newer selection is loading", () => {
    let state = sync(initialExplorerMapLoadState(), "A", "pending", 0);
    const generationA = state.generation;
    state = sync(state, "B", "pending", 20);
    const generationB = state.generation;
    state = sync(state, "C", "pending", 40);
    const generationC = state.generation;
    state = reduceExplorerMapLoad(state, {
      generation: generationC,
      now: 40 + EXPLORER_MAP_LOADING_DELAY_MS,
      type: "delay-elapsed",
    });
    state = reduceExplorerMapLoad(state, {
      generation: generationA,
      type: "rendered",
    });
    state = reduceExplorerMapLoad(state, {
      generation: generationB,
      type: "failed",
    });
    expect(state.generation).toBe(generationC);
    expect(explorerMapLoadView(state).overlay).toBe("loading");
    state = reduceExplorerMapLoad(state, {
      generation: generationC,
      type: "rendered",
    });
    expect(state.key).toBe("C");
    expect(explorerMapLoadView(state).overlay).toBe("hidden");
  });

  it("accepts only the active paint revision", () => {
    expect(
      acceptExplorerMapPaintSettlement("C-revision", "A-revision")
    ).toBeFalsy();
    expect(
      acceptExplorerMapPaintSettlement("C-revision", "C-revision")
    ).toBeTruthy();
  });

  it("replaces the loader with retryable failure and ignores a superseded failure", () => {
    let state = sync(initialExplorerMapLoadState(), "rurality", "pending", 0);
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      type: "failed",
    });
    expect(explorerMapLoadView(state).overlay).toBe("error");
    const failedGeneration = state.generation;
    state = reduceExplorerMapLoad(state, { now: 80, type: "retry" });
    expect(state.phase).toBe("loading");
    expect(state.generation).not.toBe(failedGeneration);
    state = reduceExplorerMapLoad(state, {
      generation: failedGeneration,
      type: "failed",
    });
    expect(state.phase).toBe("loading");
  });

  it("lets the newest selection finish after a retry", () => {
    let state = sync(initialExplorerMapLoadState(), "rurality", "error", 0);
    state = reduceExplorerMapLoad(state, { now: 80, type: "retry" });
    state = sync(state, "svi", "pending", 90);
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      type: "rendered",
    });
    expect(state.key).toBe("svi");
    expect(explorerMapLoadView(state).overlay).toBe("hidden");
  });

  it("keeps a visible loader across rapid selections and stays pending until paint", () => {
    let state = sync(initialExplorerMapLoadState(), "A", "pending", 0);
    state = reduceExplorerMapLoad(state, {
      generation: state.generation,
      now: EXPLORER_MAP_LOADING_DELAY_MS,
      type: "delay-elapsed",
    });
    state = sync(state, "B", "pending", 20);
    expect(explorerMapLoadView(state).overlay).toBe("loading");
    expect(
      explorerMapLoadingMode({
        deferToOtherLoader: false,
        geometryFailed: false,
        geometryPending: false,
        emptyReadyFrame: false,
        layerFailed: false,
        mapFailed: false,
        paintKind: "choropleth",
        publishedRevision: "B",
        settledRevision: "A",
      })
    ).toBe("pending");
    expect(
      explorerMapLoadingMode({
        deferToOtherLoader: true,
        emptyReadyFrame: false,
        geometryFailed: false,
        geometryPending: true,
        layerFailed: false,
        mapFailed: false,
        paintKind: "loading",
        publishedRevision: null,
        settledRevision: null,
      })
    ).toBe("idle");
  });
});

describe("explorer map publication identity", () => {
  it("changes when rendered membership changes and stays null until geometry is ready", () => {
    const open = [
      { color: "#112233", fips: "08001" },
      { color: "#112233", fips: "36001" },
    ];
    const subset = [{ color: "#112233", fips: "08001" }];
    const ready = {
      frameReady: explorerMapFrameReady({
        availableDataKind: "ready",
        geometryFailed: false,
        geometryPending: false,
        geometryPresent: true,
      }),
      layerId: "gap_score",
      paintKind: "choropleth",
      releaseId: "alpha-2026",
      scope: "US",
    };
    const openRevision = explorerMapPaintRevision({
      ...ready,
      frameSignature: explorerMapRenderedFrameSignature(open),
    });
    const subsetRevision = explorerMapPaintRevision({
      ...ready,
      frameSignature: explorerMapRenderedFrameSignature(subset),
    });
    const unresolved = explorerMapPaintRevision({
      ...ready,
      frameReady: explorerMapFrameReady({
        availableDataKind: "ready",
        geometryFailed: false,
        geometryPending: true,
        geometryPresent: false,
      }),
      frameSignature: explorerMapRenderedFrameSignature([]),
    });
    expect(openRevision).not.toBe(subsetRevision);
    expect(unresolved).toBeNull();
  });

  it("treats a confirmed empty frame as complete without waiting for a canvas", () => {
    expect(
      explorerMapLoadingMode({
        deferToOtherLoader: false,
        emptyReadyFrame: true,
        geometryFailed: false,
        geometryPending: false,
        layerFailed: false,
        mapFailed: false,
        paintKind: "choropleth",
        publishedRevision: "gap:0",
        settledRevision: null,
      })
    ).toBe("idle");
  });
});
