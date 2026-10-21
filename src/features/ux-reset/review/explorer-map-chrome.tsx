"use client";

import { Scan, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EXPLORER_MAP_SECTION_HEADING } from "@/features/ux-reset/page-introduction-copy";
import { ContiguousUsSilhouette } from "@/features/ux-reset/review/contiguous-us-silhouette";

export const EXPLORER_US_VIEW_LABEL = "US view";
export const EXPLORER_US_VIEW_TOOLTIP = "Return to the full US map";

type ExplorerMapSectionHeaderProps = {
  fitLabel: string;
  fitPlaceName: string;
  fitTestId?: string;
  onFit: () => void;
  onUsView: () => void;
  /** True when the map colors are browser scenario values, not published. */
  scenarioActive?: boolean;
  /** Short feedback on what the next map click does (national map). */
  stageHint?: string | null;
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
  scenarioActive = false,
  stageHint = null,
  usViewTestId = "explorer-us-view",
}: ExplorerMapSectionHeaderProps) {
  return (
    <div className="ux-reset-explorer-map-heading">
      <h2>{EXPLORER_MAP_SECTION_HEADING}</h2>
      {scenarioActive ? (
        <Badge
          className="ux-reset-explorer-map-scenario"
          data-testid="explorer-map-scenario-badge"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
          Scenario colors, not published
        </Badge>
      ) : null}
      {stageHint ? (
        <Badge
          className="ux-reset-explorer-map-stage-chip"
          data-testid="explorer-map-stage-chip"
          variant="secondary"
        >
          {stageHint}
        </Badge>
      ) : null}
      <div className="ux-reset-explorer-map-actions">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
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
