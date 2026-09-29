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
import {
  PEOPLE_CLINICIANS_PATH,
  PEOPLE_EDUCATION_PATH,
  PEOPLE_HOME,
  PEOPLE_OUTREACH_PREVIEW_PATH,
  PEOPLE_PRO_NAV,
  PEOPLE_WORKSPACE_PATH,
  RETURN_TO_PEOPLE_ENV_LABEL,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import { isPrototypeRouteActive } from "@/features/ux-lab/public-site-pro-app/paths";

function workspaceIcon(id: (typeof PEOPLE_PRO_NAV)[number]["id"]) {
  switch (id) {
    case "evidence": {
      return Search;
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

export function PeoplePlusProfessionalShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen storageKey="ux-lab-people-plus-pro-sidebar">
      <PeoplePlusProfessionalFrame>{children}</PeoplePlusProfessionalFrame>
    </SidebarProvider>
  );
}

function PeoplePlusProfessionalFrame({ children }: { children: ReactNode }) {
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
    <div className="app-shell ux-lab-pro-app people-plus-pro-app">
      <Sidebar
        id="people-plus-pro-navigation"
        ref={sidebarRef}
        aria-label="Atlas for Public Health workspace"
        aria-modal={mobileOpen || undefined}
        role={mobileOpen ? "dialog" : undefined}
      >
        <SidebarHeader>
          <Link
            href={PEOPLE_WORKSPACE_PATH}
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
          <nav aria-label="Professional workspace">
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                {PEOPLE_PRO_NAV.map((item) => {
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
              <SidebarGroupLabel>Reviewed handoff</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PEOPLE_OUTREACH_PREVIEW_PATH}
                    onClick={closeMobileNavigation}
                  >
                    <ClipboardList aria-hidden="true" />
                    <span className="sidebar-item-label">
                      Outreach resource preview
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Leave this workspace</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PEOPLE_HOME}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      {RETURN_TO_PEOPLE_ENV_LABEL}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PEOPLE_EDUCATION_PATH}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      People-first education
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    href={PEOPLE_CLINICIANS_PATH}
                    onClick={closeMobileNavigation}
                  >
                    <span className="sidebar-item-label">
                      Clinician resources (public shell)
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
            aria-controls="people-plus-pro-navigation"
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
          <Badge variant="outline">Denser Atlas shell</Badge>
          <Link className="ux-lab-pro-return" href={PEOPLE_HOME}>
            {RETURN_TO_PEOPLE_ENV_LABEL}
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
