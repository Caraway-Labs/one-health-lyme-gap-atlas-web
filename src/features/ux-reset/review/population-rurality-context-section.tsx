"use client";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
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
        <AtlasStatusMessage tone="loading">
          {`Loading ${measureClaim(view.measureId)}…`}
        </AtlasStatusMessage>
      );
    }
    case "error": {
      const handleRetry = () => {
        view.retry();
      };
      return (
        <AtlasStatusMessage tone="error">
          <p>{view.message}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRetry}
          >{`Retry ${measureClaim(view.measureId)}`}</Button>
        </AtlasStatusMessage>
      );
    }
    case "absent": {
      return (
        <AtlasStatusMessage tone="empty">
          {`No governed observation was returned for ${measureClaim(view.measureId)}. That absence is not zero.`}
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
      const { presentation } = view;
      return (
        <>
          <EvidenceObject model={presentation.evidence} showReason />
          <dl className="ux-reset-population-rurality-meta">
            <div>
              <dt>Vintage</dt>
              <dd>{presentation.vintageLabel}</dd>
            </div>
            <div>
              <dt>Reference period</dt>
              <dd>{presentation.referencePeriod}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {presentation.sourceUrl ? (
                  <a
                    href={presentation.sourceUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {presentation.sourceLabel}
                  </a>
                ) : (
                  presentation.sourceLabel
                )}
              </dd>
            </div>
            <div>
              <dt>Source field</dt>
              <dd>{presentation.sourceField}</dd>
            </div>
            <div>
              <dt>Denominator</dt>
              <dd>{presentation.denominatorLabel}</dd>
            </div>
            <div>
              <dt>Definition</dt>
              <dd>{presentation.definition}</dd>
            </div>
            <div>
              <dt>Method version</dt>
              <dd>{presentation.methodVersion}</dd>
            </div>
            <div>
              <dt>Provenance reference</dt>
              <dd>{presentation.provenanceRef}</dd>
            </div>
            <div>
              <dt>Value state</dt>
              <dd>{presentation.valueStateLabel}</dd>
            </div>
          </dl>
        </>
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
  const failedCount = context.measures.filter(
    (measure) => measure.status === "error" || measure.status === "conflict"
  ).length;
  let liveText = status ?? "";
  if (!status && loadingCount > 0) {
    liveText = `Loading population and rurality context for county ${fips}.`;
  } else if (!status && failedCount > 0 && readyCount > 0) {
    liveText = `Population and rurality context is partial for county ${fips}. A failed measure is not zero.`;
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
      <AtlasSectionHeader
        description="Descriptive rurality, population, and socioeconomic context for this county. Human, vector, and pathogen surveillance stay the primary evidence. Rural-urban codes stay categories. Population is a count of people. Social vulnerability and the uninsured percentile stay on a 0 to 1 scale. The uninsured percentage is a percent of people. These values do not change the gap score and are not a disease predictor."
        eyebrow="Context"
        headingLevel="h2"
        title="Population & Rurality Context"
      />
      <p className="sr-only" role="status">
        {liveText}
      </p>
      {status ? (
        <AtlasStatusMessage
          tone={
            countyHoldPending || (releaseLoading && !releaseId)
              ? "loading"
              : "empty"
          }
        >
          {status}
        </AtlasStatusMessage>
      ) : null}
      {context.enabled ? (
        <>
          {failedCount > 0 && readyCount > 0 ? (
            <AtlasStatusMessage tone="error">
              Some population and rurality measures did not load. Loaded
              measures stay visible. A failed measure is not zero.
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
