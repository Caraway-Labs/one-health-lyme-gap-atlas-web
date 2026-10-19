"use client";

import Link from "next/link";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

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

export function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="sidebar-footer" className={cn(className)} {...props} />
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

/**
 * Title plus one sentence, matching the Data Provenance sidebar tooltip.
 * A string `tooltip` without `tooltipDetail` stays a single line.
 */
function withSidebarTooltip(
  trigger: ReactElement,
  tooltip?: string,
  tooltipDetail?: string
) {
  if (!tooltip) return trigger;
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent
        className={
          tooltipDetail ? "max-w-64 flex-col items-start text-left" : undefined
        }
        side="right"
      >
        {tooltipDetail ? (
          <>
            <span className="font-semibold">{tooltip}</span>
            <span>{tooltipDetail}</span>
          </>
        ) : (
          tooltip
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarMenuButton({
  active,
  children,
  className,
  href,
  tooltip,
  tooltipDetail,
  ...props
}: ComponentProps<"a"> & {
  active?: boolean;
  tooltip?: string;
  /**
   * Accessible description shown under the tooltip title.
   * The shared tooltip primitive stays the only tooltip.
   */
  tooltipDetail?: string;
}) {
  const shared = {
    "data-active": active || undefined,
    "data-slot": "sidebar-menu-button",
    className: cn(className),
    ...props,
    "aria-description": props["aria-description"] ?? tooltipDetail,
  };
  const link =
    typeof href === "string" ? (
      <Link href={href} {...shared}>
        {children}
      </Link>
    ) : (
      <a {...shared}>{children}</a>
    );
  return withSidebarTooltip(link, tooltip, tooltipDetail);
}

/** Sidebar row that runs an action instead of navigating. */
export function SidebarMenuAction({
  active,
  children,
  className,
  tooltip,
  tooltipDetail,
  type = "button",
  ...props
}: ComponentProps<typeof Button> & {
  active?: boolean;
  tooltip?: string;
  /** Accessible description shown under the tooltip title. */
  tooltipDetail?: string;
}) {
  const button = (
    <Button
      {...props}
      aria-description={props["aria-description"] ?? tooltipDetail}
      className={cn(
        "h-auto w-full cursor-pointer justify-start px-2 py-2 text-left font-[inherit] text-[0.8rem] whitespace-normal focus-visible:ring-0 active:translate-y-0",
        className
      )}
      data-active={active || undefined}
      data-slot="sidebar-menu-button"
      type={type}
      variant="ghost"
    >
      {children}
    </Button>
  );
  return withSidebarTooltip(button, tooltip, tooltipDetail);
}

export function SidebarTrigger({
  mobile = false,
  mobileAction = "toggle",
  onClick,
  tooltip,
  ...props
}: ComponentProps<typeof Button> & {
  mobile?: boolean;
  mobileAction?: "toggle" | "open" | "close";
  tooltip?: string;
}) {
  const { setMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();
  const button = (
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
  if (!tooltip) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
