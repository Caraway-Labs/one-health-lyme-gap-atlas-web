"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
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
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
  isResetRouteActive,
  resetRouteById,
  type ResetRoute,
} from "@/features/ux-reset/paths";
import { ProfessionalTrustFooter } from "@/features/ux-reset/professional-trust-footer";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";
import { WorkspaceAccountMenu } from "@/features/ux-reset/workspace-account-menu";

const MOBILE_TRIGGER_RESTORE_FRAMES = 12;

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

export function ResetProfessionalShell({ children }: { children: ReactNode }) {
  return (
    <ExploreCommittedNavigationProvider>
      <SidebarProvider defaultOpen storageKey="ux-reset-pro-sidebar">
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
  const previousFocusRef = useRef<HTMLElement | null>(null);

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
          <main className="app-content ux-reset-pro-main">{children}</main>
          {askAtlas.desktopPanel}
        </div>
        <ProfessionalTrustFooter />
      </SidebarInset>
      {askAtlas.compactModal}
    </div>
  );
}
