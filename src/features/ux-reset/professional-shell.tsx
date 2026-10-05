"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
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
  LEGACY_ATLAS_PATH,
  RESET_ACCESS_NAV,
  RESET_WORKSPACE_NAV,
  RETURN_TO_LEGACY_ATLAS_LABEL,
  isResetRouteActive,
  resetRouteById,
  type ResetRoute,
} from "@/features/ux-reset/paths";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";

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
      previousFocusRef.current?.focus({ preventScroll: true });
      previousFocusRef.current = null;
      return;
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

    const workspaceNav = sidebar.querySelector<HTMLElement>(
      'nav[aria-label="Professional workspace"]'
    );

    const focusCloseNavigationIfNeeded = () => {
      const active = document.activeElement;
      if (active === closeButton) {
        return;
      }
      if (active instanceof HTMLElement && workspaceNav?.contains(active)) {
        return;
      }
      closeButton.focus({ preventScroll: true });
    };

    focusCloseNavigationIfNeeded();
    let followUpFrame = 0;
    const initialFrame = window.requestAnimationFrame(() => {
      focusCloseNavigationIfNeeded();
      followUpFrame = window.requestAnimationFrame(
        focusCloseNavigationIfNeeded
      );
    });

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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(followUpFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileNavigation, isMobileViewport, mobileOpen]);

  const openMobileNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    previousFocusRef.current = event.currentTarget;
    event.currentTarget.blur();
  };

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
            aria-label="Atlas professional workspace"
            onClick={closeMobileNavigation}
          >
            <span aria-hidden="true">+</span>
            <b>Atlas professional workspace</b>
          </Link>
          <SidebarTrigger
            aria-label={open ? "Collapse navigation" : "Expand navigation"}
            className="app-sidebar-toggle"
            size="icon-sm"
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
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
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
              <SidebarGroupLabel>Access</SidebarGroupLabel>
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
            <SidebarGroup>
              <SidebarGroupLabel>Legacy Atlas</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    aria-label={RETURN_TO_LEGACY_ATLAS_LABEL}
                    href={LEGACY_ATLAS_PATH}
                    onClick={closeMobileNavigation}
                    tooltip={RETURN_TO_LEGACY_ATLAS_LABEL}
                  >
                    <span className="sidebar-item-label">
                      {RETURN_TO_LEGACY_ATLAS_LABEL}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
          <Badge variant="outline">UX Reset</Badge>
          {askAtlas.launcher}
          <Link className="ux-reset-legacy-link" href={LEGACY_ATLAS_PATH}>
            {RETURN_TO_LEGACY_ATLAS_LABEL}
          </Link>
        </header>
        <div className="ux-reset-workspace-body">
          <main className="app-content ux-reset-pro-main">{children}</main>
          {askAtlas.desktopPanel}
        </div>
      </SidebarInset>
      {askAtlas.compactModal}
    </div>
  );
}
