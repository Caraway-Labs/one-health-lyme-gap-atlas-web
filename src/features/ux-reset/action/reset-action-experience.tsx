"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  actionBundlePeriodState,
  actionGovernedUnavailableRecords,
  actionPeriodStates,
  actionPlanPosture,
  actionPlanPostureKinds,
} from "@/features/ux-reset/action/action-context";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromAction } from "@/features/ux-reset/ask-atlas/inherited-context";
import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import { sharedContextToSearchParams } from "@/features/ux-reset/context-params";
import {
  EvidenceObject,
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import {
  evidenceAvailabilityValues,
  releaseEvidenceLoadStateValues,
} from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  investigateFindingSummary,
  investigateLimitationSummary,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import type { InvestigateRecovery } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { useInvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import {
  RESET_ACTION_PATH,
  RESET_INVESTIGATE_PATH,
} from "@/features/ux-reset/routes";
import { cn } from "@/lib/utils";

function actionRecoveryMessage(
  recovery: InvestigateRecovery,
  fips: string | null
): string {
  switch (recovery) {
    case "missing": {
      return "This Action link does not name a county. Atlas will not open a different county on its own.";
    }
    case "directory": {
      return "The published county list could not be loaded, so this county was not opened.";
    }
    case "malformed": {
      return "This link does not identify one county, so no follow-up was opened.";
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

function unsupportedPlanMessage(plan: string): string {
  return `The plan "${plan}" is not a workflow on this page.`;
}

function ActionExperienceInner() {
  const searchParams = useSearchParams();
  const workspace = useInvestigateWorkspace();
  const handleRetryDirectory = () => {
    workspace.retryDirectory();
  };
  const handleRetryEvidence = () => {
    void workspace.retryEvidence();
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
    RESET_INVESTIGATE_PATH,
    RESET_ACTION_PATH,
    handoffParams
  );
  const bundle = workspace.bundle;
  const findingSummary = bundle ? investigateFindingSummary(bundle) : null;
  const limitationSummary = bundle
    ? investigateLimitationSummary(bundle)
    : null;
  const periodState = actionBundlePeriodState({
    bundle,
    requestedPeriod: workspace.period,
  });
  const planPosture = actionPlanPosture(searchParams.getAll("plan"));
  const unavailableRecords = bundle
    ? actionGovernedUnavailableRecords(bundle)
    : [];
  const evidenceState = bundle?.leadFinding
    ? bundle.leadFinding.evidence.availability
    : unavailableRecords.length > 0
      ? evidenceAvailabilityValues.unavailable
      : "";
  const limitations = bundle?.leadLimitation?.text ?? "";
  const staleRecord = bundle?.leadFinding ?? unavailableRecords[0] ?? null;
  const releaseLoadState = workspace.metadata
    ? releaseEvidenceLoadStateValues.ready
    : workspace.metadataError
      ? releaseEvidenceLoadStateValues.error
      : releaseEvidenceLoadStateValues.loading;
  const showSeparateLimitation = Boolean(
    bundle?.leadFinding &&
    bundle.leadLimitation &&
    bundle.leadLimitation.observation.observation.observation_id !==
      bundle.leadFinding.observation.observation_id
  );
  const resolvedIdentity =
    workspace.identity?.fips === workspace.requestedFips
      ? workspace.identity
      : null;
  const title = resolvedIdentity?.label ?? workspace.requestedFips ?? "Action";
  const resolvedStateLabel = resolvedIdentity ? workspace.stateLabel : null;
  usePublishAskAtlasInheritedContext(
    inheritedContextFromAction({
      bundle,
      identity: workspace.identity,
      releaseId: workspace.releaseId,
      releaseMismatch: workspace.recovery === "release_mismatch",
      requestedFips: workspace.requestedFips,
    })
  );

  return (
    <div
      className="ux-reset-action"
      data-page="action"
      data-testid="action-workspace"
    >
      <header
        className="ux-reset-action-header"
        data-county={workspace.requestedFips ?? ""}
        data-period={workspace.period ?? ""}
        data-release={workspace.releaseId ?? ""}
        data-testid="action-header"
      >
        <p className="eyebrow">Action</p>
        <h1>{title}</h1>
        {/* Published county state and FIPS. The Review scope is not this state. */}
        {resolvedIdentity ? (
          <p className="type-body" data-testid="action-county-identity">
            {`FIPS ${resolvedIdentity.fips}`}
            {resolvedStateLabel ? ` · ${resolvedStateLabel}` : null}.
          </p>
        ) : null}
        <p className="type-body">
          Follow-up uses the evidence already read for this county. Atlas does
          not start an intervention.
          {workspace.releaseId ? ` Release ${workspace.releaseId}.` : null}
        </p>
        <Link
          className={cn(buttonVariants(), "ux-reset-action-return")}
          data-testid="action-return"
          data-variant="primary"
          href={returnHref}
        >
          Return to Investigate
        </Link>
      </header>

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
          <p>{workspace.evidenceError}</p>
          <Button
            data-testid="action-retry-evidence"
            type="button"
            variant="secondary"
            onClick={handleRetryEvidence}
          >
            Retry evidence
          </Button>
        </AtlasStatusMessage>
      ) : null}
      {bundle && bundle.measureFailures.length > 0 ? (
        <div data-testid="action-partial-failure">
          <AtlasStatusMessage tone="error">
            <p>
              Some measures could not be loaded. Evidence that loaded stays on
              this county and is not marked unavailable.
            </p>
            <ul>
              {bundle.measureFailures.map((failure) => (
                <li key={failure.measureId}>{failure.measureLabel}</li>
              ))}
            </ul>
            <Button
              data-testid="action-retry-evidence"
              type="button"
              variant="secondary"
              onClick={handleRetryEvidence}
            >
              Retry evidence that did not load
            </Button>
          </AtlasStatusMessage>
        </div>
      ) : null}

      {workspace.recovery ? (
        <div
          data-county={workspace.requestedFips ?? ""}
          data-recovery={workspace.recovery}
          data-testid="action-recovery"
        >
          <AtlasStatusMessage tone="empty">
            <p>
              {actionRecoveryMessage(
                workspace.recovery,
                workspace.requestedFips
              )}
            </p>
            {workspace.recovery === "directory" ? (
              <Button
                data-testid="action-retry-directory"
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

      {bundle && findingSummary && limitationSummary ? (
        <section
          aria-label="Evidence carried from Investigate"
          className="ux-reset-action-summary"
          data-county={bundle.county.fips}
          data-evidence-state={evidenceState}
          data-limitations={limitations}
          data-period-state={periodState}
          data-release={bundle.releaseId}
          data-requested-period={workspace.period ?? ""}
          data-testid="action-evidence"
        >
          <AtlasSectionHeader
            eyebrow="What we know"
            headingLevel="h2"
            title={findingSummary.title}
          />
          <Card className="ux-reset-action-callout">
            <p className="type-body" data-testid="action-finding-text">
              {findingSummary.text}
            </p>
          </Card>
          <AtlasSectionHeader
            eyebrow="What is uncertain"
            headingLevel="h2"
            title={limitationSummary.title}
          />
          <Card className="ux-reset-action-callout">
            <p className="type-body" data-testid="action-limitation-text">
              {limitationSummary.text}
            </p>
          </Card>
          {bundle.leadFinding ? (
            <EvidenceObject
              claimHeadingLevel="h3"
              model={bundle.leadFinding.evidence}
            />
          ) : (
            unavailableRecords.map((record) => (
              <EvidenceObject
                claimHeadingLevel="h3"
                key={record.observation.observation_id}
                model={record.evidence}
              />
            ))
          )}
          {showSeparateLimitation && bundle.leadLimitation ? (
            <EvidenceObject
              claimHeadingLevel="h3"
              model={bundle.leadLimitation.observation.evidence}
            />
          ) : null}
          {periodState === actionPeriodStates.stale && staleRecord ? (
            <AtlasStatusMessage
              title="Period in this link is stale"
              titleAs="h2"
              tone="empty"
            >
              <p data-testid="action-stale-period">
                The period in this link does not fall inside the observations
                for this county. The summary keeps the evidence period{" "}
                {staleRecord.evidence.provenance.observationPeriod} (
                {evidenceAvailabilityLabel(staleRecord.evidence.availability)}
                ).
              </p>
            </AtlasStatusMessage>
          ) : null}
        </section>
      ) : null}

      <section
        aria-label="Follow-up workflows"
        className="ux-reset-action-workflows"
        data-plan={planPosture.kind}
        data-testid="action-workflows"
      >
        <h2>Follow-up</h2>
        <p className="type-body" data-testid="action-workflow-status">
          No follow-up workflow is available for this evidence. Atlas does not
          choose or start an intervention.
        </p>
        <p data-surveillance="unavailable" data-testid="action-surveillance">
          Surveillance Planning is not available.
        </p>
        {planPosture.kind === actionPlanPostureKinds.unsupported ? (
          <AtlasStatusMessage titleAs="h3" tone="empty">
            <p data-testid="action-unsupported-plan">
              {unsupportedPlanMessage(planPosture.plan)}
            </p>
          </AtlasStatusMessage>
        ) : null}
      </section>
    </div>
  );
}

export function ResetActionExperience() {
  return (
    <Suspense
      fallback={
        <AtlasStatusMessage tone="loading">Loading action…</AtlasStatusMessage>
      }
    >
      <ActionExperienceInner />
    </Suspense>
  );
}
