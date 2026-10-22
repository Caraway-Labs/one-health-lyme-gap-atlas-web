"use client";

import { ArrowLeftRight } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CompareSlotMarker } from "@/features/ux-reset/compare/compare-county-picker";

/**
 * True once the element has scrolled out of view. Where the browser does not
 * support IntersectionObserver the element is treated as always in view.
 */
export function useScrolledOutOfView(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
): boolean {
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setOutOfView(entry ? !entry.isIntersecting : false);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setOutOfView(false);
    };
  }, [enabled, ref]);
  return enabled && outOfView;
}

/**
 * Slim pair summary that stays at the top of the scrolling area once the
 * pickers have scrolled away. The wrapper has no height, so showing or
 * hiding the bar never moves the page content.
 */
export function ComparePinnedPair({
  leftLabel,
  onEdit,
  onSwap,
  rightLabel,
  visible,
}: {
  leftLabel: string;
  onEdit: () => void;
  onSwap: () => void;
  rightLabel: string;
  visible: boolean;
}) {
  return (
    <div className="ux-reset-compare-pinned" data-testid="compare-pinned">
      {visible ? (
        <div
          aria-label="Counties being compared"
          className="ux-reset-compare-pinned-bar"
          role="group"
        >
          <span className="ux-reset-compare-pinned-county">
            <CompareSlotMarker letter="A" />
            <span>{leftLabel}</span>
          </span>
          <Button
            aria-label="Swap first and second county"
            size="icon-xs"
            type="button"
            variant="ghost"
            onClick={onSwap}
          >
            <ArrowLeftRight aria-hidden="true" />
          </Button>
          <span className="ux-reset-compare-pinned-county">
            <CompareSlotMarker letter="B" />
            <span>{rightLabel}</span>
          </span>
          <Button size="xs" type="button" variant="outline" onClick={onEdit}>
            Change counties
          </Button>
        </div>
      ) : null}
    </div>
  );
}
