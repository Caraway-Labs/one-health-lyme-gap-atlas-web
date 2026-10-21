"use client";

import { useId, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CountySummarySurveillanceCard } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance-card";
import type { SurveillanceIntelligencePerspectiveId } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import { SurveillanceIntelligenceGuide } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-guide";
import { useCountySurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/use-county-surveillance-intelligence";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";

type OpenPerspective = {
  fips: string;
  id: SurveillanceIntelligencePerspectiveId | null;
};

/**
 * Browse County Summary Panel only. Compare and expanded evidence keep
 * their existing layouts.
 */
export function CountySummarySurveillance({
  fips,
  release,
}: {
  fips: string;
  release: Tier1ActiveRelease;
}) {
  const model = useCountySurveillanceIntelligence({ fips, release });
  const [openState, setOpenState] = useState<OpenPerspective>({
    fips,
    id: null,
  });
  if (openState.fips !== fips) {
    setOpenState({ fips, id: null });
  }
  const detailsId = useId();
  const openId = openState.fips === fips ? openState.id : null;
  const setOpen = (
    id: SurveillanceIntelligencePerspectiveId,
    open: boolean
  ) => {
    setOpenState((current) => {
      if (open) {
        return { fips, id };
      }
      if (current.id === id) {
        return { fips, id: null };
      }
      return current;
    });
  };
  return (
    <section
      aria-busy={model.perspectives.some(
        (perspective) => perspective.kind === "loading"
      )}
      aria-label="County Surveillance Intelligence"
      className="county-summary-surveillance"
      data-fips={fips}
      data-testid="county-surveillance-intelligence"
    >
      <h3 className="sr-only">County Surveillance Intelligence</h3>
      <p className="sr-only" aria-live="polite">
        {model.announcement}
      </p>
      <TooltipProvider delay={0}>
        <div
          className="county-summary-marks"
          data-testid="surveillance-intelligence-grid"
        >
          {model.perspectives.map((perspective) => (
            <CountySummarySurveillanceCard
              expanded={openId === perspective.id}
              headingId={`${detailsId}-${perspective.id}`}
              key={perspective.id}
              onOpenChange={(open) => {
                setOpen(perspective.id, open);
              }}
              onRetry={() => {
                model.retry(perspective.id);
              }}
              perspective={perspective}
            />
          ))}
        </div>
      </TooltipProvider>
      <SurveillanceIntelligenceGuide />
    </section>
  );
}
