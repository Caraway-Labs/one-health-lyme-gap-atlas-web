"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { DataDictionaryDialog } from "@/components/data-dictionary-dialog";
import { Button } from "@/components/ui/button";
import {
  NAVIGATION_GROUPS,
  isNavigationItemActive,
  navigationItemsForGroup,
} from "@/lib/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const enabled = process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true";

  const closeMobileNavigation = useCallback(() => setMobileOpen(false), []);
  const openMobileNavigation = () => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setMobileOpen(true);
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

  return (
    <div className={`app-shell ${collapsed ? "app-shell-collapsed" : ""}`}>
      <aside
        id="atlas-primary-navigation"
        ref={sidebarRef}
        className={`app-sidebar ${mobileOpen ? "app-sidebar-open" : ""}`}
        aria-label="Primary navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
      >
        <div className="app-brand">
          <Link href="/" aria-label="One Health Lyme Gap Atlas home">
            <span>+</span>
            <b>One Health Lyme Gap Atlas</b>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="app-sidebar-toggle"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <Button
            className="app-mobile-nav-close"
            variant="ghost"
            size="icon-sm"
            aria-label="Close navigation"
            onClick={closeMobileNavigation}
          >
            <X />
          </Button>
        </div>
        <nav aria-label="Primary navigation">
          {NAVIGATION_GROUPS.map((group) => {
            const items = navigationItemsForGroup(group.id, enabled);
            return items.length ? (
              <section key={group.id}>
                <h2>{group.label}</h2>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavigationItemActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      onClick={closeMobileNavigation}
                    >
                      <Icon aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </section>
            ) : null;
          })}
        </nav>
      </aside>
      {mobileOpen && (
        <button
          className="app-sidebar-scrim"
          aria-label="Dismiss navigation"
          onClick={closeMobileNavigation}
        />
      )}
      <div
        className="app-inset"
        aria-hidden={mobileOpen || undefined}
        inert={mobileOpen}
      >
        <header className="app-header">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            aria-controls="atlas-primary-navigation"
            aria-expanded={mobileOpen}
            onClick={openMobileNavigation}
          >
            <Menu />
          </Button>
          <span>Atlas</span>
          <div className="app-header-actions">
            <DataDictionaryDialog />
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
