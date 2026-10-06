"use client";

import { useEffect } from "react";

import { RESET_EXPLORE_PATH } from "@/features/ux-reset/routes";

/**
 * nuqs 2.10.1 keeps one global history queue. `throttleMs` can only lengthen
 * that queue, so an Explore initialization `replace` can flush after the user
 * has already started Investigate or Compare and rewrite the destination URL.
 * Once that navigation starts, queued nuqs history writes are ignored until
 * Explore unmounts. Next.js history updates do not use the nuqs marker, so
 * they still commit.
 */
const NUQS_HISTORY_MARKER = "__nuqs__";

type HistoryWriter = (
  data: unknown,
  unused: string,
  url?: string | URL | null
) => void;

let blockQueuedNuqsWrites = false;
let exploreMounted = false;
let listening = false;
let guardedReplaceState: typeof history.replaceState | null = null;
let guardedPushState: typeof history.pushState | null = null;

function parsedHistoryUrl(url: string | URL): URL | null {
  try {
    return new URL(url, window.location.href);
  } catch {
    return null;
  }
}

function leavesExplore(url: string | URL | null | undefined): boolean {
  if (url == null || window.location.pathname !== RESET_EXPLORE_PATH) {
    return false;
  }
  const next = parsedHistoryUrl(url);
  return next !== null && next.pathname !== RESET_EXPLORE_PATH;
}

function handleHistoryUpdate(
  previous: HistoryWriter,
  data: unknown,
  unused: string,
  url?: string | URL | null
): void {
  if (unused !== NUQS_HISTORY_MARKER && leavesExplore(url)) {
    blockQueuedNuqsWrites = true;
  }
  if (unused === NUQS_HISTORY_MARKER && blockQueuedNuqsWrites) {
    return;
  }
  previous(data, unused, url);
}

function installHistoryWriter(
  current: typeof history.replaceState,
  guarded: typeof history.replaceState | null,
  assign: (writer: typeof history.replaceState) => void
): typeof history.replaceState {
  if (guarded && current === guarded) {
    return guarded;
  }
  const previous = current.bind(window.history);
  const wrapped: typeof history.replaceState = (data, unused, url) => {
    handleHistoryUpdate(previous, data, unused, url);
  };
  assign(wrapped);
  return wrapped;
}

function anchorFromClick(event: MouseEvent): HTMLAnchorElement | null {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }
  const { target } = event;
  if (!(target instanceof Element)) {
    return null;
  }
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }
  return anchor;
}

function onDocumentClick(event: MouseEvent): void {
  const anchor = anchorFromClick(event);
  if (!anchor) {
    if (window.location.pathname === RESET_EXPLORE_PATH) {
      blockQueuedNuqsWrites = false;
    }
    return;
  }
  installExploreUrlNavigationGuard();
  if (leavesExplore(anchor.href)) {
    blockQueuedNuqsWrites = true;
    return;
  }
  if (window.location.pathname === RESET_EXPLORE_PATH) {
    blockQueuedNuqsWrites = false;
  }
}

function onPopState(): void {
  if (window.location.pathname !== RESET_EXPLORE_PATH) {
    blockQueuedNuqsWrites = true;
  }
}

export function installExploreUrlNavigationGuard(): void {
  if (typeof window === "undefined") {
    return;
  }
  guardedReplaceState = installHistoryWriter(
    window.history.replaceState,
    guardedReplaceState,
    (writer) => {
      guardedReplaceState = writer;
      window.history.replaceState = writer;
    }
  );
  const wrappedPush = installHistoryWriter(
    window.history.pushState,
    guardedPushState,
    (writer) => {
      guardedPushState = writer;
      window.history.pushState = writer;
    }
  );
  guardedPushState = wrappedPush;
  if (listening) {
    return;
  }
  document.addEventListener("click", onDocumentClick, true);
  window.addEventListener("popstate", onPopState);
  listening = true;
}

export function resetExploreUrlNavigationGuardForTests(): void {
  blockQueuedNuqsWrites = false;
  exploreMounted = false;
  guardedReplaceState = null;
  guardedPushState = null;
  if (!listening) {
    return;
  }
  document.removeEventListener("click", onDocumentClick, true);
  window.removeEventListener("popstate", onPopState);
  listening = false;
}

function releaseQueuedWritesAfterExploreUnmount(): void {
  if (exploreMounted || window.location.pathname === RESET_EXPLORE_PATH) {
    return;
  }
  blockQueuedNuqsWrites = false;
}

export function useExploreUrlNavigationGuard(): void {
  useEffect(() => {
    exploreMounted = true;
    blockQueuedNuqsWrites = false;
    installExploreUrlNavigationGuard();
    queueMicrotask(installExploreUrlNavigationGuard);
    return () => {
      exploreMounted = false;
      blockQueuedNuqsWrites = true;
      queueMicrotask(releaseQueuedWritesAfterExploreUnmount);
    };
  }, []);
}
