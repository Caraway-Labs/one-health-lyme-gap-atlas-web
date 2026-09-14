"use client";

import {
  ExternalLink,
  Maximize2,
  Menu,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DataDictionaryDialog } from "@/components/data-dictionary-dialog";
import { SiteFooter } from "@/components/site-footer";
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
import { getDocsUrl } from "@/lib/docs-config";
import {
  NAVIGATION_GROUPS,
  NAVIGATION_STATUS_LABELS,
  UTILITY_NAVIGATION_ITEMS,
  isNavigationItemActive,
  navigationItemsForGroup,
} from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [focusMode, setFocusMode] = useState(false);
  const supportsFocusMode = pathname === "/geographic_explorer";
  const focusModeActive = focusMode && supportsFocusMode;

  return (
    <SidebarProvider
      defaultOpen
      forceCollapsed={focusModeActive}
      storageKey="atlas-sidebar-open"
    >
      <AppShellContent
        focusModeActive={focusModeActive}
        onFocusModeChange={setFocusMode}
        supportsFocusMode={supportsFocusMode}
      >
        {children}
      </AppShellContent>
    </SidebarProvider>
  );
}

function AppShellContent({
  children,
  focusModeActive,
  onFocusModeChange,
  supportsFocusMode,
}: {
  children: React.ReactNode;
  focusModeActive: boolean;
  onFocusModeChange: (active: boolean) => void;
  supportsFocusMode: boolean;
}) {
  const pathname = usePathname();
  const { mobileOpen, open, setMobileOpen } = useSidebar();
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const closeMobileNavigation = useCallback(
    () => setMobileOpen(false),
    [setMobileOpen]
  );
  const selectDestination = () => {
    closeMobileNavigation();
    onFocusModeChange(false);
  };

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
    const closeButton = sidebar.querySelector<HTMLElement>(
      ".app-mobile-nav-close"
    );
    closeButton?.focus();

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
      if (!first || !last) return;
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
    <div className={`app-shell ${focusModeActive ? "app-shell-focus" : ""}`}>
      <Sidebar
        id="atlas-primary-navigation"
        ref={sidebarRef}
        aria-label="Primary navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
      >
        <SidebarHeader className="app-brand">
          <Link
            href="/"
            aria-label="One Health Lyme Gap Atlas home"
            onClick={selectDestination}
          >
            <span aria-hidden="true">+</span>
            <b>One Health Lyme Gap Atlas</b>
          </Link>
          <SidebarTrigger
            aria-label={open ? "Collapse navigation" : "Expand navigation"}
            className="app-sidebar-toggle"
            size="icon-sm"
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
          >
            <X />
          </SidebarTrigger>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Primary navigation">
            {NAVIGATION_GROUPS.map((group) => {
              const items = navigationItemsForGroup(group.id);
              return items.length ? (
                <SidebarGroup key={group.id}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarMenu>
                    {items.map((item) => {
                      const Icon = item.icon;
                      if (!Icon) return null;
                      const active = isNavigationItemActive(item, pathname);
                      const statusLabel = NAVIGATION_STATUS_LABELS[item.status];
                      const accessibleLabel =
                        item.status === "inDevelopment"
                          ? `${item.label} — ${statusLabel}`
                          : item.label;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            active={active}
                            aria-current={active ? "page" : undefined}
                            aria-label={open ? undefined : accessibleLabel}
                            href={item.external ? getDocsUrl() : item.href}
                            onClick={
                              item.external ? undefined : selectDestination
                            }
                            rel={
                              item.external ? "noopener noreferrer" : undefined
                            }
                            target={item.external ? "_blank" : undefined}
                            tooltip={accessibleLabel}
                          >
                            <Icon aria-hidden="true" />
                            <span className="sidebar-item-label">
                              {item.label}
                            </span>
                            {item.status === "inDevelopment" ? (
                              <Badge
                                aria-hidden="true"
                                className="sidebar-status"
                                variant="secondary"
                              >
                                {statusLabel}
                              </Badge>
                            ) : null}
                            {item.external ? (
                              <ExternalLink
                                aria-hidden="true"
                                className="sidebar-external-icon"
                              />
                            ) : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              ) : null;
            })}
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
        inert={mobileOpen}
      >
        <header className="app-header">
          <SidebarTrigger
            aria-controls="atlas-primary-navigation"
            aria-expanded={mobileOpen}
            aria-label="Open navigation"
            className="app-mobile-nav-trigger"
            mobile
            mobileAction="open"
            onClick={openMobileNavigation}
            size="icon"
          >
            <Menu />
          </SidebarTrigger>
          <span className="app-header-label">Atlas workspace</span>
          <div className="app-header-actions">
            {supportsFocusMode ? (
              <ButtonFocusMode
                active={focusModeActive}
                onChange={onFocusModeChange}
              />
            ) : null}
            <DataDictionaryDialog />
            {UTILITY_NAVIGATION_ITEMS.map((item) => (
              <Link
                key={item.id}
                className="app-utility-link"
                href={item.href}
                title={item.description}
              >
                {item.icon ? <item.icon aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </header>
        <div className="app-content">{children}</div>
        <SiteFooter />
      </SidebarInset>
    </div>
  );
}

function ButtonFocusMode({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      aria-pressed={active}
      className="app-focus-toggle"
      onClick={() => onChange(!active)}
      type="button"
    >
      {active ? (
        <Minimize2 aria-hidden="true" />
      ) : (
        <Maximize2 aria-hidden="true" />
      )}
      {active ? "Exit focus" : "Focus workspace"}
    </button>
  );
}
