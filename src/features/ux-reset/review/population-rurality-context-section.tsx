"use client";

import { RotateCcw, Users } from "lucide-react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import { ExplorerLoadingStatus } from "@/features/ux-reset/review/explorer-loading-status";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
import { ExplorerSectionHeading } from "@/features/ux-reset/review/explorer-section-heading";
import { POPULATION_RURALITY_MEASURES } from "@/features/ux-reset/review/population-rurality-context";
import {
  usePopulationRuralityContext,
  type PopulationRuralityMeasureView,
} from "@/features/ux-reset/review/use-population-rurality-context";

function measureClaim(measureId: string): string {
  return (
    POPULATION_RURALITY_MEASURES.find(
      (measure) => measure.measureId === measureId
    )?.claimLabel ?? measureId
  );
}

function PopulationRuralityMeasureBody({
  view,
}: {
  view: PopulationRuralityMeasureView;
}) {
  switch (view.status) {
    case "idle": {
      return null;
    }
    case "loading": {
      return (
        <ExplorerLoadingStatus>
          {`Loading ${measureClaim(view.measureId)}…`}
        </ExplorerLoadingStatus>
      );
    }
    case "error": {
      const handleRetry = () => {
        view.retry();
      };
      return (
        <AtlasStatusMessage tone="error">
          <p>{view.message}</p>
          <Button type="button" variant="secondary" onClick={handleRetry}>
            <RotateCcw aria-hidden="true" data-icon="inline-start" />
            {`Retry ${measureClaim(view.measureId)}`}
          </Button>
        </AtlasStatusMessage>
      );
    }
    case "absent": {
      if (view.selection) {
        return (
          <KnownEmptySelectionNotice
            omitCaveats
            selections={[view.selection]}
            testId={`population-known-empty-${view.measureId}`}
          />
        );
      }
      return (
        <AtlasStatusMessage tone="empty">
          {`No governed observation was returned for ${measureClaim(view.measureId)}.`}
        </AtlasStatusMessage>
      );
    }
    case "conflict": {
      return (
        <AtlasStatusMessage tone="error">
          {`${view.count} observations were returned for ${measureClaim(view.measureId)}. They were not combined.`}
        </AtlasStatusMessage>
      );
    }
    case "ready": {
      return (
        <EvidenceObject
          model={view.presentation.evidence}
          presentation="compact"
          showGovernedLimitations={false}
          showReason
        />
      );
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

function sectionStatus(input: {
  countyHold: string | null;
  enabled: boolean;
  fips: string | null;
  releaseId: string | null;
  releaseLoading: boolean;
}): string | null {
  if (!input.fips) {
    return (
      input.countyHold ??
      "Choose a county to load population and rurality context."
    );
  }
  if (input.releaseLoading && !input.releaseId) {
    return "Loading the release for population and rurality context…";
  }
  if (!input.releaseId) {
    return "No governed release is available, so population and rurality observations were not requested.";
  }
  if (!input.enabled) {
    return "Population and rurality observations were not requested for this county.";
  }
  return null;
}

export function PopulationRuralityContextSection({
  countyHold = null,
  countyHoldPending = false,
  fips,
  releaseId,
  releaseLoading,
}: {
  countyHold?: string | null;
  countyHoldPending?: boolean;
  fips: string | null;
  releaseId: string | null;
  releaseLoading: boolean;
}) {
  const context = usePopulationRuralityContext({ fips, releaseId });
  const status = sectionStatus({
    countyHold,
    enabled: context.enabled,
    fips,
    releaseId,
    releaseLoading,
  });
  const loadingCount = context.measures.filter(
    (measure) => measure.status === "loading"
  ).length;
  const readyCount = context.measures.filter(
    (measure) => measure.status === "ready"
  ).length;
  const absentCount = context.measures.filter(
    (measure) => measure.status === "absent"
  ).length;
  const failedCount = context.measures.filter(
    (measure) => measure.status === "error" || measure.status === "conflict"
  ).length;
  let liveText = status ?? "";
  if (!status && loadingCount > 0) {
    liveText = `Loading population and rurality context for county ${fips}.`;
  } else if (!status && failedCount > 0 && readyCount > 0) {
    liveText = `Population and rurality context is partial for county ${fips}.`;
  } else if (
    !status &&
    context.measures.length > 0 &&
    absentCount === context.measures.length
  ) {
    liveText = `Population and rurality context finished for county ${fips}. No governed observations were returned.`;
  } else if (!status && readyCount === context.measures.length) {
    liveText = `Population and rurality context loaded for county ${fips}.`;
  }
  return (
    <section
      aria-label="Population and rurality context"
      className="ux-reset-population-rurality"
      data-county={fips ?? ""}
      data-release={releaseId ?? ""}
      data-testid="explorer-population-rurality"
      id={EXPLORER_SECTION_IDS.populationRurality}
    >
      <ExplorerSectionHeading
        description="Rural-urban codes stay categories. Population is a count of people. Social vulnerability and the uninsured percentile stay on a 0 to 1 scale. The uninsured percentage is a percent of people."
        icon={Users}
        note="Context"
        title="Population & Rurality Context"
      />
      <p className="sr-only" role="status">
        {liveText}
      </p>
      {status ? (
        countyHoldPending || (releaseLoading && !releaseId) ? (
          <ExplorerLoadingStatus>{status}</ExplorerLoadingStatus>
        ) : (
          <AtlasStatusMessage tone="empty">{status}</AtlasStatusMessage>
        )
      ) : null}
      {context.enabled ? (
        <>
          {failedCount > 0 && readyCount > 0 ? (
            <AtlasStatusMessage tone="error">
              Some population and rurality measures did not load. Loaded
              measures stay visible.
            </AtlasStatusMessage>
          ) : null}
          <div className="ux-reset-population-rurality-measures">
            {context.measures.map((view) => (
              <article
                data-county={fips ?? ""}
                data-measure={view.measureId}
                data-status={view.status}
                data-testid={`population-rurality-measure-${view.measureId}`}
                key={view.measureId}
              >
                <PopulationRuralityMeasureBody view={view} />
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
