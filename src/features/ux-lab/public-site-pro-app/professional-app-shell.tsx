"use client";

import {
  ClipboardList,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
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
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import {
  PRO_APP_NAV,
  PRO_APP_PATH,
  PUBLIC_CLINICIANS_PATH,
  PUBLIC_EDUCATION_PATH,
  PUBLIC_SITE_HOME,
  RETURN_TO_PUBLIC_SITE_LABEL,
  isPrototypeRouteActive,
} from "@/features/ux-lab/public-site-pro-app/paths";

function workspaceIcon(id: (typeof PRO_APP_NAV)[number]["id"]) {
  switch (id) {
    case "evidence": {
      return Search;
    }
    case "investigation": {
      return ClipboardList;
    }
    case "overview": {
      return LayoutDashboard;
    }
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

export function ProfessionalAppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen storageKey="ux-lab-pro-app-sidebar">
      <ProfessionalAppFrame>{children}</ProfessionalAppFrame>
    </SidebarProvider>
  );
}

function ProfessionalAppFrame({ children }: { children: ReactNode }) {
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
    <div className="app-shell ux-lab-pro-app">
      <Sidebar
        id="ux-lab-pro-navigation"
        ref={sidebarRef}
        aria-label="Professional application"
        aria-modal={mobileOpen || undefined}
        role={mobileOpen ? "dialog" : undefined}
      >
        <SidebarHeader>
          <Link
            href={PRO_APP_PATH}
            aria-label="Atlas for Public Health workspace"
            onClick={closeMobileNavigation}
          >
            <span aria-hidden="true">+</span>
            <b>Atlas for Public Health</b>
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
          <nav aria-label="Professional application">
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                {PRO_APP_NAV.map((item) => {
                  const Icon = workspaceIcon(item.id);
                  const current = isPrototypeRouteActive(item, pathname);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        active={current}
                        aria-current={current ? "page" : undefined}
                        href={item.href}
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
              <SidebarGroupLabel>Leave this application</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PUBLIC_SITE_HOME}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      {RETURN_TO_PUBLIC_SITE_LABEL}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PUBLIC_EDUCATION_PATH}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      Education on the public site
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PUBLIC_CLINICIANS_PATH}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      Clinician resources on the public site
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
            aria-controls="ux-lab-pro-navigation"
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
          <span className="app-header-label">Professional application</span>
          <Badge variant="outline">Atlas for Public Health</Badge>
          <Link className="ux-lab-pro-return" href={PUBLIC_SITE_HOME}>
            {RETURN_TO_PUBLIC_SITE_LABEL}
          </Link>
        </header>
        <main className="app-content ux-lab-pro-main">{children}</main>
        <div className="ux-lab-pro-footer" role="contentinfo">
          <p>{UX_LAB_SAMPLE_NOTICE}</p>
        </div>
      </SidebarInset>
    </div>
  );
}
