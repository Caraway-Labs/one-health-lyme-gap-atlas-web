"use client";

import { usePathname } from "fumadocs-core/framework";
import Link from "fumadocs-core/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { useTreeContext } from "fumadocs-ui/contexts/tree";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { getLayoutTabs } from "fumadocs-ui/layouts/shared";
import { SidebarIcon } from "lucide-react";
import {
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { isDocsTabCurrent, PRODUCT_GUIDE_TAB } from "@/lib/docs-sidebar-tabs";
import { cn } from "@/lib/utils";

const TABLIST_LABEL = "Documentation sections";

export function developersLinkCurrent(pathname: string): "page" | undefined {
  const path = normalizedPath(pathname);
  if (path === "/docs/develop" || path.startsWith("/docs/develop/")) {
    return "page";
  }
  return undefined;
}

function normalizedPath(value: string): string {
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
}

/**
 * Site header link to the Developers section. Visible on every docs page,
 * including the 375px header where the sidebar is closed.
 */
export function DocsHeader(props: ComponentProps<"header">) {
  const pathname = usePathname();
  const { isNavTransparent, slots } = useDocsLayout();
  const current = developersLinkCurrent(pathname);
  const SearchTrigger = slots.searchTrigger ? slots.searchTrigger.sm : null;
  const SidebarTrigger = slots.sidebar?.trigger;
  const ThemeSwitch = slots.themeSwitch;

  return (
    <header
      data-transparent={isNavTransparent}
      {...props}
      className={cn(
        "bg-fd-background/80 sticky top-(--fd-docs-row-1) z-30 flex h-(--fd-header-height) items-center gap-2 border-b ps-4 pe-2.5 backdrop-blur-sm [grid-area:header]",
        props.className
      )}
      id="nd-subnav"
    >
      {slots.navTitle ? (
        <slots.navTitle className="inline-flex max-w-[46%] min-w-0 items-center gap-2.5 font-semibold md:hidden [&_.atlas-docs-brand]:min-w-0 [&_.atlas-docs-brand>span]:truncate" />
      ) : null}
      <nav aria-label="Documentation" className="flex min-w-0 items-center">
        <Link
          aria-current={current}
          className="text-fd-secondary-foreground rounded-md px-2 py-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          href="/docs/develop"
        >
          Developers
        </Link>
      </nav>
      <div className="ms-auto flex items-center gap-1">
        {ThemeSwitch ? <ThemeSwitch /> : null}
        {SearchTrigger ? (
          <SearchTrigger className="p-2 md:hidden" hideIfDisabled />
        ) : null}
        {SidebarTrigger ? (
          <SidebarTrigger
            className={cn(
              buttonVariants({
                className: "p-2 md:hidden",
                color: "ghost",
                size: "icon-sm",
              })
            )}
          >
            <SidebarIcon aria-hidden="true" className="size-4" />
          </SidebarTrigger>
        ) : null}
      </div>
    </header>
  );
}

function tabTitle(title: ReactNode): string {
  return typeof title === "string" ? title : "Section";
}

/**
 * Sidebar section switcher. Fumadocs `DocsLayout` tabs render a dropdown
 * without a tablist; this control uses the same root-folder tabs and exposes
 * them as a labelled tablist.
 */
export function DocsSidebarTabs() {
  const pathname = usePathname();
  const { full } = useTreeContext();
  const listRef = useRef<HTMLDivElement>(null);
  const tabs = getLayoutTabs(full).filter((tab) => tab.unlisted !== true);
  const activeIndex = tabs.findIndex((tab) =>
    isDocsTabCurrent(tab.$folder, pathname)
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = listRef.current;
    if (!list) return;
    const items = [...list.querySelectorAll<HTMLAnchorElement>('[role="tab"]')];
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (index === -1) return;

    if (event.key === " ") {
      event.preventDefault();
      items[index]?.click();
      return;
    }

    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  if (tabs.length === 0) return null;

  return (
    <div
      aria-label={TABLIST_LABEL}
      className="flex max-w-full flex-wrap gap-1"
      onKeyDown={onKeyDown}
      ref={listRef}
      role="tablist"
      tabIndex={-1}
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;
        return (
          <Link
            aria-current={selected ? "page" : undefined}
            aria-selected={selected}
            className="bg-fd-secondary text-fd-secondary-foreground aria-selected:bg-fd-accent aria-selected:text-fd-accent-foreground rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 aria-selected:font-semibold"
            href={tab.url}
            key={tab.url}
            role="tab"
            tabIndex={selected || (activeIndex === -1 && index === 0) ? 0 : -1}
          >
            {tabTitle(tab.title)}
          </Link>
        );
      })}
    </div>
  );
}

/** One-click Quickstart from the Product guide sidebar, including the docs home. */
export function DocsHomeQuickstart() {
  const pathname = usePathname();
  const { full } = useTreeContext();
  const product = getLayoutTabs(full).find(
    (tab) => tab.title === PRODUCT_GUIDE_TAB
  );
  if (!product || !isDocsTabCurrent(product.$folder, pathname)) return null;

  return (
    <Link
      className="text-fd-secondary-foreground mt-2 inline-flex rounded-md px-2.5 py-1.5 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      href="/docs/develop/quickstart"
    >
      Quickstart
    </Link>
  );
}
