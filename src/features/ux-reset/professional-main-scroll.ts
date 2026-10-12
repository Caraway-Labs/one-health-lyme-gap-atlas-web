"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

const ENTRY_KEY = "atlasMainScrollEntry";
const OFFSET_STORAGE_KEY = "atlas-main-scroll-offsets";
const OFFSET_LIMIT = 40;
const MAIN_SCROLL_HOLD_FRAMES = 180;

export type ScrollNavigationKind = "idle" | "pop" | "push" | "replace";

export type MainScrollDecision =
  | { offset: number; type: "restore" }
  | { type: "hash" }
  | { type: "keep" }
  | { type: "reset" };

type HoldState = {
  cancel: () => void;
  entryId: string;
  main: HTMLElement;
  top: number;
};

type StoredOffset = [string, number];

let navigationKind: ScrollNavigationKind = "idle";
let pendingRestoreEntryId: string | null = null;
let lastCommittedPath = "";
let stampingEntry = false;
let entrySequence = 0;
let offsets = new Map<string, number>();
let activeHold: HoldState | null = null;
let mountedMain: HTMLElement | null = null;
const suppressRemember = { current: false };

let hashWatch: {
  disconnect: () => void;
  key: string;
  main: HTMLElement;
} | null = null;

function pathAndSearch(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function pathAndSearchFrom(url: string | URL | null | undefined): string {
  if (url == null || url === "") {
    return pathAndSearch();
  }
  try {
    const parsed = new URL(String(url), window.location.href);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return pathAndSearch();
  }
}

function hashFrom(url: string | URL | null | undefined): string {
  if (url == null || url === "") {
    return window.location.hash;
  }
  try {
    return new URL(String(url), window.location.href).hash;
  } catch {
    return window.location.hash;
  }
}

export function readHistoryEntryId(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }
  const value = (state as Record<string, unknown>)[ENTRY_KEY];
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
}

function createEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  entrySequence += 1;
  return `atlas-scroll-${entrySequence}`;
}

function stateWithEntry(state: unknown, id: string): object {
  const base = state && typeof state === "object" ? { ...state } : {};
  return { ...base, [ENTRY_KEY]: id };
}

function loadOffsets(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(OFFSET_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Map();
    }
    const next = new Map<string, number>();
    for (const item of parsed) {
      if (!Array.isArray(item)) {
        continue;
      }
      const [id, offset] = item as StoredOffset;
      if (
        typeof id === "string" &&
        typeof offset === "number" &&
        Number.isFinite(offset)
      ) {
        next.set(id, offset);
      }
    }
    return next;
  } catch {
    return new Map();
  }
}

