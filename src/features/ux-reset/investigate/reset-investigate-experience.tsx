"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import {
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { CountyIntelligenceHeader } from "@/features/ux-reset/investigate/county-intelligence-header";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import {
  useInvestigateWorkspace,
  type InvestigateRecovery,
} from "@/features/ux-reset/investigate/use-investigate-workspace";
import {
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";
import { cn } from "@/lib/utils";

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
  const returnHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", workspace.scope);
    if (workspace.requestedFips) {
      params.set("county", workspace.requestedFips);
    }
    if (workspace.releaseId) {
      params.set("dataset", workspace.releaseId);
    }
    if (workspace.period) {
      params.set("period", workspace.period);
    }
    return uxResetShellHandoffHref(
      RESET_REVIEW_PATH,
      RESET_INVESTIGATE_PATH,
      params
    );
  }, [
    workspace.period,
    workspace.releaseId,
    workspace.requestedFips,
    workspace.scope,
  ]);
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
  const nextCounty = bundle?.county.fips ?? workspace.requestedFips ?? "";
  usePublishExploreCommittedNavigation(
    workspace.releaseId
      ? {
          county: workspace.requestedFips,
          dataset: workspace.releaseId,
          period: workspace.period,
        }
      : null
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

      {bundle ? (
        <InvestigateEvidenceHierarchy
          bundle={bundle}
          retrying={workspace.evidenceFetching}
          onRetryFailures={
            bundle.measureFailures.length > 0
              ? workspace.retryEvidence
              : undefined
          }
        />
      ) : null}

      <section
        aria-label="What to inspect or do next"
        className="ux-reset-investigate-next"
        data-county={nextCounty}
        data-testid="investigate-next-steps"
      >
        <h2>What to inspect or do next</h2>
        <p className="type-body">
          Ask Atlas is optional. This county can be read without it.
        </p>
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-investigate-action"
          )}
          data-county={nextCounty}
          data-testid="investigate-next-return"
          data-variant="secondary"
          href={returnHref}
        >
          Return to {workspace.scopeLabel} review
        </Link>
        {bundle?.leadFinding ? (
          <a
            data-county={bundle.county.fips}
            data-testid="investigate-next-finding"
            href={`#investigate-observation-${bundle.leadFinding.observation.observation_id}`}
          >
            Inspect the finding for {bundle.county.label}
          </a>
        ) : null}
        {bundle?.leadLimitation ? (
          <a
            data-county={bundle.county.fips}
            data-testid="investigate-next-limitation"
            href={`#investigate-observation-${bundle.leadLimitation.observation.observation.observation_id}`}
          >
            Inspect the limitation for {bundle.county.label}
          </a>
        ) : null}
      </section>
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
