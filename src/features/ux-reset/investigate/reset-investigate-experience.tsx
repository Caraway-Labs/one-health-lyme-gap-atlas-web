"use client";

import { Suspense, useMemo } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromInvestigate } from "@/features/ux-reset/ask-atlas/inherited-context";
import { buildCompareEntryHref } from "@/features/ux-reset/compare/compare-entry";
import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import { sharedContextToSearchParams } from "@/features/ux-reset/context-params";
import {
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { countyEvidenceLoadStates } from "@/features/ux-reset/investigate/county-evidence";
import { CountyIntelligenceHeader } from "@/features/ux-reset/investigate/county-intelligence-header";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { InvestigateNextSteps } from "@/features/ux-reset/investigate/investigate-next-steps";
import { settledInvestigateHierarchy } from "@/features/ux-reset/investigate/investigate-settled-view";
import {
  publishedRowsForCounty,
  resolveInvestigateFinding,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import {
  useInvestigateWorkspace,
  type InvestigateRecovery,
} from "@/features/ux-reset/investigate/use-investigate-workspace";
import {
  EXPLORER_FOLLOW_UP_MODE,
  hrefWithExplorerMode,
} from "@/features/ux-reset/review/explorer-mode";
import {
  ATLAS_EXPLORER_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";

const COUNTY_FIPS = /^\d{5}$/;

function recoveryMessage(
  recovery: InvestigateRecovery,
  fips: string | null
): string {
  switch (recovery) {
    case "missing": {
      return "Choose a county to investigate. Atlas will not open a different county on its own.";
    }
    case "directory": {
      return "The published county list could not be loaded, so this county was not opened.";
    }
    case "malformed": {
      return "This link does not identify one county. Choose a county from the current release.";
    }
    case "unknown": {
      return `County ${fips ?? ""} is not in governed geography.`;
    }
    case "rejected": {
      return "The geography service rejected this county identifier.";
    }
    case "identity": {
      return "The geography response did not match the requested county, so it was not shown.";
    }
    case "release_mismatch": {
      return "The release response did not match the requested dataset.";
    }
    case "unsupported": {
      return "This county is not published in the current release.";
    }
    default: {
      const exhaustive: never = recovery;
      return exhaustive;
    }
  }
}

function selectedCountyLabel(input: {
  countyOptions: readonly { county: string; fips: string }[];
  identityLabel: string | null;
  requestedFips: string | null;
  selectedInRelease: boolean;
}): string | undefined {
  if (!input.selectedInRelease) {
    return undefined;
  }
  if (input.identityLabel) {
    return input.identityLabel;
  }
  return input.countyOptions.find(
    (county) => county.fips === input.requestedFips
  )?.county;
}

function InvestigateExperienceInner() {
  const workspace = useInvestigateWorkspace();
  const handleRetryDirectory = () => {
    workspace.retryDirectory();
  };
  const compareKey = workspace.compare.join(",");
  const handoffParams = useMemo(() => {
    const dataset = workspace.releaseId ?? workspace.requestedDataset;
    return sharedContextToSearchParams({
      compare: compareKey.length > 0 ? compareKey.split(",") : [],
      county: workspace.requestedFips,
      dataset,
      period: workspace.period,
      scope: workspace.scope,
    });
  }, [
    compareKey,
    workspace.period,
    workspace.releaseId,
    workspace.requestedDataset,
    workspace.requestedFips,
    workspace.scope,
  ]);
  const returnHref = uxResetShellHandoffHref(
    RESET_REVIEW_PATH,
    RESET_INVESTIGATE_PATH,
    handoffParams
  );
  const actionHref = hrefWithExplorerMode(
    uxResetShellHandoffHref(
      ATLAS_EXPLORER_PATH,
      RESET_INVESTIGATE_PATH,
      handoffParams
    ),
    EXPLORER_FOLLOW_UP_MODE
  );
  const compareHref = buildCompareEntryHref({
    county: workspace.requestedFips,
    dataset: workspace.releaseId ?? workspace.requestedDataset,
    period: workspace.period,
    returnTo: "investigate",
    scope: workspace.scope,
    sourcePath: RESET_INVESTIGATE_PATH,
    sourceSearchParams: handoffParams,
  });
  const countyOptions = useMemo(
    () =>
      workspace.directory.toSorted(
        (left, right) =>
          left.county.localeCompare(right.county, "en") ||
          left.fips.localeCompare(right.fips)
      ),
    [workspace.directory]
  );
  const selectedInRelease = countyOptions.some(
    (county) => county.fips === workspace.requestedFips
  );
  const releaseLoadState = workspace.metadata
    ? releaseEvidenceLoadStateValues.ready
    : workspace.metadataError
      ? releaseEvidenceLoadStateValues.error
      : releaseEvidenceLoadStateValues.loading;
  const bundle = workspace.bundle;
  const hierarchy = settledInvestigateHierarchy({
    bundle,
    catalogError: workspace.catalogError,
    countyRecord: workspace.countyRecord,
    countyRecordAbsent: workspace.countyRecordAbsent,
    countyRecordError: workspace.countyRecordError,
    countyRecordLoading: workspace.countyRecordLoading,
    countyRecordRefreshError: workspace.countyRecordRefreshError,
    identity: workspace.identity,
    releaseId: workspace.releaseId,
  });
  const visibleBundle = hierarchy?.bundle ?? null;
  const observationsLoaded =
    hierarchy?.observationsLoaded ?? countyEvidenceLoadStates.withheld;
  const publishedRows = visibleBundle
    ? publishedRowsForCounty({
        bundle: visibleBundle,
        countyRecord: hierarchy?.countyRecord ?? null,
        measures: workspace.measures,
      })
    : [];
  const carriedFinding = visibleBundle
    ? resolveInvestigateFinding({
        bundle: visibleBundle,
        catalogFailed: hierarchy?.catalogFailed,
        countyRecordError: hierarchy?.countyRecordError,
        countyRecordLoading: hierarchy?.countyRecordLoading,
        countyRecordPresent: hierarchy?.countyRecord !== null,
        publishedRows,
      })
    : null;
  const nextCounty = bundle?.county.fips ?? workspace.requestedFips ?? "";
  const resolvedCounty =
    bundle?.county.fips ?? workspace.identity?.fips ?? null;
  usePublishExploreCommittedNavigation(
    workspace.releaseId
      ? {
          county: workspace.requestedFips,
          dataset: workspace.releaseId,
          period: workspace.period,
        }
      : null
  );
  usePublishAskAtlasInheritedContext(
    inheritedContextFromInvestigate({
      bundle,
      finding: carriedFinding,
      observationsLoaded,
      identity: workspace.identity,
      releaseId: workspace.releaseId,
      releaseMismatch: workspace.recovery === "release_mismatch",
      requestedFips: workspace.requestedFips,
    })
  );
  const countyLabel = selectedCountyLabel({
    countyOptions,
    identityLabel:
      workspace.identity?.fips === workspace.requestedFips
        ? workspace.identity.label
        : null,
    requestedFips: workspace.requestedFips,
    selectedInRelease,
  });
  const showModelAssisted =
    Boolean(workspace.requestedFips) &&
    COUNTY_FIPS.test(workspace.requestedFips ?? "") &&
    (workspace.recovery === null || workspace.recovery === "release_mismatch");
  const modelAssisted = showModelAssisted ? (
    <Tier1SurveillancePriority
      fips={workspace.requestedFips ?? ""}
      headingLevel={visibleBundle ? "h3" : "h2"}
      release={tier1ReleaseFromMetadata({
        isError:
          Boolean(workspace.metadataError) ||
          workspace.recovery === "release_mismatch",
        isLoading: workspace.metadataLoading,
        releaseId: workspace.releaseId,
      })}
    />
  ) : null;

  return (
    <div
      className="ux-reset-investigate"
      data-ask-atlas="optional"
      data-page="investigate"
      data-testid="investigate-workspace"
    >
      <CountyIntelligenceHeader
        model={{
          countyLabel: workspace.identity?.label ?? null,
          fips: workspace.requestedFips,
          releaseId: workspace.releaseId,
          returnHref,
          scopeLabel: workspace.scopeLabel,
          stateLabel: workspace.stateLabel,
        }}
      />

      <div className="ux-reset-investigate-toolbar">
        <label className="ux-reset-explore-field">
          <span className="type-small">County in this release</span>
          <Select
            value={selectedInRelease ? workspace.requestedFips : null}
            onValueChange={(next) => {
              if (!next) {
                return;
              }
              workspace.setCounty(next);
            }}
          >
            <SelectTrigger
              aria-label="County in this release"
              className="h-11 w-full"
              data-testid="investigate-county-select"
            >
              <SelectValue placeholder="Choose a county">
                {countyLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {countyOptions.map((county) => (
                <SelectItem key={county.fips} value={county.fips}>
                  {county.county}, {county.stateName || county.state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <ReleaseEvidenceStateStrip
        context={
          workspace.metadata
            ? releaseEvidenceContextFromMetadata(workspace.metadata)
            : null
        }
        errorMessage={workspace.metadataError}
        loadState={releaseLoadState}
      />

      {workspace.metadataLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading release metadata…
        </AtlasStatusMessage>
      ) : null}
      {workspace.metadataError ? (
        <AtlasStatusMessage tone="error">
          {workspace.metadataError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.directoryLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading the published county list…
        </AtlasStatusMessage>
      ) : null}
      {workspace.directoryError && workspace.recovery !== "directory" ? (
        <AtlasStatusMessage tone="error">
          {workspace.directoryError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.catalogError ? (
        <AtlasStatusMessage tone="error">
          {workspace.catalogError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.catalogRefreshError ? (
        <AtlasStatusMessage tone="error">
          {workspace.catalogRefreshError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.indicatorError ? (
        <AtlasStatusMessage tone="error">
          {workspace.indicatorError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.indicatorRefreshError ? (
        <AtlasStatusMessage tone="error">
          {workspace.indicatorRefreshError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.metadataRefreshError ? (
        <AtlasStatusMessage tone="error">
          {workspace.metadataRefreshError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.directoryRefreshError ? (
        <AtlasStatusMessage tone="error">
          {workspace.directoryRefreshError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.evidenceLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading county evidence…
        </AtlasStatusMessage>
      ) : null}
      {workspace.evidenceError ? (
        <AtlasStatusMessage tone="error">
          {workspace.evidenceError}
        </AtlasStatusMessage>
      ) : null}

      {workspace.recovery ? (
        <div
          data-county={workspace.requestedFips ?? ""}
          data-recovery={workspace.recovery}
          data-testid="investigate-recovery"
        >
          <AtlasStatusMessage tone="empty">
            <p>
              {recoveryMessage(workspace.recovery, workspace.requestedFips)}
            </p>
            {workspace.recovery === "directory" ? (
              <Button
                data-testid="investigate-retry-directory"
                type="button"
                variant="secondary"
                onClick={handleRetryDirectory}
              >
                Retry county list
              </Button>
            ) : null}
          </AtlasStatusMessage>
        </div>
      ) : null}

      {visibleBundle ? null : modelAssisted}

      {hierarchy ? (
        <InvestigateEvidenceHierarchy
          bundle={hierarchy.bundle}
          catalogFailed={hierarchy.catalogFailed}
          countyRecord={hierarchy.countyRecord}
          countyRecordError={hierarchy.countyRecordError}
          countyRecordLoading={hierarchy.countyRecordLoading}
          countyRecordRefreshError={hierarchy.countyRecordRefreshError}
          measures={workspace.measures}
          modelAssisted={modelAssisted}
          retrying={workspace.evidenceFetching}
          onRetryFailures={
            bundle &&
            bundle.measureFailures.some(
              (failure) => failure.retryable !== false
            )
              ? workspace.retryEvidence
              : undefined
          }
        />
      ) : null}

      <InvestigateNextSteps
        actionHref={actionHref}
        bundle={bundle}
        observationsLoaded={observationsLoaded}
        compare={workspace.compare}
        compareHref={compareHref}
        countyFips={nextCounty}
        finding={carriedFinding}
        findingCountyLabel={
          visibleBundle?.county.label ?? workspace.identity?.label ?? nextCounty
        }
        requestedPeriod={workspace.period}
        resolvedCounty={resolvedCounty}
      />
    </div>
  );
}

export function ResetInvestigateExperience() {
  return (
    <Suspense
      fallback={
        <AtlasStatusMessage tone="loading">
          Loading investigation…
        </AtlasStatusMessage>
      }
    >
      <InvestigateExperienceInner />
    </Suspense>
  );
}
