"use client";

import { Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EXPLORER_MAP_SECTION_HEADING } from "@/features/ux-reset/page-introduction-copy";

type ExplorerMapSectionHeaderProps = {
  fitLabel: string;
  fitPlaceName: string;
  fitTestId?: string;
  onFit: () => void;
};

export function explorerFitAccessibleName(
  fitLabel: string,
  fitPlaceName: string
): string {
  return `${fitLabel} (${fitPlaceName})`;
}

export function ExplorerMapSectionHeader({
  fitLabel,
  fitPlaceName,
  fitTestId,
  onFit,
}: ExplorerMapSectionHeaderProps) {
  return (
    <div className="ux-reset-explorer-map-heading">
      <h2>{EXPLORER_MAP_SECTION_HEADING}</h2>
      <Button
        aria-label={explorerFitAccessibleName(fitLabel, fitPlaceName)}
        data-testid={fitTestId}
        size="sm"
        type="button"
        variant="secondary"
        onClick={onFit}
      >
        <Scan aria-hidden="true" data-icon="inline-start" />
        {fitLabel}
      </Button>
    </div>
  );
}

export function explorerMapSourceCaption(
  period: string | null | undefined,
  releaseId: string | null | undefined
): string | null {
  const periodText = period?.trim() ? `Period ${period.trim()}` : "";
  const release = releaseId?.trim() ?? "";
  if (periodText && release) {
    return `${periodText} · Release ${release}`;
  }
  if (periodText) {
    return periodText;
  }
  if (release) {
    return `Release ${release}`;
  }
  return null;
}

export function ExplorerMapSourceCaption({
  period,
  releaseId,
}: {
  period?: string | null;
  releaseId?: string | null;
}) {
  const caption = explorerMapSourceCaption(period, releaseId);
  if (!caption) {
    return null;
  }
  return (
    <p
      className="ux-reset-explorer-map-provenance"
      data-testid="explorer-map-provenance"
    >
      {caption}
    </p>
  );
}
