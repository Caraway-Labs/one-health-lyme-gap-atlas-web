"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode, RefObject } from "react";

import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { uxResetShellHandoffHref } from "@/features/ux-reset";
import {
  AskAtlasChromeProvider,
  useAskAtlasChrome,
} from "@/features/ux-reset/ask-atlas/ask-atlas-chrome";
import {
  ExploreCommittedNavigationProvider,
  searchParamsWithCommittedExploreContext,
  useExploreCommittedNavigation,
} from "@/features/ux-reset/explore-committed-navigation";
import {
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
  isResetRouteActive,
  resetRouteById,
  type ResetRoute,
} from "@/features/ux-reset/paths";
import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";

const MOBILE_TRIGGER_RESTORE_FRAMES = 12;
const rememberedMainScroll = new Map<string, number>();
let pendingScrollRestore = false;
let navigationWasPush = false;

if (typeof window !== "undefined" && !("atlasMainScroll" in window)) {
  Object.defineProperty(window, "atlasMainScroll", { value: true });
  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args) => {
    navigationWasPush = true;
    return originalPushState(...args);
  };
  window.addEventListener(
    "popstate",
    () => {
      navigationWasPush = false;
      pendingScrollRestore = true;
    },
    true
  );
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

function normalizedSearch(search: string): string {
  const params = new URLSearchParams(search);
  return [...params.keys()]
    .sort()
    .flatMap((key) => params.getAll(key).map((value) => `${key}=${value}`))
    .join("&");
}

function mainLocationKey(pathname: string, search: string): string {
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

let hashWatch: {
  disconnect: () => void;
  key: string;
  main: HTMLElement;
} | null = null;

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

const MAIN_SCROLL_HOLD_FRAMES = 180;

let activeHold: {
  cancel: () => void;
  key: string;
  main: HTMLElement;
} | null = null;

function cancelMainScrollHold() {
  activeHold?.cancel();
  activeHold = null;
}

function holdMainScroll(
  main: HTMLElement,
  top: number,
  key: string,
  suppressRemember: { current: boolean }
) {
  if (activeHold?.key === key && activeHold.main === main) {
    return;
  }
  cancelMainScrollHold();
  let frames = 0;
  let settledFrames = 0;
  let active = true;
  const apply = () => {
    suppressRemember.current = true;
    main.scrollTop = top;
    suppressRemember.current = false;
  };
  const reapply = () => {
    if (!active) {
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
    if (frames < MAIN_SCROLL_HOLD_FRAMES && settledFrames < 2) {
      window.requestAnimationFrame(reapply);
    }
  };
  apply();
  window.requestAnimationFrame(reapply);
  activeHold = {
    cancel: () => {
      active = false;
    },
    key,
    main,
  };
}

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

function targetHandlesSpace(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
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
    case "switch":
    case "tab": {
      return true;
    }
    default: {
      return false;
    }
  }
}

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
  "slider",
  "spinbutton",
  "tablist",
  "tree",
]);

function arrowKeyOwnedByWidget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
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
      main.scrollBy({ top: direction === "down" ? page : -page });
      return;
    }
    case "ArrowDown":
    case "ArrowUp": {
      const line = Number.parseFloat(getComputedStyle(main).lineHeight);
      const distance = Number.isFinite(line) ? line : page;
      main.scrollBy({ top: direction === "down" ? distance : -distance });
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

function useProfessionalMainScroll(
  mainRef: RefObject<HTMLElement | null>,
  pathname: string,
  searchKey: string
) {
  const previousPathRef = useRef<string | null>(null);
  const suppressRememberRef = useRef(false);

  useEffect(() => {
    const onHashChange = () => {
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
        arrowKeyOwnedByWidget(event.target)
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
    const locationKey = mainLocationKey(pathname, searchKey);
    const pathnameChanged = previousPathRef.current !== pathname;
    const restore =
      pendingScrollRestore ||
      (!navigationWasPush &&
        pathnameChanged &&
        rememberedMainScroll.has(locationKey));
    pendingScrollRestore = false;
    navigationWasPush = false;
    previousPathRef.current = pathname;
    if (restore) {
      stopHashWatch();
      holdMainScroll(
        main,
        rememberedMainScroll.get(locationKey) ?? 0,
        locationKey,
        suppressRememberRef
      );
      return;
    }
    if (!pathnameChanged) {
      return;
    }
    cancelMainScrollHold();
    if (scrollMainToHash(main)) {
      stopHashWatch();
      return;
    }
    suppressRememberRef.current = true;
    main.scrollTop = 0;
    suppressRememberRef.current = false;
    watchMainHash(main, pathname);
  }, [mainRef, pathname, searchKey]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }
    const locationKey = mainLocationKey(pathname, searchKey);
    const remember = () => {
      if (
        suppressRememberRef.current ||
        mainLocationKey(window.location.pathname, window.location.search) !==
          locationKey
      ) {
        return;
      }
      rememberedMainScroll.set(locationKey, main.scrollTop);
    };
    main.addEventListener("scroll", remember, { passive: true });
    return () => {
      main.removeEventListener("scroll", remember);
    };
  }, [mainRef, pathname, searchKey]);
}

