"use client";

import {
  ArrowLeft,
  BookOpen,
  CircleAlert,
  ClipboardList,
  GitCompare,
  Globe,
  LayoutDashboard,
  MessageCircle,
  Microscope,
  RotateCcw,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Meter, MeterLabel, MeterValue } from "@/components/ui/meter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  defaultExplorerEvidenceTab,
  explorerElementForId,
  explorerHashTargetId,
  explorerTabForHash,
  parseExplorerEvidenceTab,
  type ExplorerEvidenceTab,
} from "@/features/ux-reset/review/explorer-evidence-tabs";
import type { ExplorerFollowUpState } from "@/features/ux-reset/review/explorer-follow-up";
import { ExplorerLoadingStatus } from "@/features/ux-reset/review/explorer-loading-status";
import {
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_SECTION_IDS,
  hrefWithExplorerMode,
  type ExplorerCountyMode,
} from "@/features/ux-reset/review/explorer-mode";
import { ExplorerSectionHeading } from "@/features/ux-reset/review/explorer-section-heading";
import {
  ExplorerReviewPriority,
  ExplorerSuggestedFollowUpPanel,
  type SuggestedFollowUpPanelStatus,
} from "@/features/ux-reset/review/explorer-suggested-follow-up-panel";
import { PopulationRuralityContextSection } from "@/features/ux-reset/review/population-rurality-context-section";
import { isGovernedReviewResultState } from "@/features/ux-reset/review/review-operating-state";
import { selectSuggestedFollowUp } from "@/features/ux-reset/review/suggested-follow-up-content";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { ExplorerSurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/explorer-surveillance-intelligence";
import { formatPublishedGapScore } from "@/features/ux-reset/surveillance-intelligence/format-surveillance-intelligence";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { StateReviewResultState } from "@/generated/models/stateReviewResultState";
import type { FollowUpReviewContext } from "@/lib/follow-up-workflows";
import { cn } from "@/lib/utils";

import "./explorer-county-evidence.css";

type CountyHeaderSummary = {
  completeness: number | null;
  gapScore: string | null;
};

/**
 * Header values come only from the published county record this view already
 * loads. A score outside the contiguous tick scope, or a value that is not a
 * finite number, is left out. Nothing is derived or defaulted to zero.
 */
function countyHeaderSummary(
  workspace: InvestigateWorkspace
): CountyHeaderSummary | null {
  const detail = workspace.countyDetail;
  if (
    !detail ||
    workspace.recovery ||
    !workspace.requestedFips ||
    detail.fips !== workspace.requestedFips
  ) {
    return null;
  }
  const score = detail.score.score;
  const gapScore =
    detail.in_contiguous_tick_scope && Number.isFinite(score)
      ? formatPublishedGapScore(score)
      : null;
  const completeness = detail.evidence_completeness;
  const validCompleteness =
    Number.isFinite(completeness) && completeness >= 0 && completeness <= 100
      ? completeness
      : null;
  if (gapScore === null && validCompleteness === null) {
    return null;
  }
  return { completeness: validCompleteness, gapScore };
}

function reviewCategoryCopy(followUp: ExplorerFollowUpState): string {
  switch (followUp.status) {
    case "loading": {
      return "Review category is loading with the review result.";
    }
    case "request-failed": {
      return "Review category is not shown because the review result did not load.";
    }
    case "not-in-scope": {
      return "This scope did not load a state review category.";
    }
    case "candidate": {
      return followUp.category
        ? `Review category ${followUp.category}.`
        : "No review category was returned for this county.";
    }
    case "factual": {
      return "No review category was returned for this county.";
    }
    case "withheld": {
      return "Review category is withheld because this result does not publish candidates.";
    }
    default: {
      const exhaustive: never = followUp;
      return exhaustive;
    }
  }
}

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
  const tier1Release = tier1ReleaseFromMetadata({
    isError:
      Boolean(workspace.metadataError) ||
      workspace.recovery === "release_mismatch",
    isLoading: workspace.metadataLoading,
    releaseId: workspace.releaseId,
  });
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
  // Each mode or county opens its default tab. The tab then follows the user
  // and any `#section` hash that names a section in another tab.
  const [tabState, setTabState] = useState<{
    key: string;
    tab: ExplorerEvidenceTab;
  }>({ key: focusKey, tab: defaultExplorerEvidenceTab(mode) });
  let activeTab = tabState.tab;
  if (tabState.key !== focusKey) {
    activeTab = defaultExplorerEvidenceTab(mode);
    setTabState({ key: focusKey, tab: activeTab });
  }
  const headerSummary = countyHeaderSummary(workspace);
  useLayoutEffect(() => {
    const target = focusKey.startsWith(`${EXPLORER_FOLLOW_UP_MODE}:`)
      ? followUpRef.current
      : headingRef.current;
    target?.focus();
  }, [focusKey]);
  useEffect(() => {
    const revealHashTarget = () => {
      const { hash } = globalThis.location;
      const tab = explorerTabForHash(hash, document);
      if (!tab) {
        return;
      }
      setTabState((current) => ({ key: current.key, tab }));
      const id = explorerHashTargetId(hash);
      requestAnimationFrame(() => {
        if (id) {
          explorerElementForId(document, id)?.scrollIntoView();
        }
      });
    };
    revealHashTarget();
    globalThis.addEventListener("hashchange", revealHashTarget);
    return () => {
      globalThis.removeEventListener("hashchange", revealHashTarget);
    };
  }, []);

  const renderHierarchy = (region: "context" | "evidence") =>
    hierarchy ? (
      <InvestigateEvidenceHierarchy
        bundle={hierarchy.bundle}
        catalogFailed={hierarchy.catalogFailed}
        countyRecord={hierarchy.countyRecord}
        countyRecordError={hierarchy.countyRecordError}
        countyRecordLoading={hierarchy.countyRecordLoading}
        countyRecordRefreshError={hierarchy.countyRecordRefreshError}
        measures={workspace.measures}
        omitDisclaimers
        presentation="explorer"
        region={region}
        retrying={workspace.evidenceFetching}
        onRetryFailures={
          workspace.bundle && workspace.bundle.measureFailures.length > 0
            ? workspace.retryEvidence
            : undefined
        }
      />
    ) : null;
  const handleTabChange = (value: unknown) => {
    const next = parseExplorerEvidenceTab(value);
    if (next) {
      setTabState({ key: focusKey, tab: next });
    }
  };

  return (
    <div
      className="ux-reset-explorer-evidence"
      data-active-tab={activeTab}
      data-county={workspace.requestedFips ?? ""}
      data-mode={mode}
      data-release={workspace.releaseId ?? ""}
      data-testid="explorer-county-evidence"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <header
          className="atlas-county-header"
          data-testid="explorer-county-header"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-testid="explorer-back-to-map"
              type="button"
              variant="secondary"
              onClick={onBackToMap}
            >
              <ArrowLeft aria-hidden="true" data-icon="inline-start" />
              Back to map
            </Button>
            <p className="text-muted-foreground m-0 text-xs font-semibold tracking-wide uppercase">
              County evidence
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {publishedCounty ? (
                <Link
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" })
                  )}
                  data-testid="explorer-compare"
                  href={compareHref}
                >
                  <GitCompare aria-hidden="true" data-icon="inline-start" />
                  Compare this county
                </Link>
              ) : null}
              {workspace.requestedFips ? (
                <Link
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" })
                  )}
                  data-testid="explorer-ask-atlas"
                  href={askHref}
                >
                  <MessageCircle aria-hidden="true" data-icon="inline-start" />
                  Ask Atlas
                </Link>
              ) : (
                <p
                  className="text-muted-foreground m-0 text-xs"
                  data-testid="explorer-context-actions-waiting"
                >
                  Compare and Ask Atlas stay unavailable until one county is
                  selected.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              ref={headingRef}
              tabIndex={-1}
              data-testid="explorer-county-heading"
            >
              {title}
            </h2>
            <p
              className="text-muted-foreground m-0 text-sm"
              data-testid="explorer-county-identity"
            >
              {workspace.requestedFips
                ? `FIPS ${workspace.requestedFips}`
                : "No county is selected."}
              {workspace.stateLabel ? ` · ${workspace.stateLabel}` : null}
              {workspace.releaseId ? ` · Release ${workspace.releaseId}` : null}
            </p>
          </div>
          {headerSummary ? (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
              data-testid="explorer-county-header-summary"
            >
              {headerSummary.gapScore ? (
                <Badge
                  data-testid="explorer-county-score"
                  variant="outline"
                >{`Gap score ${headerSummary.gapScore}`}</Badge>
              ) : null}
              {headerSummary.completeness === null ? null : (
                <Meter
                  className="w-44"
                  data-testid="explorer-county-completeness"
                  max={100}
                  min={0}
                  value={headerSummary.completeness}
                >
                  <MeterLabel>Evidence completeness</MeterLabel>
                  <MeterValue>{(_formatted, value) => `${value}%`}</MeterValue>
                </Meter>
              )}
            </div>
          ) : null}
          <TabsList
            aria-label="County evidence sections"
            className="w-full justify-start"
            data-testid="explorer-section-nav"
            variant="line"
          >
            <TabsTrigger value="overview">
              <LayoutDashboard aria-hidden="true" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="evidence">
              <Microscope aria-hidden="true" />
              Evidence
            </TabsTrigger>
            <TabsTrigger value="context">
              <Globe aria-hidden="true" />
              Context
            </TabsTrigger>
            <TabsTrigger value="follow-up">
              <Zap aria-hidden="true" />
              Follow-up
            </TabsTrigger>
            <TabsTrigger value="sources">
              <BookOpen aria-hidden="true" />
              Sources
            </TabsTrigger>
          </TabsList>
        </header>

        <CanonicalGeographyAvailabilityNotice fips={workspace.requestedFips} />

        <TabsContent
          className="grid gap-4"
          data-explorer-tab="overview"
          keepMounted
          value="overview"
        >
          <section
            aria-label="County summary"
            className="grid gap-3"
            id={EXPLORER_SECTION_IDS.summary}
          >
            {followUpSelection ? (
              <ExplorerReviewPriority selection={followUpSelection} />
            ) : null}
            <ExplorerSectionHeading
              icon={ClipboardList}
              level="h3"
              title="Why review this county?"
            />
            <p className="type-body" data-testid="explorer-review-category">
              {reviewCategoryCopy(followUp)}
            </p>
            {followUp.status === "candidate" && followUp.rationale ? (
              <p className="type-body" data-testid="explorer-summary-reason">
                {followUp.rationale}
              </p>
            ) : null}
            {workspace.requestedFips ? (
              <ExplorerSurveillanceIntelligence
                fips={workspace.requestedFips}
                release={tier1Release}
              />
            ) : null}
          </section>
        </TabsContent>

        <TabsContent
          className="grid gap-4"
          data-explorer-tab="evidence"
          keepMounted
          value="evidence"
        >
          <section
            aria-label="Observed evidence"
            className="grid gap-3"
            id={EXPLORER_SECTION_IDS.evidence}
          >
            <ExplorerSectionHeading
              icon={Microscope}
              note="Evidence"
              title="Observed evidence"
            />
            {workspace.metadataLoading ? (
              <ExplorerLoadingStatus>
                Loading release metadata…
              </ExplorerLoadingStatus>
            ) : null}
            {workspace.metadataError ? (
              <AtlasStatusMessage tone="error">
                {workspace.metadataError}
              </AtlasStatusMessage>
            ) : null}
            {workspace.directoryLoading ? (
              <ExplorerLoadingStatus>
                Loading the published county list…
              </ExplorerLoadingStatus>
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
              <ExplorerLoadingStatus>
                Loading county evidence…
              </ExplorerLoadingStatus>
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
                  <RotateCcw aria-hidden="true" data-icon="inline-start" />
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
                    {recoveryMessage(
                      workspace.recovery,
                      workspace.requestedFips
                    )}
                  </p>
                  {workspace.recovery === "directory" ? (
                    <Button
                      data-testid="explorer-retry-directory"
                      type="button"
                      variant="secondary"
                      onClick={handleRetryDirectory}
                    >
                      <RotateCcw aria-hidden="true" data-icon="inline-start" />
                      Retry county list
                    </Button>
                  ) : null}
                </AtlasStatusMessage>
              </div>
            ) : null}
            {renderHierarchy("evidence")}
          </section>
        </TabsContent>

        <TabsContent
          className="grid gap-6"
          data-explorer-tab="context"
          keepMounted
          value="context"
        >
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

          {hierarchy ? (
            renderHierarchy("context")
          ) : (
            <section
              aria-label="Context and gaps"
              className="grid gap-3"
              id={EXPLORER_SECTION_IDS.context}
            >
              <ExplorerSectionHeading
                icon={CircleAlert}
                note="Context"
                title="Context and gaps"
              />
              <p className="type-body">
                Context and gaps stay with this county&apos;s evidence request.
                They are not shown until that request settles.
              </p>
            </section>
          )}
        </TabsContent>

        <TabsContent
          className="grid gap-4"
          data-explorer-tab="follow-up"
          keepMounted
          value="follow-up"
        >
          <ExplorerSuggestedFollowUpPanel
            countyFips={workspace.requestedFips}
            detail={workspace.countyDetail}
            headingRef={followUpRef}
            reviewContext={followUpReviewContext(followUp, reviewResultState)}
            status={followUpStatus}
          />
        </TabsContent>

        <TabsContent
          className="grid gap-4"
          data-explorer-tab="sources"
          keepMounted
          value="sources"
        >
          <section
            aria-label="Sources and methods"
            className="grid gap-3"
            id={EXPLORER_SECTION_IDS.sources}
          >
            <ExplorerSectionHeading
              icon={BookOpen}
              note="Provenance"
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
              <p
                className="type-body"
                data-testid="explorer-export-unavailable"
              >
                Export is unavailable until this county&apos;s visible evidence,
                periods, sources, and caveats can be verified together.
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
