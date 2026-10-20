"use client";

import { useId, useState } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { SurveillanceIntelligenceCard } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-card";
import type { SurveillanceIntelligencePerspectiveId } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import { SurveillanceIntelligenceDetails } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-details";
import { SurveillanceIntelligenceGuide } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-guide";
import { useCountySurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/use-county-surveillance-intelligence";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";

type OpenPerspective = {
  fips: string;
  id: SurveillanceIntelligencePerspectiveId | null;
};

/**
 * Explorer layout only. Compare should import the card, details, guide,
 * hook, and mapping files without this grid.
 */
export function ExplorerSurveillanceIntelligence({
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
  const titleId = useId();
  const openId = openState.fips === fips ? openState.id : null;
  const openPerspective =
    model.perspectives.find((perspective) => perspective.id === openId) ?? null;
  const toggle = (id: SurveillanceIntelligencePerspectiveId) => {
    setOpenState((current) => ({
      fips,
      id: current.id === id ? null : id,
    }));
  };
  return (
    <section
      aria-busy={model.perspectives.some(
        (perspective) => perspective.kind === "loading"
      )}
      aria-labelledby={titleId}
      className="flex flex-col gap-3"
      data-fips={fips}
      data-testid="county-surveillance-intelligence"
    >
      <AtlasSectionHeader
        headingLevel="h2"
        title="County Surveillance Intelligence"
        titleId={titleId}
      />
      <p className="sr-only" aria-live="polite">
        {model.announcement}
      </p>
      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
        data-testid="surveillance-intelligence-grid"
      >
        {model.perspectives.map((perspective) => (
          <SurveillanceIntelligenceCard
            controlsId={detailsId}
            expanded={openId === perspective.id}
            headingId={`${detailsId}-${perspective.id}`}
            key={perspective.id}
            onRetry={() => {
              model.retry(perspective.id);
            }}
            onToggle={() => {
              toggle(perspective.id);
            }}
            perspective={perspective}
          />
        ))}
      </div>
      {openPerspective ? (
        <SurveillanceIntelligenceDetails
          id={detailsId}
          labelledBy={`${detailsId}-${openPerspective.id}`}
          onRetry={() => {
            model.retry(openPerspective.id);
          }}
          perspective={openPerspective}
        />
      ) : null}
      <SurveillanceIntelligenceGuide />
    </section>
  );
}
