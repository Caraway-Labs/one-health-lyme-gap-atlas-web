"use client";

import { Map } from "lucide-react";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  EXPLORER_MAP_LOADING_ERROR_BODY,
  EXPLORER_MAP_LOADING_ERROR_TITLE,
  EXPLORER_MAP_LOADING_HEADLINE,
  EXPLORER_MAP_LOADING_SUPPORT,
  type ExplorerMapLoadView,
} from "@/features/ux-reset/review/explorer-map-loading";

type ExplorerMapLoadingOverlayProps = {
  motion?: "full" | "reduced";
  onRetry: () => void;
  view: ExplorerMapLoadView["overlay"];
};

export function ExplorerMapLoadingOverlay({
  motion = "full",
  onRetry,
  view,
}: ExplorerMapLoadingOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLElement | null>(null);
  const movedFocus = useRef(false);

  useEffect(() => {
    if (view === "hidden") {
      if (movedFocus.current) {
        surfaceRef.current?.querySelector<HTMLElement>("canvas")?.focus();
      }
      movedFocus.current = false;
      return;
    }
    const surface = overlayRef.current?.parentElement?.querySelector(
      ".explorer-map-surface"
    );
    if (surface instanceof HTMLElement) {
      surfaceRef.current = surface;
    }
    const active = document.activeElement;
    if (
      surface instanceof HTMLElement &&
      active instanceof HTMLElement &&
      surface.contains(active)
    ) {
      overlayRef.current?.focus();
      movedFocus.current = true;
    }
  }, [view]);

  if (view === "hidden") {
    return null;
  }
  if (view === "error") {
    return (
      <div
        className="explorer-map-loading-overlay"
        data-testid="explorer-map-loading-error"
        ref={overlayRef}
        role="alert"
        tabIndex={-1}
      >
        <div className="explorer-map-loading-copy">
          <p className="explorer-map-loading-headline">
            {EXPLORER_MAP_LOADING_ERROR_TITLE}
          </p>
          <p className="explorer-map-loading-support">
            {EXPLORER_MAP_LOADING_ERROR_BODY}
          </p>
          <Button
            className="explorer-map-loading-retry"
            type="button"
            variant="secondary"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="explorer-map-loading-overlay"
      data-motion={motion}
      data-testid="explorer-map-loading"
      ref={overlayRef}
      role="status"
      tabIndex={-1}
    >
      <div className="explorer-map-loading-copy">
        <UnfoldingMapIcon />
        <p className="explorer-map-loading-headline">
          {EXPLORER_MAP_LOADING_HEADLINE}
        </p>
        <p className="explorer-map-loading-support">
          {EXPLORER_MAP_LOADING_SUPPORT}
        </p>
        <div aria-hidden="true" className="explorer-map-loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function UnfoldingMapIcon() {
  return (
    <div aria-hidden="true" className="explorer-map-loading-icon-slot">
      <div className="explorer-map-loading-icon-wrap">
        <Map className="explorer-map-loading-icon" strokeWidth={1.25} />
      </div>
    </div>
  );
}

export function ExplorerMapSurface({
  blockMap,
  children,
  onPaintSettled,
  revision,
  surfaceRef,
}: {
  blockMap: boolean;
  children: ReactNode;
  onPaintSettled: (revision: string) => void;
  revision: string | null;
  surfaceRef?: RefObject<HTMLDivElement | null>;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = surfaceRef ?? localRef;

  useEffect(() => {
    const node = ref.current;
    if (!revision || !node) {
      return;
    }
    let cancelled = false;
    const settleStub = () => {
      if (cancelled || node.querySelector("canvas")) {
        return;
      }
      if (node.querySelector("[data-testid='mock-atlas-map']")) {
        onPaintSettled(revision);
      }
    };
    settleStub();
    const observer = new MutationObserver(settleStub);
    observer.observe(node, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [onPaintSettled, ref, revision]);

  return (
    <div
      className="explorer-map-surface"
      inert={blockMap ? true : undefined}
      ref={ref}
    >
      {children}
    </div>
  );
}
