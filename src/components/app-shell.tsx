"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  const pathname = usePathname();
  const enabled = process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true";
  return (
    <div className={`app-shell ${collapsed ? "app-shell-collapsed" : ""}`}>
      <aside
        className={`app-sidebar ${mobileOpen ? "app-sidebar-open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="app-brand">
          <Link href="/" aria-label="One Health Lyme Gap Atlas home">
            <span>+</span>
            <b>One Health Lyme Gap Atlas</b>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        <nav>
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
                      onClick={() => setMobileOpen(false)}
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
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="app-inset">
        <header className="app-header">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <span>Atlas</span>
          <div className="app-header-actions">
            <DataDictionaryDialog />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
