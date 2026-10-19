"use client";

import { Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EXPLORER_MAP_SECTION_HEADING } from "@/features/ux-reset/page-introduction-copy";

type ExplorerMapSectionHeaderProps = {
  fitAccessibleName: string;
  fitLabel: string;
  fitTestId?: string;
  onFit: () => void;
};

export function ExplorerMapSectionHeader({
  fitAccessibleName,
  fitLabel,
  fitTestId,
  onFit,
}: ExplorerMapSectionHeaderProps) {
  return (
    <div className="ux-reset-explorer-map-heading">
      <h2>{EXPLORER_MAP_SECTION_HEADING}</h2>
      <Button
        aria-label={fitAccessibleName}
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
): string {
  const periodText = period?.trim()
    ? `Period ${period.trim()}`
    : "Source periods vary by evidence";
  const release = releaseId?.trim() ?? "";
  if (!release) {
    return periodText;
  }
  return `${periodText} · Release ${release}`;
}

export function ExplorerMapSourceCaption({
  period,
  releaseId,
}: {
  period?: string | null;
  releaseId?: string | null;
}) {
  return (
    <p
      className="ux-reset-explorer-map-provenance"
      data-testid="explorer-map-provenance"
    >
      {explorerMapSourceCaption(period, releaseId)}
    </p>
  );
}
