"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromInvestigate } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import { buildCompareEntryHref } from "@/features/ux-reset/compare/compare-entry";
import { sharedContextToSearchParams } from "@/features/ux-reset/context-params";
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
} from "@/features/ux-reset/investigate/use-investigate-workspace";
import type { ExplorerFollowUpState } from "@/features/ux-reset/review/explorer-follow-up";
import {
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_SECTION_IDS,
  hrefWithExplorerMode,
  type ExplorerCountyMode,
} from "@/features/ux-reset/review/explorer-mode";
import { RESET_REVIEW_PATH } from "@/features/ux-reset/routes";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { Tier1SurveillancePriority } from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import { cn } from "@/lib/utils";

const SECTIONS = [
  ["Summary", EXPLORER_SECTION_IDS.summary],
  ["Evidence", EXPLORER_SECTION_IDS.evidence],
  ["Context & gaps", EXPLORER_SECTION_IDS.context],
  ["Suggested follow-up", EXPLORER_SECTION_IDS.followUp],
  ["Sources", EXPLORER_SECTION_IDS.sources],
] as const;

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
    default: {
      const exhaustive: never = followUp;
      return exhaustive;
    }
  }
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

function FollowUpChecklist({
  limitations,
}: {
  limitations: readonly string[];
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  return (
    <div data-testid="explorer-follow-up-checklist">
      <p className="type-small">
        Checking a line is a reading aid on this page. It is not saved,
        assigned, or sent.
      </p>
      <ul className="ux-reset-explorer-checklist">
        {limitations.map((limitation) => (
          <li key={limitation}>
            <label>
              <input
                checked={checked.has(limitation)}
                type="checkbox"
                onChange={(event) => {
                  setChecked((current) => {
                    const next = new Set(current);
                    if (event.target.checked) {
                      next.add(limitation);
                    } else {
                      next.delete(limitation);
                    }
                    return next;
                  });
                }}
              />
              <span>{limitation}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestedFollowUp({
  countyFips,
  followUp,
  headingRef,
}: {
  countyFips: string | null;
  followUp: ExplorerFollowUpState;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const status = followUp.status;
  return (
    <section
      aria-label="Suggested follow-up"
      className="ux-reset-explorer-follow-up"
      data-follow-up={status}
      data-testid="explorer-follow-up"
      id={EXPLORER_SECTION_IDS.followUp}
    >
      <h2 ref={headingRef} tabIndex={-1}>
        Suggested follow-up
      </h2>
      {status === "loading" ? (
        <AtlasStatusMessage tone="loading">
          Loading the review result for suggested follow-up…
        </AtlasStatusMessage>
      ) : null}
      {status === "request-failed" ? (
        <AtlasStatusMessage tone="error">
          The review result could not be loaded, so suggested follow-up is not
          shown. That is a request failure, not a decision that no follow-up
          exists.
        </AtlasStatusMessage>
      ) : null}
      {status === "not-in-scope" ? (
        <AtlasStatusMessage tone="empty">
          Suggested follow-up is read from a state review result. This scope did
          not load that result, so no next step is shown.
        </AtlasStatusMessage>
      ) : null}
      {status === "factual" ? (
        <AtlasStatusMessage tone="empty">
          {countyFips
            ? "No suggested follow-up was returned for this county. Atlas does not invent a rationale or a next step."
            : "Choose a county before reading suggested follow-up. Atlas will not pick one."}
        </AtlasStatusMessage>
      ) : null}
      {status === "candidate" ? (
        <>
          <p className="type-small">
            {followUp.category
              ? `Review category ${followUp.category}.`
              : "No review category was returned for this county."}
          </p>
          <p className="type-body" data-testid="explorer-follow-up-step">
            {followUp.firstStep ??
              "The review result did not include a next check."}
          </p>
          <p className="type-body" data-testid="explorer-follow-up-rationale">
            {followUp.rationale ??
              "The review result did not include a reason for this county."}
          </p>
          {followUp.limitations.length > 0 ? (
            <FollowUpChecklist
              key={countyFips ?? "none"}
              limitations={followUp.limitations}
            />
          ) : (
            <p className="type-body">
              No local verification questions were returned for this county.
            </p>
          )}
          <details className="ux-reset-explorer-disclosure">
            <summary>Partner roles and official resources</summary>
            <p className="type-body">
              Atlas does not assign a partner, a deadline, or a local owner.
              Official resources are the sources shown with this county&apos;s
              evidence. Responsibility and timing stay with the jurisdiction.
            </p>
          </details>
        </>
      ) : null}
    </section>
  );
}

export function ExplorerCountyEvidence({
  followUp,
  methodologyLabel,
  mode,
  onBackToMap,
}: {
  followUp: ExplorerFollowUpState;
  methodologyLabel: string | null;
  mode: ExplorerCountyMode;
  onBackToMap: () => void;
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
  const handoffParams = sharedContextToSearchParams({
    compare: [...workspace.compare],
    county: workspace.requestedFips,
    dataset: workspace.releaseId ?? workspace.requestedDataset,
    period: workspace.period,
    scope: workspace.scope,
  });
  const compareHref = hrefWithExplorerMode(
    buildCompareEntryHref({
      county: workspace.requestedFips,
      dataset: workspace.releaseId ?? workspace.requestedDataset,
      period: workspace.period,
      returnTo: "review",
      scope: workspace.scope,
      sourcePath: RESET_REVIEW_PATH,
      sourceSearchParams: handoffParams,
    }),
    mode
  );
  const askHref = resetAskAtlasWorkspaceHref(RESET_REVIEW_PATH, handoffParams);
  const pdfContext =
    observationsLoaded === countyEvidenceLoadStates.loaded && workspace.bundle
      ? investigatePdfContext(workspace.bundle, workspace.period)
      : null;
  const title =
    workspace.identity?.fips === workspace.requestedFips
      ? workspace.identity.label
      : (workspace.requestedFips ?? "Choose a county");
  const leadLimitation =
    followUp.status === "candidate" ? (followUp.limitations[0] ?? null) : null;
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
        <p className="type-body" data-testid="explorer-review-category">
          {reviewCategoryCopy(followUp)}
        </p>
        {followUp.status === "candidate" && followUp.rationale ? (
          <p className="type-body" data-testid="explorer-summary-reason">
            {followUp.rationale}
          </p>
        ) : null}
        {leadLimitation ? (
          <p className="type-body" data-testid="explorer-summary-limitation">
            {leadLimitation}
          </p>
        ) : null}
        {workspace.requestedFips ? (
          <Tier1SurveillancePriority
            fips={workspace.requestedFips}
            headingLevel="h3"
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
          <Button
            data-testid="explorer-back-to-map"
            type="button"
            onClick={onBackToMap}
          >
            Back to map
          </Button>
          {workspace.requestedFips ? (
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
            retrying={workspace.evidenceFetching}
            onRetryFailures={
              workspace.bundle && workspace.bundle.measureFailures.length > 0
                ? workspace.retryEvidence
                : undefined
            }
          />
        ) : null}
      </section>

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
            are not shown until that request settles, and a failed request is
            not a gap in the county. Missing or suppressed values are not zero.
          </p>
        </section>
      )}

      <SuggestedFollowUp
        countyFips={workspace.requestedFips}
        followUp={followUp}
        headingRef={followUpRef}
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
