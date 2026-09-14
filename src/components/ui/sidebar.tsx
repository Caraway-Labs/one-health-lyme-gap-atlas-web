"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  forceCollapsed: boolean;
  mobileOpen: boolean;
  open: boolean;
  setMobileOpen: (open: boolean) => void;
  setOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context)
    throw new Error("useSidebar must be used within SidebarProvider.");
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
  forceCollapsed = false,
  storageKey = "atlas-sidebar-open",
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  forceCollapsed?: boolean;
  storageKey?: string;
}) {
  const [userOpen, setUserOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "true" || saved === "false") {
        // Hydrate the presentation preference from browser storage once.
        // eslint-disable-next-line react/set-state-in-effect
        setUserOpen(saved === "true");
      }
    } catch {
      // Browser storage may be disabled. The default remains usable.
    } finally {
      setStorageReady(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(storageKey, String(userOpen));
    } catch {
      // A storage failure must not prevent navigation.
    }
  }, [storageKey, storageReady, userOpen]);

  const setOpen = useCallback((open: boolean) => setUserOpen(open), []);
  const toggleSidebar = useCallback(() => setUserOpen((open) => !open), []);
  const toggleMobileSidebar = useCallback(
    () => setMobileOpen((open) => !open),
    []
  );
  const value = useMemo(
    () => ({
      forceCollapsed,
      mobileOpen,
      open: forceCollapsed ? false : userOpen,
      setMobileOpen,
      setOpen,
      toggleMobileSidebar,
      toggleSidebar,
    }),
    [
      forceCollapsed,
      mobileOpen,
      setOpen,
      toggleMobileSidebar,
      toggleSidebar,
      userOpen,
    ]
  );

  return (
    <SidebarContext.Provider value={value}>
      <div data-slot="sidebar-provider">{children}</div>
    </SidebarContext.Provider>
  );
}

export const Sidebar = forwardRef<HTMLElement, ComponentProps<"aside">>(
  ({ className, ...props }, ref) => {
    const { mobileOpen, open } = useSidebar();
    return (
      <aside
        ref={ref}
        data-collapsible={open ? undefined : "icon"}
        data-mobile-open={mobileOpen}
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        className={cn("atlas-sidebar", className)}
        {...props}
      />
    );
  }
);
Sidebar.displayName = "Sidebar";

export function SidebarInset({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sidebar-inset" className={cn(className)} {...props} />;
}

export function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-header" className={cn(className)} {...props} />
  );
}

export function SidebarContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-content" className={cn(className)} {...props} />
  );
}

export function SidebarGroup({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section data-slot="sidebar-group" className={cn(className)} {...props} />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: ComponentProps<"h2">) {
  return (
    // The primitive forwards children supplied by each concrete group.
    // eslint-disable-next-line jsx-a11y/heading-has-content
    <h2 data-slot="sidebar-group-label" className={cn(className)} {...props} />
  );
}

export function SidebarMenu({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn(className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: ComponentProps<"li">) {
  return (
    <li data-slot="sidebar-menu-item" className={cn(className)} {...props} />
  );
}

export function SidebarMenuButton({
  active,
  children,
  className,
  tooltip,
  ...props
}: ComponentProps<"a"> & { active?: boolean; tooltip?: string }) {
  const link = (
    <a
      data-active={active || undefined}
      data-slot="sidebar-menu-button"
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
  if (!tooltip) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarTrigger({
  mobile = false,
  mobileAction = "toggle",
  onClick,
  ...props
}: ComponentProps<typeof Button> & {
  mobile?: boolean;
  mobileAction?: "toggle" | "open" | "close";
}) {
  const { setMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();
  return (
    <Button
      data-slot="sidebar-trigger"
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!mobile) {
          toggleSidebar();
          return;
        }
        if (mobileAction === "open") setMobileOpen(true);
        else if (mobileAction === "close") setMobileOpen(false);
        else toggleMobileSidebar();
      }}
    />
  );
}
