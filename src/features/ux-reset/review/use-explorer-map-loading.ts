"use client";

import { useEffect, useState } from "react";

import {
  EXPLORER_MAP_LOADING_DELAY_MS,
  explorerMapLoadView,
  initialExplorerMapLoadState,
  reduceExplorerMapLoad,
  type ExplorerMapLoadState,
  type ExplorerMapLoadView,
} from "@/features/ux-reset/review/explorer-map-loading";

export function useExplorerMapLoadingPresentation(input: {
  mode: "error" | "idle" | "pending";
  requestKey: string;
}): ExplorerMapLoadView {
  const [state, setState] = useState<ExplorerMapLoadState>(
    initialExplorerMapLoadState
  );
  const synced = reduceExplorerMapLoad(state, {
    key: input.requestKey,
    mode: input.mode,
    now: 0,
    type: "sync",
  });
  if (synced !== state) {
    setState(synced);
  }

  useEffect(() => {
    if (synced.phase !== "loading" && synced.phase !== "awaiting-paint") {
      return;
    }
    if (synced.overlayLatched) {
      return;
    }
    const generation = synced.generation;
    const timer = window.setTimeout(() => {
      setState((current) =>
        reduceExplorerMapLoad(current, {
          generation,
          now: EXPLORER_MAP_LOADING_DELAY_MS,
          type: "delay-elapsed",
        })
      );
    }, EXPLORER_MAP_LOADING_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [synced.generation, synced.overlayLatched, synced.phase]);

  return explorerMapLoadView(synced);
}

export function usePublishedExplorerMapFrame<T>(
  revision: string | null,
  frame: T
): { frame: T; revision: string | null } {
  const [published, setPublished] = useState<{
    frame: T;
    revision: string;
  } | null>(null);
  if (revision && published?.revision !== revision) {
    setPublished({ frame, revision });
  }
  if (!revision) {
    if (published) {
      return { frame: published.frame, revision: published.revision };
    }
    return { frame, revision: null };
  }
  if (published?.revision === revision) {
    return published;
  }
  return { frame, revision };
}