function persistOffsets() {
  const entries = [...offsets.entries()].slice(-OFFSET_LIMIT);
  offsets = new Map(entries);
  try {
    sessionStorage.setItem(OFFSET_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing can reject sessionStorage. The in-memory map still
    // restores offsets for this document.
  }
}

function rememberOffset(id: string, offset: number) {
  if (offsets.has(id)) {
    offsets.delete(id);
  }
  offsets.set(id, offset);
  persistOffsets();
}

function readOffset(id: string): number | undefined {
  const value = offsets.get(id);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function hashTargetId(): string | null {
  const hash = window.location.hash;
  if (hash.length <= 1) {
    return null;
  }
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
}

export function normalizedSearch(search: string): string {
  const params = new URLSearchParams(search);
  const keys = [...new Set(params.keys())].sort();
  return keys
    .flatMap((key) => params.getAll(key).map((value) => `${key}=${value}`))
    .join("&");
}

export function mainLocationKey(pathname: string, search: string): string {
  const normalized = normalizedSearch(search);
  if (normalized.length === 0) {
    return pathname;
  }
  return `${pathname}?${normalized}`;
}

function scrollMainToHash(main: HTMLElement): boolean {
  const id = hashTargetId();
  if (!id) {
    return false;
  }
  const target = document.querySelector(`#${CSS.escape(id)}`);
  if (!(target && main.contains(target))) {
    return false;
  }
  const padding = Number.parseFloat(getComputedStyle(main).scrollPaddingTop);
  const offset = Number.isFinite(padding) ? padding : 0;
  const delta =
    target.getBoundingClientRect().top -
    main.getBoundingClientRect().top -
    offset;
  main.scrollTop += delta;
  return true;
}

function stopHashWatch() {
  hashWatch?.disconnect();
  hashWatch = null;
}

function watchMainHash(main: HTMLElement, pathname: string) {
  if (!hashTargetId()) {
    stopHashWatch();
    return;
  }
  if (scrollMainToHash(main)) {
    stopHashWatch();
    return;
  }
  if (hashWatch?.key === pathname && hashWatch.main === main) {
    return;
  }
  stopHashWatch();
  const observer = new MutationObserver(() => {
    if (scrollMainToHash(main)) {
      stopHashWatch();
    }
  });
  observer.observe(main, { childList: true, subtree: true });
  hashWatch = {
    disconnect: () => observer.disconnect(),
    key: pathname,
    main,
  };
}

function cancelMainScrollHold() {
  activeHold?.cancel();
  activeHold = null;
}

function holdMainScroll(main: HTMLElement, top: number, entryId: string) {
  if (
    activeHold?.entryId === entryId &&
    activeHold.main === main &&
    activeHold.top === top
  ) {
    return;
  }
  cancelMainScrollHold();
  let frames = 0;
  let settledFrames = 0;
  let active = true;
  const apply = () => {
    if (readHistoryEntryId(window.history.state) !== entryId) {
      active = false;
      return;
    }
    suppressRemember.current = true;
    main.scrollTop = top;
    suppressRemember.current = false;
  };
  const reapply = () => {
    if (!active) {
      if (activeHold?.entryId === entryId) {
        activeHold = null;
      }
      return;
    }
    frames += 1;
    const maximum = Math.max(0, main.scrollHeight - main.clientHeight);
    const contentReady = maximum + 1 >= top;
    const parked = Math.abs(main.scrollTop - Math.min(top, maximum)) <= 1;
    if (contentReady && parked) {
      settledFrames += 1;
    } else {
      apply();
      settledFrames = 0;
    }
    const finished = frames >= MAIN_SCROLL_HOLD_FRAMES || settledFrames >= 2;
    if (finished || !active) {
      if (activeHold?.entryId === entryId) {
        activeHold = null;
      }
      return;
    }
    window.requestAnimationFrame(reapply);
  };
  activeHold = {
    cancel: () => {
      active = false;
    },
    entryId,
    main,
    top,
  };
  apply();
  window.requestAnimationFrame(reapply);
}

function ensureEntryId(): string {
  const existing = readHistoryEntryId(window.history.state);
  if (existing) {
    return existing;
  }
  const id = createEntryId();
  stampingEntry = true;
  window.history.replaceState(
    stateWithEntry(window.history.state, id),
    "",
    window.location.href
  );
  stampingEntry = false;
  return id;
}

function restoreHashOnly(main: HTMLElement) {
  pendingRestoreEntryId = null;
  navigationKind = "idle";
  if (hashTargetId()) {
    watchMainHash(main, window.location.pathname);
    return;
  }
  const entryId = readHistoryEntryId(window.history.state);
  if (!entryId) {
    return;
  }
  holdMainScroll(main, readOffset(entryId) ?? 0, entryId);
}

export function decideMainScroll(input: {
  entryMatchesPending: boolean;
  hasHash: boolean;
  kind: ScrollNavigationKind;
  locationKey: string;
  previousLocationKey: string | null;
  savedOffset: number | undefined;
}): MainScrollDecision {
  const saved = input.savedOffset ?? 0;
  switch (input.kind) {
    case "pop": {
      if (input.entryMatchesPending) {
        if (input.hasHash) {
          return { type: "hash" };
        }
        return { offset: saved, type: "restore" };
      }
      if (input.hasHash) {
        return { type: "hash" };
      }
      return { type: "reset" };
    }
    case "push": {
      if (input.hasHash) {
        return { type: "hash" };
      }
      return { type: "reset" };
    }
    case "replace": {
      if (input.hasHash) {
        return { type: "hash" };
      }
      if (input.previousLocationKey === null && saved > 0) {
        return { offset: saved, type: "restore" };
      }
      return { type: "keep" };
    }
    case "idle": {
      if (input.hasHash) {
        return { type: "hash" };
      }
      if (input.previousLocationKey === null && saved > 0) {
        return { offset: saved, type: "restore" };
      }
      if (
        input.previousLocationKey !== null &&
        input.previousLocationKey !== input.locationKey
      ) {
        return { type: "reset" };
      }
      return { type: "keep" };
    }
    default: {
      const exhaustive: never = input.kind;
      return exhaustive;
    }
  }
}

function installHistoryGuards() {
  if (typeof window === "undefined" || "atlasMainScroll" in window) {
    return;
  }
  Object.defineProperty(window, "atlasMainScroll", { value: true });
  offsets = loadOffsets();
  lastCommittedPath = pathAndSearch();
  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = (data, unused, url) => {
    const nextPath = pathAndSearchFrom(url);
    const hashOnly = nextPath === pathAndSearch();
    const id = createEntryId();
    const result = originalPushState(stateWithEntry(data, id), unused, url);
    pendingRestoreEntryId = null;
    if (hashOnly) {
      navigationKind = "idle";
      if (mountedMain && hashFrom(url).length > 1) {
        watchMainHash(mountedMain, window.location.pathname);
      }
      return result;
    }
    navigationKind = "push";
    return result;
  };
  window.history.replaceState = (data, unused, url) => {
    if (!stampingEntry && navigationKind === "idle") {
      navigationKind = "replace";
    }
    const id =
      readHistoryEntryId(window.history.state) ??
      readHistoryEntryId(data) ??
      createEntryId();
    return originalReplaceState(stateWithEntry(data, id), unused, url);
  };
  window.addEventListener(
    "popstate",
    () => {
      const hashOnly = pathAndSearch() === lastCommittedPath;
      if (hashOnly) {
        if (mountedMain) {
          restoreHashOnly(mountedMain);
        } else {
          pendingRestoreEntryId = null;
          navigationKind = "idle";
        }
        return;
      }
      navigationKind = "pop";
      pendingRestoreEntryId = readHistoryEntryId(window.history.state);
    },
    true
  );
}

installHistoryGuards();

type MainScrollKey =
  | " "
  | "ArrowDown"
  | "ArrowUp"
  | "End"
  | "Home"
  | "PageDown"
  | "PageUp";

function isMainScrollKey(key: string): key is MainScrollKey {
  switch (key) {
    case " ":
    case "ArrowDown":
    case "ArrowUp":
    case "End":
    case "Home":
    case "PageDown":
    case "PageUp": {
      return true;
    }
    default: {
      return false;
    }
  }
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const role = target.getAttribute("role");
  if (role === "searchbox" || role === "textbox") {
    return true;
  }
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }
  switch (target.type) {
    case "button":
    case "checkbox":
    case "color":
    case "file":
    case "image":
    case "radio":
    case "range":
    case "reset":
    case "submit": {
      return false;
    }
    default: {
      return true;
    }
  }
}

const NATIVE_ARROW_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "email",
  "month",
  "number",
  "password",
  "radio",
  "range",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);

