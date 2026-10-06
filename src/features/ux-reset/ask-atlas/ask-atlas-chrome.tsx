"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { EvidenceChatConversationContent } from "@/components/evidence-chat/evidence-chat-conversation-content";
import type { EvidenceChatConversationModel } from "@/components/evidence-chat/use-evidence-chat";
import { useEvidenceChat } from "@/components/evidence-chat/use-evidence-chat";
import { Button } from "@/components/ui/button";
import {
  AskAtlasInheritedContextProvider,
  useAskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { AskAtlasUnavailableNotice } from "@/features/ux-reset/ask-atlas/ask-atlas-unavailable";
import type {
  AskAtlasInheritedContext,
  AskAtlasSurface,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import { InheritedContextNotice } from "@/features/ux-reset/ask-atlas/inherited-context-notice";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import { uxResetDestinationFromPath } from "@/features/ux-reset/routes";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";
import {
  atlasAssistantWorkspaceHeadingId,
  isAtlasAssistantLiteratureEnabled,
} from "@/lib/assistant-entry-points";

const ASK_ATLAS_PANEL_ID = "ux-reset-ask-atlas";
const ASK_ATLAS_DISABLED_HEADING_ID = "ux-reset-ask-atlas-disabled-heading";
const ASK_ATLAS_FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export type AskAtlasChrome = {
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

function askAtlasSurfaceFromPath(pathname: string): AskAtlasSurface | null {
  const destination = uxResetDestinationFromPath(pathname);
  switch (destination) {
    case "action":
    case "compare":
    case "explore":
    case "investigate":
    case "review": {
      return destination;
    }
    case "assistant":
    case "feed":
    case "settings":
    case null: {
      return null;
    }
    default: {
      const exhaustive: never = destination;
      return exhaustive;
    }
  }
}

export function AskAtlasChromeProvider({ children }: { children: ReactNode }) {
  return (
    <AskAtlasInheritedContextProvider>
      <AskAtlasChromeSwitch>{children}</AskAtlasChromeSwitch>
    </AskAtlasInheritedContextProvider>
  );
}

function AskAtlasChromeSwitch({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = askAtlasSurfaceFromPath(pathname);
  if (!surface) {
    return (
      <AskAtlasChromeContext.Provider value={EMPTY_ASK_ATLAS_CHROME}>
        {children}
      </AskAtlasChromeContext.Provider>
    );
  }
  return <AskAtlasSurfaceChrome>{children}</AskAtlasSurfaceChrome>;
}

function AskAtlasSurfaceChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestsEnabled = isAtlasAssistantLiteratureEnabled();
  const model = useEvidenceChat({ mode: "drawer", requestsEnabled });
  const context = useAskAtlasInheritedContext();
  const workspaceHandoffHref = useCallback(
    (conversationId?: string) =>
      resetAskAtlasWorkspaceHref(pathname, searchParams, conversationId),
    [pathname, searchParams]
  );
  const compact = useMobileViewport();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (!openedRef.current) {
        return;
      }
      openedRef.current = false;
      const launcher = launcherRef.current;
      if (launcher?.isConnected) {
        launcher.focus({ preventScroll: true });
      }
      return;
    }
    openedRef.current = true;
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    panel.dataset.layout = compact ? "compact" : "desktop";
    panel
      .querySelector<HTMLElement>("[data-ask-atlas-close]")
      ?.focus({ preventScroll: true });
  }, [compact, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (!compact || event.key !== "Tab") {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(ASK_ATLAS_FOCUSABLE),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!(first && last)) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [compact, open]);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);
  const openPanel = useCallback(() => {
    setOpen(true);
  }, []);
  const chrome = useMemo<AskAtlasChrome>(() => {
    const panel = open ? (
      <AskAtlasPanel
        compact={compact}
        context={context}
        model={model}
        panelRef={panelRef}
        requestsEnabled={requestsEnabled}
        onClose={closePanel}
        workspaceHandoffHref={workspaceHandoffHref}
      />
    ) : null;
    return {
      compactModal: open && compact ? panel : null,
      desktopPanel: open && !compact ? panel : null,
      launcher: (
        <Button
          aria-controls={open ? ASK_ATLAS_PANEL_ID : undefined}
          aria-expanded={open}
          aria-haspopup={compact ? "dialog" : undefined}
          data-testid="ask-atlas-launcher"
          ref={launcherRef}
          size="sm"
          type="button"
          variant="outline"
          onClick={openPanel}
        >
          Ask Atlas
        </Button>
      ),
      pageInert: open && compact,
    };
  }, [
    closePanel,
    compact,
    context,
    model,
    open,
    openPanel,
    requestsEnabled,
    workspaceHandoffHref,
  ]);

  return (
    <AskAtlasChromeContext.Provider value={chrome}>
      {children}
    </AskAtlasChromeContext.Provider>
  );
}

function AskAtlasPanel({
  compact,
  context,
  model,
  onClose,
  panelRef,
  requestsEnabled,
  workspaceHandoffHref,
}: {
  compact: boolean;
  context: AskAtlasInheritedContext | null;
  model: EvidenceChatConversationModel;
  onClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  requestsEnabled: boolean;
  workspaceHandoffHref: (conversationId?: string) => string;
}) {
  const headingId = requestsEnabled
    ? atlasAssistantWorkspaceHeadingId("drawer")
    : ASK_ATLAS_DISABLED_HEADING_ID;
  return (
    <div
      aria-labelledby={headingId}
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
        <p className="ux-reset-ask-atlas-kicker">Ask Atlas</p>
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
        <InheritedContextNotice context={context} />
        {requestsEnabled ? (
          <div className="evidence-chat evidence-chat-drawer">
            <EvidenceChatConversationContent
              headingLevel={2}
              model={model}
              showCountyNotice={false}
              showStarterPrompts={false}
              showWorkspaceHandoff
              workspaceHandoffHref={workspaceHandoffHref}
            />
          </div>
        ) : (
          <AskAtlasUnavailableNotice
            headingId={ASK_ATLAS_DISABLED_HEADING_ID}
          />
        )}
      </div>
    </div>
  );
}