function focusWasDisplacedByInertClose(
  active: Element | null,
  sidebar: HTMLElement | null
): boolean {
  if (!(active instanceof HTMLElement)) return true;
  if (active === document.body || active === document.documentElement) {
    return true;
  }
  return Boolean(sidebar?.contains(active));
}

function restoreMobileNavigationTrigger(
  trigger: HTMLElement,
  sidebar: HTMLElement | null
): () => void {
  let frame = 0;
  let frames = 0;
  let restoring = true;
  const restore = () => {
    if (!restoring) return;
    if (
      focusWasDisplacedByInertClose(document.activeElement, sidebar) &&
      trigger.isConnected
    ) {
      trigger.focus({ preventScroll: true });
    }
    frames += 1;
    if (restoring && frames < MOBILE_TRIGGER_RESTORE_FRAMES) {
      frame = window.requestAnimationFrame(restore);
    }
  };
  restore();
  return () => {
    restoring = false;
    window.cancelAnimationFrame(frame);
  };
}

/** Production preference key. Story frames must not share this key. */
export const RESET_PRO_SIDEBAR_STORAGE_KEY = "ux-reset-pro-sidebar";

type ResetProfessionalShellProps = {
  children: ReactNode;
  /** Used when this browser has no saved value for `sidebarStorageKey`. */
  sidebarDefaultOpen?: boolean;
  sidebarStorageKey?: string;
};

export function ResetProfessionalShell({
  children,
  sidebarDefaultOpen = true,
  sidebarStorageKey = RESET_PRO_SIDEBAR_STORAGE_KEY,
}: ResetProfessionalShellProps) {
  return (
    <ExploreCommittedNavigationProvider>
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        storageKey={sidebarStorageKey}
      >
        <AskAtlasChromeProvider>
          <ResetProfessionalFrame>{children}</ResetProfessionalFrame>
        </AskAtlasChromeProvider>
      </SidebarProvider>
    </ExploreCommittedNavigationProvider>
  );
}

function ResetProfessionalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mobileOpen, open, setMobileOpen } = useSidebar();
  const isMobileViewport = useMobileViewport();
  const askAtlas = useAskAtlasChrome();
  const mobileDrawerActive = isMobileViewport && mobileOpen;
  const mobileDrawerClosed = isMobileViewport && !mobileOpen;
  const pageInert = mobileDrawerActive || askAtlas.pageInert;
  const sidebarInert = mobileDrawerClosed || askAtlas.pageInert;
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useProfessionalMainScroll(mainRef, pathname, searchParams.toString());

  const closeMobileNavigation = useCallback(
    () => setMobileOpen(false),
    [setMobileOpen]
  );
  const committedExploreNavigation = useExploreCommittedNavigation();
  const shellSearchParams = searchParamsWithCommittedExploreContext(
    pathname,
    searchParams,
    committedExploreNavigation
  );

  const shellHref = useCallback(
    (route: ResetRoute) =>
      uxResetShellHandoffHref(
        route.externalHref ?? route.href,
        pathname,
        shellSearchParams
      ),
    [pathname, shellSearchParams]
  );

  useEffect(() => {
    if (!isMobileViewport && mobileOpen) {
      setMobileOpen(false);
    }
  }, [isMobileViewport, mobileOpen, setMobileOpen]);

  useLayoutEffect(() => {
    if (!(mobileOpen && isMobileViewport)) {
      return;
    }

    sidebarRef.current
      ?.querySelector<HTMLElement>(".app-mobile-nav-close")
      ?.focus({ preventScroll: true });
  }, [isMobileViewport, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      const trigger = previousFocusRef.current;
      previousFocusRef.current = null;
      if (!(trigger instanceof HTMLElement) || !trigger.isConnected) {
        return;
      }
      // Closing makes the focused close control inert. Chromium can then move
      // focus to the body after this effect's first focus(), without focusin.
      return restoreMobileNavigationTrigger(trigger, sidebarRef.current);
    }
    if (!isMobileViewport) {
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const closeButton = sidebar.querySelector<HTMLElement>(
      ".app-mobile-nav-close"
    );
    if (!closeButton) return;

    // Chromium often moves focus to the body when the open trigger becomes
    // inert. That can happen after the first animation frames, and it does
    // not always emit focusin, so reclaim until focus is inside the drawer.
    let reclaiming = true;
    const focusCloseNavigationIfNeeded = () => {
      if (!reclaiming) return;
      const active = document.activeElement;
      if (active instanceof Node && sidebar.contains(active)) {
        return;
      }
      closeButton.focus({ preventScroll: true });
    };

    focusCloseNavigationIfNeeded();
    let frame = 0;
    const reclaimFocus = () => {
      if (!reclaiming) return;
      focusCloseNavigationIfNeeded();
      if (!reclaiming) return;
      frame = window.requestAnimationFrame(reclaimFocus);
    };
    frame = window.requestAnimationFrame(reclaimFocus);

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && sidebar.contains(target)) {
        return;
      }
      focusCloseNavigationIfNeeded();
    };

    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => [
      ...sidebar.querySelectorAll<HTMLElement>(focusableSelector),
    ];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements();
      const first = elements.at(0);
      const last = elements.at(-1);
      if (!(first && last)) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      reclaiming = false;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNavigation, isMobileViewport, mobileOpen]);

  const openMobileNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    previousFocusRef.current = event.currentTarget;
    event.currentTarget.blur();
  };
  const navigationToggleLabel = open ? "Hide navigation" : "Show navigation";

  return (
    <div className="app-shell ux-reset-pro-app">
      <Sidebar
        id="ux-reset-pro-navigation"
        ref={sidebarRef}
        aria-hidden={sidebarInert || undefined}
        aria-label="Professional workspace"
        aria-modal={mobileDrawerActive || undefined}
        className={
          mobileDrawerClosed ? "ux-reset-sidebar-mobile-closed" : undefined
        }
        inert={sidebarInert || undefined}
        role={mobileDrawerActive ? "dialog" : undefined}
      >
        <SidebarHeader>
          <Link
            href={shellHref(resetRouteById("overview"))}
            aria-label="One Health Atlas"
            className="ux-reset-pro-brand"
            onClick={closeMobileNavigation}
          >
            <BrandMark size={28} />
            <b>One Health Atlas</b>
          </Link>
          <SidebarTrigger
            aria-label={navigationToggleLabel}
            className="app-sidebar-toggle"
            size="icon-sm"
            tooltip={navigationToggleLabel}
            variant="outline"
          >
            <PanelLeftClose className="app-sidebar-expanded-icon" />
            <PanelLeftOpen className="app-sidebar-collapsed-icon" />
          </SidebarTrigger>
          <SidebarTrigger
            aria-label="Close navigation"
            className="app-mobile-nav-close"
            mobile
            mobileAction="close"
            size="icon-sm"
            variant="outline"
          >
            <X />
          </SidebarTrigger>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Professional workspace">
            <SidebarGroup>
              <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
              <SidebarMenu>
                {RESET_WORKSPACE_NAV.map((item) => {
                  const Icon = item.icon;
                  const current = isResetRouteActive(item, pathname);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        active={current}
                        aria-current={current ? "page" : undefined}
                        aria-label={item.label}
                        href={shellHref(item)}
                        onClick={closeMobileNavigation}
                        tooltip={item.label}
                      >
                        <Icon aria-hidden="true" />
                        <span className="sidebar-item-label">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>MORE</SidebarGroupLabel>
              <SidebarMenu>
                {RESET_ACCESS_NAV.map((item) => {
                  const Icon = item.icon;
                  const current = isResetRouteActive(item, pathname);
                  const opensDocsTab = Boolean(item.externalHref);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        active={current}
                        aria-current={current ? "page" : undefined}
                        aria-label={
                          opensDocsTab
                            ? `${item.label}, opens in a new tab`
                            : item.label
                        }
                        href={shellHref(item)}
                        onClick={closeMobileNavigation}
                        rel={opensDocsTab ? "noopener noreferrer" : undefined}
                        target={opensDocsTab ? "_blank" : undefined}
                        tooltip={item.label}
                      >
                        <Icon aria-hidden="true" />
                        <span className="sidebar-item-label">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </nav>
        </SidebarContent>
      </Sidebar>
      {mobileDrawerActive ? (
        <button
          aria-label="Dismiss navigation"
          className="app-sidebar-scrim"
          onClick={closeMobileNavigation}
          type="button"
        />
      ) : null}
      <SidebarInset
        aria-hidden={pageInert || undefined}
        className="app-inset"
        inert={pageInert || undefined}
      >
        <header className="app-header">
          <SidebarTrigger
            aria-controls="ux-reset-pro-navigation"
            aria-expanded={mobileDrawerActive}
            aria-label="Open navigation"
            className="app-mobile-nav-trigger"
            mobile
            mobileAction="open"
            onClick={openMobileNavigation}
            size="icon"
            variant="outline"
          >
            <Menu />
          </SidebarTrigger>
          <span className="app-header-label">Professional workspace</span>
          {askAtlas.launcher}
        </header>
        <div className="ux-reset-workspace-body">
          <main ref={mainRef} className="app-content ux-reset-pro-main">
            {children}
          </main>
          {askAtlas.desktopPanel}
        </div>
        <ProfessionalTrustFooter />
      </SidebarInset>
      {askAtlas.compactModal}
    </div>
  );
}
