"use client";

import { Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EXPLORER_MAP_SECTION_HEADING } from "@/features/ux-reset/page-introduction-copy";
import { ContiguousUsSilhouette } from "@/features/ux-reset/review/contiguous-us-silhouette";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

export const EXPLORER_US_VIEW_LABEL = "US view";
export const EXPLORER_US_VIEW_TOOLTIP = "Return to the full US map";

type ExplorerMapSectionHeaderProps = {
  fitLabel: string;
  fitPlaceName: string;
  fitTestId?: string;
  onFit: () => void;
  onUsView: () => void;
  usViewTestId?: string;
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
  onUsView,
  usViewTestId = "explorer-us-view",
}: ExplorerMapSectionHeaderProps) {
  return (
    <div className="ux-reset-explorer-map-heading">
      <h2>{EXPLORER_MAP_SECTION_HEADING}</h2>
      <div className="ux-reset-explorer-map-actions">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  {...analyticsControlAttributes("explorer_us_view")}
                  aria-label={EXPLORER_US_VIEW_LABEL}
                  data-testid={usViewTestId}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={onUsView}
                />
              }
            >
              <ContiguousUsSilhouette />
              {EXPLORER_US_VIEW_LABEL}
            </TooltipTrigger>
            <TooltipContent>{EXPLORER_US_VIEW_TOOLTIP}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          {...analyticsControlAttributes("explorer_fit_map")}
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
