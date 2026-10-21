/**
 * Atlas Explorer map-viewport loading (WEB-770).
 *
 * Scope is the map viewport only. Sign-in and the first workspace shell belong
 * to WEB-769. Shell usability must not wait for map data, and this overlay must
 * not cover Explorer controls outside the map.
 *
 * Transitions:
 * - select / pending fetch: busy immediately, overlay hidden until 450 ms
 * - fetch ready: stay busy until the published revision has rendered
 * - rendered: hide immediately, even mid-animation
 * - failed: replace the animation with Retry; stale generations are ignored
 * - rapid A → B → C: only the active generation can latch, finish, or fail
 * - retry: new generation for the same selection
 * - unmount: callers drop timers; a late delay event cannot latch a finished generation
 */

export const EXPLORER_MAP_LOADING_DELAY_MS = 450;

/** WEB-769 must not block the shell on this map-local boundary. */
export const EXPLORER_MAP_LOADING_SCOPE = "map-viewport" as const;

export const EXPLORER_MAP_LOADING_HEADLINE = "Your Atlas is taking shape…";

export const EXPLORER_MAP_LOADING_SUPPORT =
  "Loading county patterns and map layers.";

export const EXPLORER_MAP_LOADING_ERROR_TITLE =
  "We couldn't load this map layer.";

export const EXPLORER_MAP_LOADING_ERROR_BODY =
  "Try again to reload the selected layer.";

export type ExplorerMapLoadPhase =
  | "idle"
  | "loading"
  | "awaiting-paint"
  | "ready"
  | "error";

export type ExplorerMapLoadState = {
  generation: number;
  key: string | null;
  overlayLatched: boolean;
  pendingSince: number | null;
  phase: ExplorerMapLoadPhase;
};

export type ExplorerMapLoadView = {
  blockMap: boolean;
  busy: boolean;
  overlay: "error" | "hidden" | "loading";
};

export type ExplorerMapLoadEvent =
  | {
      key: string;
      mode: "error" | "idle" | "pending";
      now: number;
      type: "sync";
    }
  | { generation: number; now: number; type: "delay-elapsed" }
  | { generation: number; type: "fetch-ready" }
  | { generation: number; type: "rendered" }
  | { generation: number; type: "failed" }
  | { now: number; type: "retry" };

export function initialExplorerMapLoadState(): ExplorerMapLoadState {
  return {
    generation: 0,
    key: null,
    overlayLatched: false,
    pendingSince: null,
    phase: "idle",
  };
}

function sameSelection(
  state: ExplorerMapLoadState,
  key: string,
  phase: ExplorerMapLoadPhase
): boolean {
  return state.key === key && state.phase === phase;
}