const ARROW_OWNER_ROLES = new Set([
  "combobox",
  "grid",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "option",
  "radio",
  "radiogroup",
  "scrollbar",
  "slider",
  "spinbutton",
  "tab",
  "tablist",
  "tree",
  "treegrid",
]);

export function arrowKeyOwnedByTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  if (
    target instanceof HTMLInputElement &&
    NATIVE_ARROW_INPUT_TYPES.has(target.type)
  ) {
    return true;
  }
  let current: Element | null = target;
  while (current && current !== document.body) {
    const role = current.getAttribute("role");
    if (role && ARROW_OWNER_ROLES.has(role)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

export function targetHandlesSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLInputElement) {
    switch (target.type) {
      case "checkbox":
      case "radio": {
        return true;
      }
      default: {
        break;
      }
    }
  }
  const role = target.getAttribute("role");
  switch (target.tagName) {
    case "A":
    case "BUTTON":
    case "SUMMARY": {
      return true;
    }
    default: {
      break;
    }
  }
  switch (role) {
    case "button":
    case "checkbox":
    case "link":
    case "menuitem":
    case "option":
    case "radio":
    case "switch":
    case "tab": {
      return true;
    }
    default: {
      return false;
    }
  }
}

function scrollableAncestor(
  target: EventTarget | null,
  direction: "down" | "up"
): HTMLElement | null {
  let current = target instanceof HTMLElement ? target : null;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const overflowY = getComputedStyle(current).overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight + 1;
    if (canScroll) {
      const maximum = current.scrollHeight - current.clientHeight;
      const room =
        direction === "down"
          ? current.scrollTop < maximum - 1
          : current.scrollTop > 1;
      if (room) {
        return current;
      }
    }
    current = current.parentElement;
  }
  return null;
}

