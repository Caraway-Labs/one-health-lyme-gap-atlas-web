"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromInvestigate } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import { buildCompareEntryHref } from "@/features/ux-reset/compare/compare-entry";
import { sharedContextToSearchParams } from "@/features/ux-reset/context-params";
import { CanonicalGeographyAvailabilityNotice } from "@/features/ux-reset/geography/canonical-geography-availability-notice";
import { countyEvidenceLoadStates } from "@/features/ux-reset/investigate/county-evidence";
import { InvestigateEvidenceHierarchy } from "@/features/ux-reset/investigate/investigate-hierarchy";
import { investigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import { settledInvestigateHierarchy } from "@/features/ux-reset/investigate/investigate-settled-view";
import {
  publishedRowsForCounty,
  resolveInvestigateFinding,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import {
  useInvestigateWorkspace,
  type InvestigateRecovery,
  type InvestigateWorkspace,
} from "@/features/ux-reset/investigate/use-investigate-workspace";
import { EnvironmentalContextSection } from "@/features/ux-reset/review/environmental-context-section";
import type { ExplorerFollowUpState } from "@/features/ux-reset/review/explorer-follow-up";
import {
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_SECTION_IDS,
  hrefWithExplorerMode,
  type ExplorerCountyMode,
} from "@/features/ux-reset/review/explorer-mode";
import {
  ExplorerReviewPriority,
  ExplorerSuggestedFollowUpPanel,
  type SuggestedFollowUpPanelStatus,
} from "@/features/ux-reset/review/explorer-suggested-follow-up-panel";
import { PopulationRuralityContextSection } from "@/features/ux-reset/review/population-rurality-context-section";
import { isGovernedReviewResultState } from "@/features/ux-reset/review/review-operating-state";
import { selectSuggestedFollowUp } from "@/features/ux-reset/review/suggested-follow-up-content";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import type { StateReviewResultState } from "@/generated/models/stateReviewResultState";
import type { FollowUpReviewContext } from "@/lib/follow-up-workflows";
import { cn } from "@/lib/utils";

const SECTIONS = [
  ["Summary", EXPLORER_SECTION_IDS.summary],
  ["Evidence", EXPLORER_SECTION_IDS.evidence],
  ["Environmental context", EXPLORER_SECTION_IDS.environmental],
  ["Population & rurality", EXPLORER_SECTION_IDS.populationRurality],
  ["Context & gaps", EXPLORER_SECTION_IDS.context],
  ["Suggested follow-up", EXPLORER_SECTION_IDS.followUp],
  ["Sources", EXPLORER_SECTION_IDS.sources],
] as const;

function publishedCountyObservationHold(
  workspace: InvestigateWorkspace,
  label: "environmental observations" | "population and rurality observations"
): { message: string; pending: boolean } | null {
  const validated =
    workspace.identity?.fips === workspace.requestedFips
      ? workspace.identity?.fips
      : null;
  if (validated || !workspace.requestedFips) {
    return null;
  }
  if (workspace.directoryLoading || workspace.metadataLoading) {
    return {
      message: `Loading the published county list before ${label} are requested.`,
      pending: true,
    };
  }
  if (workspace.directoryError || workspace.recovery === "directory") {
    return {
      message: `The published county list did not load, so ${label} were not requested.`,
      pending: false,
    };
  }
  return {
    message: `This county is not in the published directory, so ${label} were not requested.`,
    pending: false,
  };
}

function recoveryMessage(
  recovery: InvestigateRecovery,
  fips: string | null
): string {
  switch (recovery) {
    case "missing": {
      return "Choose a county to open evidence. Atlas will not select a county on its own.";
    }
    case "directory": {
      return "The published county list could not be loaded, so this county was not opened.";
    }
    case "malformed": {
      return "This link does not identify one county. Choose a county from the map or list.";
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

function followUpPanelStatus(input: {
  countyRecordAbsent: boolean;
  countyRecordError: string | null;
  countyRecordLoading: boolean;
  directoryError: string | null;
  directoryLoading: boolean;
  hasCountyDetail: boolean;
  metadataError: string | null;
  metadataLoading: boolean;
  recovery: InvestigateRecovery | null;
  requestedFips: string | null;
}): SuggestedFollowUpPanelStatus {
  const countyNotChosen =
    !input.requestedFips ||
    input.recovery === "missing" ||
    input.recovery === "malformed";
  if (countyNotChosen) {
    return "waiting";
  }
  const prerequisitesPending = input.metadataLoading || input.directoryLoading;
  if (prerequisitesPending) {
    return "loading";
  }
  const prerequisitesFailed =
    Boolean(input.metadataError) ||
    Boolean(input.directoryError) ||
    input.recovery === "directory";
  if (prerequisitesFailed) {
    return "error";
  }
  if (input.recovery) {
    return "waiting";
  }
  if (input.countyRecordError) {
    return "error";
  }
  if (input.countyRecordAbsent) {
    return "absent";
  }
  if (input.countyRecordLoading || !input.hasCountyDetail) {
    return "loading";
  }
  return "ready";
}

const ABSENT_NEXT_CHECK = "The review result did not include a next check.";

function followUpReviewContext(
  followUp: ExplorerFollowUpState,
  reviewResultState: StateReviewResultState | null
): FollowUpReviewContext {
  const returnedNextCheck =
    followUp.status === "candidate" ? followUp.firstStep : null;
  return {
    governedNextCheck:
      returnedNextCheck && returnedNextCheck !== ABSENT_NEXT_CHECK
        ? returnedNextCheck
        : null,
    reviewResultState:
      reviewResultState && isGovernedReviewResultState(reviewResultState)
        ? reviewResultState
        : null,
  };
}

export function ExplorerCountyEvidence({
  followUp,
  methodologyLabel,
  mode,
  onBackToMap,
  reviewResultState = null,
}: {
  followUp: ExplorerFollowUpState;
  methodologyLabel: string | null;
  mode: ExplorerCountyMode;
  onBackToMap: () => void;
  reviewResultState?: StateReviewResultState | null;
}) {
  const workspace = useInvestigateWorkspace();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const followUpRef = useRef<HTMLHeadingElement>(null);
  const handleRetryDirectory = () => {
    workspace.retryDirectory();
  };
  const handleRetryEvidence = () => {
    void workspace.retryEvidence();
  };
  const hierarchy = settledInvestigateHierarchy({
    bundle: workspace.bundle,
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
  const finding = visibleBundle
    ? resolveInvestigateFinding({
        bundle: visibleBundle,
        catalogFailed: hierarchy?.catalogFailed,
        countyRecordError: hierarchy?.countyRecordError,
        countyRecordLoading: hierarchy?.countyRecordLoading,
        countyRecordPresent: hierarchy?.countyRecord !== null,
        publishedRows,
      })
    : null;
  const publishedCounty =
    workspace.identity?.fips === workspace.requestedFips
      ? workspace.identity.fips
      : null;
  const handoffParams = sharedContextToSearchParams({
    compare: [...workspace.compare],
    county: workspace.requestedFips,
    dataset: workspace.releaseId ?? workspace.requestedDataset,
    period: workspace.period,
    scope: workspace.scope,
  });
  const compareHref = hrefWithExplorerMode(
    buildCompareEntryHref({
      county: publishedCounty,
      dataset: workspace.releaseId ?? workspace.requestedDataset,
      period: workspace.period,
      returnTo: "review",
      scope: workspace.scope,
      sourcePath: ATLAS_EXPLORER_PATH,
      sourceSearchParams: handoffParams,
    }),
    mode
  );
  const askHref = resetAskAtlasWorkspaceHref(
    ATLAS_EXPLORER_PATH,
    handoffParams
  );
  const pdfContext =
    observationsLoaded === countyEvidenceLoadStates.loaded && workspace.bundle
      ? investigatePdfContext(workspace.bundle, workspace.period)
      : null;
  const title =
    workspace.identity?.fips === workspace.requestedFips
      ? workspace.identity.label
      : (workspace.requestedFips ?? "Choose a county");
  const followUpStatus = followUpPanelStatus({
    countyRecordAbsent: workspace.countyRecordAbsent,
    countyRecordError: workspace.countyRecordError,
    countyRecordLoading: workspace.countyRecordLoading,
    directoryError: workspace.directoryError,
    directoryLoading: workspace.directoryLoading,
    hasCountyDetail: workspace.countyDetail !== null,
    metadataError: workspace.metadataError,
    metadataLoading: workspace.metadataLoading,
    recovery: workspace.recovery,
    requestedFips: workspace.requestedFips,
  });
  const environmentalHold = publishedCountyObservationHold(
    workspace,
    "environmental observations"
  );
  const populationHold = publishedCountyObservationHold(
    workspace,
    "population and rurality observations"
  );
  const validatedCountyFips =
    workspace.identity?.fips === workspace.requestedFips
      ? (workspace.identity?.fips ?? null)
      : null;
  const followUpSelection =
    followUpStatus === "ready" && workspace.suggestedFollowUpEvidence
      ? selectSuggestedFollowUp(workspace.suggestedFollowUpEvidence)
      : null;
  usePublishAskAtlasInheritedContext(
    inheritedContextFromInvestigate({
      bundle: workspace.bundle,
      finding,
      identity: workspace.identity,
      observationsLoaded,
      releaseId: workspace.releaseId,
      releaseMismatch: workspace.recovery === "release_mismatch",
      requestedFips: workspace.requestedFips,
    })
  );
  const focusKey = `${mode}:${workspace.requestedFips ?? ""}`;
  useLayoutEffect(() => {
    const target = focusKey.startsWith(`${EXPLORER_FOLLOW_UP_MODE}:`)
      ? followUpRef.current
      : headingRef.current;
    target?.focus();
  }, [focusKey]);

  return (
    <div
      className="ux-reset-explorer-evidence"
      data-county={workspace.requestedFips ?? ""}
      data-mode={mode}
      data-release={workspace.releaseId ?? ""}
      data-testid="explorer-county-evidence"
    >
      <section aria-label="County summary" id={EXPLORER_SECTION_IDS.summary}>
        <Button
          data-testid="explorer-back-to-map"
          type="button"
          variant="secondary"
          onClick={onBackToMap}
        >
          Back to map
        </Button>
        <p className="eyebrow">County evidence</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          data-testid="explorer-county-heading"
        >
          {title}
        </h2>
        <p className="type-body" data-testid="explorer-county-identity">
          {workspace.requestedFips
            ? `FIPS ${workspace.requestedFips}`
            : "No county is selected."}
          {workspace.stateLabel ? ` · ${workspace.stateLabel}` : null}
          {workspace.releaseId ? ` · Release ${workspace.releaseId}` : null}
        </p>
        <CanonicalGeographyAvailabilityNotice fips={workspace.requestedFips} />
        {followUpSelection ? (
          <ExplorerReviewPriority selection={followUpSelection} />
        ) : null}
        {workspace.requestedFips ? (
          <Tier1SurveillancePriority
            fips={workspace.requestedFips}
            headingLevel="h3"
            showInterpretiveNotes={false}
            release={tier1ReleaseFromMetadata({
              isError:
                Boolean(workspace.metadataError) ||
                workspace.recovery === "release_mismatch",
              isLoading: workspace.metadataLoading,
              releaseId: workspace.releaseId,
            })}
          />
        ) : null}
        <div className="ux-reset-explorer-actions">
          {publishedCounty ? (
            <Link
              className={cn(buttonVariants({ variant: "secondary" }))}
              data-testid="explorer-compare"
              href={compareHref}
            >
              Compare this county
            </Link>
          ) : null}
          {workspace.requestedFips ? (
            <Link
              className={cn(buttonVariants({ variant: "secondary" }))}
              data-testid="explorer-ask-atlas"
              href={askHref}
            >
              Ask Atlas
            </Link>
          ) : (
            <p
              className="type-small"
              data-testid="explorer-context-actions-waiting"
            >
              Compare and Ask Atlas stay unavailable until one county is
              selected.
            </p>
          )}
        </div>
      </section>

      <nav
        aria-label="County evidence sections"
        className="ux-reset-explorer-section-nav"
        data-testid="explorer-section-nav"
      >
        {SECTIONS.map(([label, id]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section
        aria-label="Observed evidence"
        id={EXPLORER_SECTION_IDS.evidence}
      >
        <AtlasSectionHeader
          eyebrow="Evidence"
          headingLevel="h2"
          title="Observed evidence"
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
            <p>{workspace.evidenceError}</p>
            <Button
              data-testid="explorer-retry-evidence"
              type="button"
              variant="secondary"
              onClick={handleRetryEvidence}
            >
              Retry evidence
            </Button>
          </AtlasStatusMessage>
        ) : null}
        {workspace.recovery ? (
          <div
            data-county={workspace.requestedFips ?? ""}
            data-recovery={workspace.recovery}
            data-testid="explorer-recovery"
          >
            <AtlasStatusMessage tone="empty">
              <p>
                {recoveryMessage(workspace.recovery, workspace.requestedFips)}
              </p>
              {workspace.recovery === "directory" ? (
                <Button
                  data-testid="explorer-retry-directory"
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
        {hierarchy ? (
          <InvestigateEvidenceHierarchy
            bundle={hierarchy.bundle}
            catalogFailed={hierarchy.catalogFailed}
            countyRecord={hierarchy.countyRecord}
            countyRecordError={hierarchy.countyRecordError}
            countyRecordLoading={hierarchy.countyRecordLoading}
            countyRecordRefreshError={hierarchy.countyRecordRefreshError}
            measures={workspace.measures}
            omitDisclaimers
            retrying={workspace.evidenceFetching}
            onRetryFailures={
              workspace.bundle && workspace.bundle.measureFailures.length > 0
                ? workspace.retryEvidence
                : undefined
            }
          />
        ) : null}
      </section>

      <EnvironmentalContextSection
        countyHold={environmentalHold?.message ?? null}
        countyHoldPending={environmentalHold?.pending ?? false}
        fips={validatedCountyFips}
        releaseId={workspace.releaseId}
        releaseLoading={workspace.metadataLoading}
      />

      <PopulationRuralityContextSection
        countyHold={populationHold?.message ?? null}
        countyHoldPending={populationHold?.pending ?? false}
        fips={validatedCountyFips}
        releaseId={workspace.releaseId}
        releaseLoading={workspace.metadataLoading}
      />

      {hierarchy ? null : (
        <section
          aria-label="Context and gaps"
          id={EXPLORER_SECTION_IDS.context}
        >
          <AtlasSectionHeader
            eyebrow="Context"
            headingLevel="h2"
            title="Context and gaps"
          />
          <p className="type-body">
            Context and gaps stay with this county&apos;s evidence request. They
            are not shown until that request settles.
          </p>
        </section>
      )}

      <ExplorerSuggestedFollowUpPanel
        countyFips={workspace.requestedFips}
        detail={workspace.countyDetail}
        headingRef={followUpRef}
        reviewContext={followUpReviewContext(followUp, reviewResultState)}
        status={followUpStatus}
      />

      <section
        aria-label="Sources and methods"
        id={EXPLORER_SECTION_IDS.sources}
      >
        <AtlasSectionHeader
          eyebrow="Provenance"
          headingLevel="h2"
          title="Sources and methods"
        />
        <p className="type-body">
          Each evidence value keeps its source, period, units, and
          qualification. This section does not add a second mapping.
        </p>
        <p className="type-body" data-testid="explorer-methodology">
          {methodologyLabel ??
            "Review methodology was not loaded for this scope."}
        </p>
        {pdfContext ? (
          <InvestigatePdfExport context={pdfContext} />
        ) : (
          <p className="type-body" data-testid="explorer-export-unavailable">
            Export is unavailable until this county&apos;s visible evidence,
            periods, sources, and caveats can be verified together.
          </p>
        )}
      </section>
    </div>
  );
}
