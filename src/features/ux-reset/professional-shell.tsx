"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

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
import {
  LEGACY_ATLAS_PATH,
  RESET_ACCESS_NAV,
  RESET_APP_PATH,
  RESET_WORKSPACE_NAV,
  RETURN_TO_LEGACY_ATLAS_LABEL,
  isResetRouteActive,
  resetNavigationHref,
} from "@/features/ux-reset/paths";

export function ResetProfessionalShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen storageKey="ux-reset-pro-sidebar">
      <ResetProfessionalFrame>{children}</ResetProfessionalFrame>
    </SidebarProvider>
  );
}

function ResetProfessionalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mobileOpen, open, setMobileOpen } = useSidebar();
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeMobileNavigation = useCallback(
    () => setMobileOpen(false),
    [setMobileOpen]
  );

  useEffect(() => {
    if (!mobileOpen) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => [
      ...sidebar.querySelectorAll<HTMLElement>(focusableSelector),
    ];
    sidebar.querySelector<HTMLElement>(".app-mobile-nav-close")?.focus();

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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeMobileNavigation, mobileOpen]);

  const openMobileNavigation = () => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };

  return (
    <div className="app-shell ux-reset-pro-app">
      <Sidebar
        id="ux-reset-pro-navigation"
        ref={sidebarRef}
        aria-label="Professional workspace"
        aria-modal={mobileOpen || undefined}
        role={mobileOpen ? "dialog" : undefined}
      >
        <SidebarHeader>
          <Link
            href={RESET_APP_PATH}
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
                        href={resetNavigationHref(item)}
                        onClick={closeMobileNavigation}
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
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        active={current}
                        aria-current={current ? "page" : undefined}
                        href={resetNavigationHref(item)}
                        onClick={closeMobileNavigation}
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
                    href={LEGACY_ATLAS_PATH}
                    onClick={closeMobileNavigation}
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
      {mobileOpen ? (
        <button
          aria-label="Dismiss navigation"
          className="app-sidebar-scrim"
          onClick={closeMobileNavigation}
          type="button"
        />
      ) : null}
      <SidebarInset
        aria-hidden={mobileOpen || undefined}
        className="app-inset"
        inert={mobileOpen || undefined}
      >
        <header className="app-header">
          <SidebarTrigger
            aria-controls="ux-reset-pro-navigation"
            aria-expanded={mobileOpen}
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
          <Link className="ux-reset-legacy-link" href={LEGACY_ATLAS_PATH}>
            {RETURN_TO_LEGACY_ATLAS_LABEL}
          </Link>
        </header>
        <main className="app-content ux-reset-pro-main">{children}</main>
      </SidebarInset>
    </div>
  );
}