function scrollMainForKey(
  main: HTMLElement,
  key: MainScrollKey,
  direction: "down" | "up"
) {
  const page = main.clientHeight;
  switch (key) {
    case "Home": {
      main.scrollTop = 0;
      return;
    }
    case "End": {
      main.scrollTop = main.scrollHeight;
      return;
    }
    case " ":
    case "PageDown":
    case "PageUp": {
      main.scrollTop += direction === "down" ? page : -page;
      return;
    }
    case "ArrowDown":
    case "ArrowUp": {
      const line = Number.parseFloat(getComputedStyle(main).lineHeight);
      const distance = Number.isFinite(line) ? line : page;
      main.scrollTop += direction === "down" ? distance : -distance;
      return;
    }
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

function mainScrollDirection(event: KeyboardEvent): "down" | "up" | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  if (event.key === " " && event.shiftKey) {
    return "up";
  }
  if (event.shiftKey || !isMainScrollKey(event.key)) {
    return null;
  }
  switch (event.key) {
    case "ArrowUp":
    case "Home":
    case "PageUp": {
      return "up";
    }
    case " ":
    case "ArrowDown":
    case "End":
    case "PageDown": {
      return "down";
    }
    default: {
      const exhaustive: never = event.key;
      return exhaustive;
    }
  }
}

function applyScrollDecision(
  main: HTMLElement,
  decision: MainScrollDecision,
  entryId: string,
  pathname: string
) {
  switch (decision.type) {
    case "restore": {
      stopHashWatch();
      holdMainScroll(main, decision.offset, entryId);
      return;
    }
    case "hash": {
      if (activeHold && activeHold.entryId !== entryId) {
        cancelMainScrollHold();
      }
      watchMainHash(main, pathname);
      return;
    }
    case "reset": {
      cancelMainScrollHold();
      stopHashWatch();
      suppressRemember.current = true;
      main.scrollTop = 0;
      suppressRemember.current = false;
      if (hashTargetId()) {
        watchMainHash(main, pathname);
      }
      break;
    }
    case "keep": {
      break;
    }
    default: {
      const exhaustive: never = decision;
      return exhaustive;
    }
  }
}

export function resetProfessionalMainScrollForTests() {
  cancelMainScrollHold();
  stopHashWatch();
  offsets = new Map();
  navigationKind = "idle";
  pendingRestoreEntryId = null;
  lastCommittedPath = typeof window === "undefined" ? "" : pathAndSearch();
  mountedMain = null;
  suppressRemember.current = false;
  try {
    sessionStorage.removeItem(OFFSET_STORAGE_KEY);
  } catch {
    // sessionStorage can be unavailable in a locked-down document.
  }
}

export function hydrateProfessionalMainScrollForTests() {
  offsets = loadOffsets();
}

export function useProfessionalMainScroll(
  mainRef: RefObject<HTMLElement | null>,
  pathname: string,
  searchKey: string
) {
  const previousLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const main = mainRef.current;
    mountedMain = main;
    return () => {
      if (mountedMain === main) {
        mountedMain = null;
      }
      if (activeHold?.main === main) {
        cancelMainScrollHold();
      }
    };
  }, [mainRef]);

  useEffect(() => {
    const onHashChange = () => {
      if (pathAndSearch() !== lastCommittedPath) {
        return;
      }
      pendingRestoreEntryId = null;
      navigationKind = "idle";
      const main = mainRef.current;
      if (!main) {
        return;
      }
      watchMainHash(main, window.location.pathname);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [mainRef]);

  useEffect(() => {
    // The viewport does not scroll, so document-level paging keys would no-op
    // while focus is outside the main pane. Forward those keys into main.
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        document.querySelector("[aria-modal='true']")
      ) {
        return;
      }
      const main = mainRef.current;
      const direction = main ? mainScrollDirection(event) : null;
      if (!(main && direction && isMainScrollKey(event.key))) {
        return;
      }
      if (isTextEntry(event.target)) {
        return;
      }
      if (event.key === " " && targetHandlesSpace(event.target)) {
        return;
      }
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        arrowKeyOwnedByTarget(event.target)
      ) {
        return;
      }
      if (scrollableAncestor(event.target, direction)) {
        return;
      }
      event.preventDefault();
      scrollMainForKey(main, event.key, direction);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mainRef]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }
    mountedMain = main;
    const entryId = ensureEntryId();
    const locationKey = mainLocationKey(pathname, searchKey);
    if (activeHold && activeHold.entryId !== entryId) {
      cancelMainScrollHold();
    }
    const decision = decideMainScroll({
      entryMatchesPending: pendingRestoreEntryId === entryId,
      hasHash: hashTargetId() !== null,
      kind: navigationKind,
      locationKey,
      previousLocationKey: previousLocationRef.current,
      savedOffset: readOffset(entryId),
    });
    navigationKind = "idle";
    pendingRestoreEntryId = null;
    previousLocationRef.current = locationKey;
    lastCommittedPath = pathAndSearch();
    applyScrollDecision(main, decision, entryId, pathname);
  }, [mainRef, pathname, searchKey]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }
    const remember = () => {
      if (suppressRemember.current) {
        return;
      }
      const entryId = readHistoryEntryId(window.history.state);
      if (!entryId) {
        return;
      }
      rememberOffset(entryId, main.scrollTop);
    };
    main.addEventListener("scroll", remember, { passive: true });
    return () => {
      main.removeEventListener("scroll", remember);
    };
  }, [mainRef]);
}
