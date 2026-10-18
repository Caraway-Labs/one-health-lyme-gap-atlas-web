"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { MouseEvent, ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
  ResetFeedbackProvider,
  ResetFeedbackTrigger,
} from "@/features/ux-reset/feedback/reset-feedback-dialog";
import {
  escapeStillClosingNavigation,
  trustedMobileTriggerRestoreShouldStop,
} from "@/features/ux-reset/mobile-trigger-restore";
import {
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
  isResetRouteActive,
  resetRouteById,
  type ResetRoute,
} from "@/features/ux-reset/paths";
import { useProfessionalMainScroll } from "@/features/ux-reset/professional-main-scroll";
import { insetShouldScrollWithRoute } from "@/features/ux-reset/professional-shell-chrome";
import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";
import { WorkspaceAccountMenu } from "@/features/ux-reset/workspace-account-menu";
import { workspaceHeaderTitle } from "@/features/ux-reset/workspace-header-title";
import {
  subscribeWorkspaceRestore,
  workspaceRestoreConcealed,
} from "@/features/ux-reset/workspace-sign-out";

const MOBILE_TRIGGER_RESTORE_FRAMES = 90;
const MOBILE_TRIGGER_RESTORE_MS = 1000;

function portaledMenuElement(): HTMLElement | null {
  const menus = document.querySelectorAll(
    "[data-slot='dropdown-menu-content']"
  );
  for (const menu of menus) {
    if (!(menu instanceof HTMLElement)) {
      continue;
    }
    if (Object.hasOwn(menu.dataset, "closed") || menu.hidden) {
      continue;
    }
    return menu;
  }
  return null;
}

function portaledMenuOwnsFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) {
    return false;
  }
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest("[data-slot='dropdown-menu-content']"));
}

function restoreMobileNavigationTrigger(trigger: HTMLElement): () => void {
  let frame = 0;
  let frames = 0;
  let restoring = true;
  // Captured before focus(), so a keydown redispatched onto the trigger
  // still counts as the press that closed the drawer.
  const startedAt = performance.now();
  const restore = () => {
    if (!restoring || !trigger.isConnected) {
      restoring = false;
      return;
    }
    // Inert removal can leave focus on the body after the drawer closes.
    // Keep the trigger focused through that window. Tab, Shift+Tab, and
    // Escape end that window even when they start on the trigger. Enter,
    // Space, and a pointer on the trigger can reopen the drawer.
    if (document.activeElement !== trigger) {
      trigger.focus({ preventScroll: true });
    }
    frames += 1;
    const withinBudget =
      frames < MOBILE_TRIGGER_RESTORE_FRAMES &&
      performance.now() - startedAt < MOBILE_TRIGGER_RESTORE_MS;
    if (restoring && withinBudget) {
      frame = window.requestAnimationFrame(restore);
    }
  };
  const stopForUserAction = (event: Event) => {
    if (escapeStillClosingNavigation(event, startedAt)) {
      return;
    }
    if (trustedMobileTriggerRestoreShouldStop(event, trigger)) {
      restoring = false;
    }
  };
  restore();
  const timers = [100, 250, 500, MOBILE_TRIGGER_RESTORE_MS].map((delay) =>
    window.setTimeout(restore, delay)
  );
  document.addEventListener("keydown", stopForUserAction, true);
  document.addEventListener("pointerdown", stopForUserAction, true);
  return () => {
    restoring = false;
    window.cancelAnimationFrame(frame);
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    document.removeEventListener("keydown", stopForUserAction, true);
    document.removeEventListener("pointerdown", stopForUserAction, true);
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
          <ResetFeedbackProvider>
            <ResetProfessionalFrame>{children}</ResetProfessionalFrame>
          </ResetFeedbackProvider>
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
  const restoreConcealed = useSyncExternalStore(
    subscribeWorkspaceRestore,
    workspaceRestoreConcealed,
    () => false
  );
  const mobileDrawerActive = isMobileViewport && mobileOpen;
  const mobileDrawerClosed = isMobileViewport && !mobileOpen;
  const pageInert = mobileDrawerActive;
  const sidebarInert = mobileDrawerClosed;
  const sidebarRef = useRef<HTMLElement>(null);
  const insetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useProfessionalMainScroll(scrollRef, pathname, searchParams.toString());

  useLayoutEffect(() => {
    const inset = insetRef.current;
    if (!inset) {
      return;
    }
    const apply = () => {
      const header = inset.querySelector<HTMLElement>(":scope > .app-header");
      const scrollsWithRoute = insetShouldScrollWithRoute(
        header?.offsetHeight ?? 0,
        inset.clientHeight
      );
      if (scrollsWithRoute) {
        inset.dataset.chromeOverflow = "true";
      } else {
        delete inset.dataset.chromeOverflow;
      }
    };
    apply();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(apply);
    observer.observe(inset);
    const header = inset.querySelector<HTMLElement>(":scope > .app-header");
    if (header) {
      observer.observe(header);
    }
    return () => {
      observer.disconnect();
      delete inset.dataset.chromeOverflow;
    };
  }, []);

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
      return restoreMobileNavigationTrigger(trigger);
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
      // The account menu is portaled, so its focus is outside the drawer node.
      if (portaledMenuElement() || portaledMenuOwnsFocus(active)) {
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
      if (portaledMenuOwnsFocus(target)) {
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
        if (portaledMenuElement()) {
          return;
        }
        event.preventDefault();
        closeMobileNavigation();
        return;
      }
      if (portaledMenuElement()) {
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
    <div
      className="app-shell ux-reset-pro-app"
      hidden={restoreConcealed || undefined}
      inert={restoreConcealed || undefined}
    >
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
            href={shellHref(resetRouteById("explorer"))}
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
                <ResetFeedbackTrigger
                  onActivate={() => {
                    if (isMobileViewport) setMobileOpen(false);
                  }}
                />
              </SidebarMenu>
            </SidebarGroup>
          </nav>
        </SidebarContent>
        <SidebarFooter>
          <WorkspaceAccountMenu />
        </SidebarFooter>
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
        ref={insetRef}
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
          <span className="app-header-label">
            {workspaceHeaderTitle(pathname, searchParams.toString())}
          </span>
          {askAtlas.launcher}
        </header>
        <div className="ux-reset-workspace-body">
          <div ref={scrollRef} className="ux-reset-pro-scroll">
            <main className="app-content ux-reset-pro-main">{children}</main>
            <ProfessionalTrustFooter />
          </div>
        </div>
      </SidebarInset>
    </div>
  );
}