export function reduceExplorerMapLoad(
  state: ExplorerMapLoadState,
  event: ExplorerMapLoadEvent
): ExplorerMapLoadState {
  switch (event.type) {
    case "sync": {
      if (event.mode === "error") {
        if (sameSelection(state, event.key, "error")) {
          return state;
        }
        return {
          generation: state.generation + 1,
          key: event.key,
          overlayLatched: false,
          pendingSince: null,
          phase: "error",
        };
      }
      if (event.mode === "pending") {
        if (
          state.key === event.key &&
          (state.phase === "loading" || state.phase === "awaiting-paint")
        ) {
          return state;
        }
        const keepOverlay =
          state.overlayLatched &&
          (state.phase === "loading" || state.phase === "awaiting-paint");
        return {
          generation: state.generation + 1,
          key: event.key,
          overlayLatched: keepOverlay,
          pendingSince: keepOverlay ? state.pendingSince : event.now,
          phase: "loading",
        };
      }
      if (state.phase === "ready" && state.key === event.key) {
        return state;
      }
      return {
        generation: state.generation,
        key: event.key,
        overlayLatched: false,
        pendingSince: null,
        phase: "ready",
      };
    }
    case "delay-elapsed": {
      if (event.generation !== state.generation) {
        return state;
      }
      if (state.phase !== "loading" && state.phase !== "awaiting-paint") {
        return state;
      }
      if (state.pendingSince === null) {
        return state;
      }
      if (event.now - state.pendingSince < EXPLORER_MAP_LOADING_DELAY_MS) {
        return state;
      }
      return { ...state, overlayLatched: true };
    }
    case "fetch-ready": {
      if (event.generation !== state.generation || state.phase !== "loading") {
        return state;
      }
      return { ...state, phase: "awaiting-paint" };
    }
    case "rendered": {
      if (
        event.generation !== state.generation ||
        (state.phase !== "loading" && state.phase !== "awaiting-paint")
      ) {
        return state;
      }
      return {
        ...state,
        overlayLatched: false,
        pendingSince: null,
        phase: "ready",
      };
    }
    case "failed": {
      if (
        event.generation !== state.generation ||
        (state.phase !== "loading" && state.phase !== "awaiting-paint")
      ) {
        return state;
      }
      return {
        ...state,
        overlayLatched: false,
        pendingSince: null,
        phase: "error",
      };
    }
    case "retry": {
      if (state.phase !== "error" || state.key === null) {
        return state;
      }
      return {
        generation: state.generation + 1,
        key: state.key,
        overlayLatched: false,
        pendingSince: event.now,
        phase: "loading",
      };
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export function explorerMapLoadView(
  state: ExplorerMapLoadState
): ExplorerMapLoadView {
  if (state.phase === "error") {
    return { blockMap: true, busy: false, overlay: "error" };
  }
  const busy = state.phase === "loading" || state.phase === "awaiting-paint";
  if (busy && state.overlayLatched) {
    return { blockMap: true, busy: true, overlay: "loading" };
  }
  return { blockMap: false, busy, overlay: "hidden" };
}

/** Ignore a paint callback that belongs to an older published revision. */
export function acceptExplorerMapPaintSettlement(
  activeRevision: string | null,
  eventRevision: string
): boolean {
  return activeRevision !== null && activeRevision === eventRevision;
}

export function explorerMapLoadingMode(input: {
  confirmedEmptyFrame: boolean;
  deferToOtherLoader: boolean;
  geometryFailed: boolean;
  geometryPending: boolean;
  layerFailed: boolean;
  mapFailed: boolean;
  paintKind: string;
  publishedRevision: string | null;
  settledRevision: string | null;
}): "error" | "idle" | "pending" {
  if (input.deferToOtherLoader || input.geometryFailed || input.mapFailed) {
    return "idle";
  }
  if (input.layerFailed) {
    return "error";
  }
  if (input.geometryPending || input.paintKind === "loading") {
    return "pending";
  }
  // A settled Available-data filter can match nothing. That frame is complete
  // without a canvas: AtlasMap stays unmounted when there are no counties.
  if (input.confirmedEmptyFrame) {
    return "idle";
  }
  if (
    input.publishedRevision !== null &&
    input.publishedRevision !== input.settledRevision
  ) {
    return "pending";
  }
  return "idle";
}

export function explorerScoresLoadStatus(query: {
  data?: unknown;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
}): "error" | "loading" | "ready" {
  if (query.isPending || (query.isFetching && !query.data)) {
    return "loading";
  }
  if (query.isError) {
    return "error";
  }
  return "ready";
}

/** Counties actually passed to the map, including filter membership and fallback colors. */
export function explorerMapRenderedFrameSignature(
  counties: readonly { color?: string; fips: string }[]
): string {
  const parts = [String(counties.length)];
  for (const county of counties) {
    parts.push(county.fips, county.color ?? "");
  }
  return parts.join(":");
}

/**
 * A frame is publishable only when geometry has arrived and the Available data
 * gate has settled. An empty array before that is unresolved, not a new map.
 */
export function explorerMapFrameReady(input: {
  availableDataKind: "error" | "loading" | "open" | "ready";
  geometryFailed: boolean;
  geometryPending: boolean;
  geometryPresent: boolean;
}): boolean {
  return (
    input.geometryPresent &&
    !input.geometryPending &&
    !input.geometryFailed &&
    (input.availableDataKind === "open" || input.availableDataKind === "ready")
  );
}

export function explorerMapPaintRevision(input: {
  frameReady: boolean;
  frameSignature: string;
  layerId: string;
  paintKind: string;
  releaseId: string;
  scope: string;
}): string | null {
  // Loading has no colors yet, so the previous frame stays up under the
  // overlay. Unavailable is a finished boundary frame and must replace it.
  if (!input.frameReady || input.paintKind === "loading") {
    return null;
  }
  return `${input.scope}:${input.releaseId}:${input.layerId}:${input.paintKind}:${input.frameSignature}`;
}
