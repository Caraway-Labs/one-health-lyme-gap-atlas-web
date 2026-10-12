"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { uxResetDestinationFromPath } from "@/features/ux-reset/routes";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";

const ASK_ATLAS_PANEL_ID = "ux-reset-ask-atlas";

type AskAtlasChrome = {
  compactModal: ReactNode;
  desktopPanel: ReactNode;
  launcher: ReactNode;
  pageInert: boolean;
};

const EMPTY_ASK_ATLAS_CHROME: AskAtlasChrome = {
  compactModal: null,
  desktopPanel: null,
  launcher: null,
  pageInert: false,
};

const AskAtlasChromeContext = createContext<AskAtlasChrome>(
  EMPTY_ASK_ATLAS_CHROME
);

export function useAskAtlasChrome(): AskAtlasChrome {
  return useContext(AskAtlasChromeContext);
}

function surfaceAcceptsAskAtlas(pathname: string): boolean {
  const destination = uxResetDestinationFromPath(pathname);
  switch (destination) {
    case "action":
    case "compare":
    case "explore":
    case "investigate":
    case "review": {
      return true;
    }
    case "assistant":
    case "feed":
    case "settings":
    case null: {
      return false;
    }
    default: {
      const exhaustive: never = destination;
      return exhaustive;
    }
  }
}

function SubstitutePanel({
  compact,
  onClose,
  panelRef,
}: {
  compact: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-labelledby="ux-reset-ask-atlas-substitute-heading"
      aria-modal={compact ? true : undefined}
      className={
        compact ? "ux-reset-ask-atlas-modal" : "ux-reset-ask-atlas-panel"
      }
      data-ask-atlas-layout={compact ? "compact" : "desktop"}
      data-testid="ask-atlas-panel"
      id={ASK_ATLAS_PANEL_ID}
      ref={panelRef}
      role={compact ? "dialog" : "complementary"}
    >
      <div className="ux-reset-ask-atlas-toolbar">
        <p
          className="ux-reset-ask-atlas-kicker"
          id="ux-reset-ask-atlas-substitute-heading"
        >
          Ask Atlas
        </p>
        <Button
          aria-label="Close Ask Atlas"
          data-ask-atlas-close=""
          data-testid="ask-atlas-close"
          size="sm"
          type="button"
          variant="outline"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      <div className="ux-reset-ask-atlas-body">
        <p>
          Synthetic Ask Atlas preview. This catalog does not send questions,
          load conversations, or call the assistant service.
        </p>
      </div>
    </div>
  );
}

function SubstituteSurface({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const enabled = surfaceAcceptsAskAtlas(pathname);
  const compact = useMobileViewport();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  if (!enabled && open) {
    setOpen(false);
  }
  const visible = enabled && open;

  useEffect(() => {
    if (visible) {
      wasOpen.current = true;
      panelRef.current
        ?.querySelector<HTMLElement>("[data-ask-atlas-close]")
        ?.focus();
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    wasOpen.current = false;
    launcherRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);
  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);
  const chrome = useMemo<AskAtlasChrome>(() => {
    const panel = visible ? (
      <SubstitutePanel
        compact={compact}
        onClose={closePanel}
        panelRef={panelRef}
      />
    ) : null;
    if (!enabled) {
      return EMPTY_ASK_ATLAS_CHROME;
    }
    return {
      compactModal: compact ? panel : null,
      desktopPanel: compact ? null : panel,
      launcher: (
        <Button
          aria-controls={visible ? ASK_ATLAS_PANEL_ID : undefined}
          aria-expanded={visible}
          data-testid="ask-atlas-launcher"
          onClick={openPanel}
          ref={launcherRef}
          size="sm"
          type="button"
          variant="outline"
        >
          Ask Atlas
        </Button>
      ),
      pageInert: visible && compact,
    };
  }, [closePanel, compact, enabled, openPanel, visible]);

  return (
    <AskAtlasChromeContext.Provider value={chrome}>
      {children}
    </AskAtlasChromeContext.Provider>
  );
}

/** Catalog substitute. It does not mount the evidence-chat request hook. */
export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  return <SubstituteSurface>{children}</SubstituteSurface>;
}
