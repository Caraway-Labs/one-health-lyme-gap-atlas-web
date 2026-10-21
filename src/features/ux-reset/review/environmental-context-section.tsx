"use client";

import { CloudSun, RotateCcw } from "lucide-react";
import { useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import {
  ENVIRONMENTAL_CONTEXT_MEASURES,
  ENVIRONMENTAL_CONTEXT_WINDOW,
} from "@/features/ux-reset/review/environmental-context";
import { ExplorerLoadingStatus } from "@/features/ux-reset/review/explorer-loading-status";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
import { ExplorerSectionHeading } from "@/features/ux-reset/review/explorer-section-heading";
import {
  useEnvironmentalContext,
  type EnvironmentalMeasureView,
} from "@/features/ux-reset/review/use-environmental-context";

const DATE_INPUT_ID = "explorer-environmental-date";

function measureClaim(measureId: string): string {
  return (
    ENVIRONMENTAL_CONTEXT_MEASURES.find(
      (measure) => measure.measureId === measureId
    )?.claimLabel ?? measureId
  );
}

function EnvironmentalMeasureBody({
  view,
}: {
  view: EnvironmentalMeasureView;
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
            testId={`environmental-known-empty-${view.measureId}`}
          />
        );
      }
      return (
        <AtlasStatusMessage tone="empty">
          {`No governed observation was returned for ${measureClaim(view.measureId)} on this county and day.`}
        </AtlasStatusMessage>
      );
    }
    case "conflict": {
      return (
        <AtlasStatusMessage tone="error">
          {`${view.count} observations were returned for ${measureClaim(view.measureId)} on this day. They were not combined.`}
        </AtlasStatusMessage>
      );
    }
    case "ready": {
      return (
        <>
          <EvidenceObject
            model={view.presentation.evidence}
            presentation="compact"
            showCaveat={false}
            showReason
          />
          <dl className="ux-reset-environmental-meta">
            <div>
              <dt>Coverage</dt>
              <dd>{view.presentation.coverageLabel}</dd>
            </div>
            <div>
              <dt>24-hour convention</dt>
              <dd>{view.presentation.dayConvention}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{view.presentation.sourceLabel}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{view.presentation.productId}</dd>
            </div>
            <div>
              <dt>Method version</dt>
              <dd>{view.presentation.methodVersion}</dd>
            </div>
            <div>
              <dt>Provenance reference</dt>
              <dd>{view.presentation.provenanceRef}</dd>
            </div>
            <div>
              <dt>Value state</dt>
              <dd>{view.presentation.valueStateLabel}</dd>
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
  date: string;
  dateSupport: "invalid" | "outside_coverage" | "supported";
  enabled: boolean;
  fips: string | null;
  releaseId: string | null;
  releaseLoading: boolean;
}): string | null {
  if (!input.fips) {
    return input.countyHold ?? "Choose a county to load environmental context.";
  }
  if (input.releaseLoading && !input.releaseId) {
    return "Loading the release for environmental context…";
  }
  if (!input.releaseId) {
    return "No governed release is available, so environmental observations were not requested.";
  }
  if (input.dateSupport === "invalid") {
    return "Enter a calendar day. No observation is requested for an unreadable date.";
  }
  if (input.dateSupport === "outside_coverage") {
    return `${input.date} is outside the supported January 2025 coverage. No observation is shown for that day.`;
  }
  if (!input.enabled) {
    return "Environmental observations were not requested for this county.";
  }
  return null;
}

export function EnvironmentalContextSection({
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
  const [date, setDate] = useState<string>(
    ENVIRONMENTAL_CONTEXT_WINDOW.representativeDate
  );
  const context = useEnvironmentalContext({ date, fips, releaseId });
  const status = sectionStatus({
    countyHold,
    date,
    dateSupport: context.dateSupport,
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
    liveText = `Loading environmental context for county ${fips} on ${date}.`;
  } else if (!status && failedCount > 0 && readyCount > 0) {
    liveText = `Environmental context is partial for county ${fips} on ${date}.`;
  } else if (!status && readyCount === context.measures.length) {
    liveText = `Environmental context loaded for county ${fips} on ${date}.`;
  }
  return (
    <section
      aria-label="Environmental context"
      className="ux-reset-environmental-context"
      data-county={fips ?? ""}
      data-date={date}
      data-release={releaseId ?? ""}
      data-testid="explorer-environmental-context"
      id={EXPLORER_SECTION_IDS.environmental}
    >
      <ExplorerSectionHeading
        description="January 2025 NOAA weather for this county."
        icon={CloudSun}
        note="Context"
        title="Environmental context"
      />
      <div className="ux-reset-environmental-date">
        <label htmlFor={DATE_INPUT_ID}>
          Observation date
          <Input
            id={DATE_INPUT_ID}
            max={ENVIRONMENTAL_CONTEXT_WINDOW.end}
            min={ENVIRONMENTAL_CONTEXT_WINDOW.start}
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
            }}
          />
        </label>
        <p className="type-small">
          {`Supported coverage is ${ENVIRONMENTAL_CONTEXT_WINDOW.start} through ${ENVIRONMENTAL_CONTEXT_WINDOW.end}. The default ${ENVIRONMENTAL_CONTEXT_WINDOW.representativeDate} is the documented representative day, not the latest day.`}
        </p>
      </div>
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
              Some environmental measures did not load. Loaded measures stay
              visible.
            </AtlasStatusMessage>
          ) : null}
          <div className="ux-reset-environmental-measures">
            {context.measures.map((view) => (
              <article
                data-county={fips ?? ""}
                data-date={date}
                data-measure={view.measureId}
                data-status={view.status}
                data-testid={`environmental-measure-${view.measureId}`}
                key={view.measureId}
              >
                <EnvironmentalMeasureBody view={view} />
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
