"use client";

import { ArrowLeftRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromCompare } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import { CompareAlignedSheet } from "@/features/ux-reset/compare/compare-aligned-sheet";
import {
  CompareCountyPicker,
  type ReviewCategoryBadge,
} from "@/features/ux-reset/compare/compare-county-picker";
import {
  compareReviewCategoryTone,
  publishedReviewPriority,
  type CompareProfileAlignment,
} from "@/features/ux-reset/compare/compare-county-profile";
import { CompareCountyProfileSection } from "@/features/ux-reset/compare/compare-county-profile-section";
import { CompareEmptyGuide } from "@/features/ux-reset/compare/compare-empty-guide";
import {
  ComparePinnedPair,
  useScrolledOutOfView,
} from "@/features/ux-reset/compare/compare-pinned-pair";
import {
  compareOriginLabel,
  compareStatusErrors,
} from "@/features/ux-reset/compare/compare-status-errors";
import {
  CompareStatusStrip,
  type CompareLoadStep,
} from "@/features/ux-reset/compare/compare-status-strip";
import { CompareSurveillanceIntelligence } from "@/features/ux-reset/compare/compare-surveillance-intelligence";
import {
  COMPARE_LIMITATION_ROW_ID,
  reconcileAlignmentRows,
  sharedReleaseLimitation,
  tickAggregateNote,
  tickStatusRowNote,
  type ReconciledAlignmentRow,
} from "@/features/ux-reset/compare/compare-unified-rows";
import { buildCompareVisualRows } from "@/features/ux-reset/compare/compare-visual-model";
import type { CompareCountyIdentity } from "@/features/ux-reset/compare/compare-visual-parts";
import {
  CompareAdditionalObservations,
  CompareShareBar,
  CompareSourcesTable,
  type CompareSourceEntry,
} from "@/features/ux-reset/compare/compare-visual-sections";
import {
  compareOptionDisabled,
  useCompareWorkspace,
} from "@/features/ux-reset/compare/use-compare-workspace";
import {
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
import { PageIntroduction } from "@/features/ux-reset/page-introduction";
import { PAGE_INTRODUCTION_COPY } from "@/features/ux-reset/page-introduction-copy";
import { RESET_COMPARE_PATH } from "@/features/ux-reset/routes";
import { tier1ReleaseFromMetadata } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";

function profileSourceEntries(
  profile: CompareProfileAlignment
): CompareSourceEntry[] {
  return profile.rows.flatMap((row) => {
    const evidenceFor = (cell: (typeof row)["left"]) =>
      cell.kind === "evidence" ? [cell.evidence] : [];
    const left = evidenceFor(row.left);
    const right = evidenceFor(row.right);
    if (left.length === 0 && right.length === 0) {
      return [];
    }
    return [{ id: row.id, label: row.label, left, right }];
  });
}

function evidenceFromCell(
  cell: ReconciledAlignmentRow["row"]["left"]
): CompareSourceEntry["left"] {
  if (cell.kind !== "observations") {
    return [];
  }
  return cell.records.map((record) => record.evidence);
}

function alignmentSourceEntries(
  rows: readonly ReconciledAlignmentRow[],
  usedIds: ReadonlySet<string>
): CompareSourceEntry[] {
  const entries: CompareSourceEntry[] = [];
  for (const entry of rows) {
    const left = evidenceFromCell(entry.row.left);
    const right = evidenceFromCell(entry.row.right);
    if (left.length === 0 && right.length === 0) {
      continue;
    }
    const id = usedIds.has(entry.row.measureId)
      ? `${entry.row.measureId}-observation`
      : entry.row.measureId;
    entries.push({
      id,
      label: entry.row.measureLabel,
      left,
      right,
    });
  }
  return entries;
}

function reviewCategoryBadge(
  profile: CompareProfileAlignment | null,
  fips: string
): ReviewCategoryBadge | null {
  if (!profile || !fips) {
    return null;
  }
  const row = profile.rows.find((entry) => entry.id === "review_category");
  if (!row) {
    return null;
  }
  const cell =
    fips === profile.leftFips
      ? row.left
      : fips === profile.rightFips
        ? row.right
        : null;
  if (!cell || cell.kind !== "evidence") {
    return null;
  }
  const value = cell.evidence.displayValue.trim();
  if (!value || value === "Unavailable") {
    return null;
  }
  const priority = publishedReviewPriority(cell.evidence.valueNote);
  if (priority && compareReviewCategoryTone(priority)) {
    return { kind: "recognized", priority };
  }
  return { kind: "published", label: value };
}

const SELECTION_PROMPTS = [
  "Choose two counties to compare.",
  "One county is selected.",
] as const;

function isSelectionPrompt(message: string): boolean {
  return SELECTION_PROMPTS.some((prompt) => message.startsWith(prompt));
}

function selectionInstruction(
  messages: readonly string[],
  carriedForward: boolean
): string | null {
  const selection = messages.find((message) => isSelectionPrompt(message));
  if (!selection) {
    return null;
  }
  if (carriedForward && selection.startsWith("One county is selected.")) {
    return "Your Explorer county is carried forward. Choose a second county. Atlas will not select one for you.";
  }
  return selection;
}

function CompareExperienceInner() {
  const workspace = useCompareWorkspace();
  const pair = workspace.entry.pair;
  // The pair in the URL has no gaps. A county chosen for the second slot
  // before the first waits here until the first county is chosen.
  const [pendingSecond, setPendingSecond] = useState("");
  const pendingFips = pair.length === 0 ? pendingSecond : "";
  const pickersRef = useRef<HTMLFieldSetElement | null>(null);
  const pinned = useScrolledOutOfView(pickersRef, pair.length === 2);
  const leftFips = pair[0] ?? "";
  const rightFips = pair[1] ?? pendingFips;
  const leftOptions = compareOptionDisabled(workspace.options, rightFips);
  const rightOptions = compareOptionDisabled(workspace.options, leftFips);
  const leftOption = workspace.options.find(
    (option) => option.fips === leftFips
  );
  const rightOption = workspace.options.find(
    (option) => option.fips === rightFips
  );
  const searchParams = useSearchParams();
  const askContext = useMemo(
    () =>
      inheritedContextFromCompare({
        alignment: workspace.alignment,
        alignmentReady: Boolean(workspace.alignment && workspace.releaseId),
        counties:
          leftOption && rightOption
            ? [
                { fips: leftOption.fips, label: leftOption.label },
                { fips: rightOption.fips, label: rightOption.label },
              ]
            : [],
        releaseId: workspace.alignment ? workspace.releaseId : null,
      }),
    [leftOption, rightOption, workspace.alignment, workspace.releaseId]
  );
  const askHref = useMemo(() => {
    if (!askContext) {
      return null;
    }
    return resetAskAtlasWorkspaceHref(RESET_COMPARE_PATH, searchParams);
  }, [askContext, searchParams]);
  usePublishAskAtlasInheritedContext(askContext);
  usePublishExploreCommittedNavigation({
    county: null,
    compare: pair,
    dataset: workspace.releaseId,
    explorerReturnHref: workspace.returnHref,
    period: workspace.period,
  });
  const releaseLoadState = workspace.metadata
    ? releaseEvidenceLoadStateValues.ready
    : workspace.metadataError
      ? releaseEvidenceLoadStateValues.error
      : releaseEvidenceLoadStateValues.loading;
  const sharedLimitation = workspace.profile
    ? sharedReleaseLimitation(workspace.profile.rows)
    : null;
  const tickDecision = workspace.profile
    ? tickAggregateNote(workspace.profile.rows)
    : null;
  const reconciledRows = useMemo(
    () =>
      workspace.alignment
        ? reconcileAlignmentRows(workspace.profile, workspace.alignment.rows)
        : [],
    [workspace.alignment, workspace.profile]
  );
  const visualRows = useMemo(
    () =>
      workspace.profile
        ? buildCompareVisualRows(workspace.profile, {
            hideRowIds: tickDecision === "hide" ? ["tick_status"] : [],
            rowNote: (rowId) =>
              rowId === "tick_status"
                ? tickStatusRowNote(workspace.profile?.rows ?? [])
                : null,
          })
        : [],
    [tickDecision, workspace.profile]
  );
  const profileSources = workspace.profile
    ? profileSourceEntries(workspace.profile)
    : [];
  const sourceEntries: CompareSourceEntry[] = [
    ...profileSources,
    ...alignmentSourceEntries(
      reconciledRows,
      new Set(profileSources.map((entry) => entry.id))
    ),
  ];
  const limitationRow = workspace.profile?.rows.find(
    (row) => row.id === COMPARE_LIMITATION_ROW_ID
  );
  const countyLimitations: readonly [string, string] | null =
    limitationRow &&
    limitationRow.left.kind === "text" &&
    limitationRow.right.kind === "text" &&
    limitationRow.left.text.trim() !== limitationRow.right.text.trim()
      ? [limitationRow.left.text.trim(), limitationRow.right.text.trim()]
      : null;
  const leftLabel = leftOption?.label ?? leftFips;
  const rightLabel = rightOption?.label ?? rightFips;
  const counties: readonly [CompareCountyIdentity, CompareCountyIdentity] = [
    {
      fips: leftFips,
      label: leftLabel,
      letter: "A",
      countyName: leftOption?.countyName,
      stateLabel: leftOption?.stateLabel,
    },
    {
      fips: rightFips,
      label: rightLabel,
      letter: "B",
      countyName: rightOption?.countyName,
      stateLabel: rightOption?.stateLabel,
    },
  ];
  const resultsReady = Boolean(workspace.profile) || reconciledRows.length > 0;
  const tier1Release = tier1ReleaseFromMetadata({
    isError: Boolean(workspace.metadataError),
    isLoading: workspace.metadataLoading,
    releaseId: workspace.releaseId,
  });
  const surveillanceIntelligence =
    pair.length === 2 ? (
      <CompareSurveillanceIntelligence
        leftFips={leftFips}
        leftLabel={leftLabel}
        release={tier1Release}
        rightFips={rightFips}
        rightLabel={rightLabel}
      />
    ) : null;
  const handleSwapPair = () => {
    workspace.swapPair();
  };
  const handleRetryProfile = () => {
    workspace.retryProfile();
  };
  const pairInstruction = selectionInstruction(
    workspace.recoveryMessages,
    Boolean(workspace.returnTarget) && pair.length === 1
  );
  const issueMessages = workspace.recoveryMessages.filter(
    (message) => !isSelectionPrompt(message)
  );
  const originLabel =
    workspace.returnTarget && pair.length === 1
      ? compareOriginLabel(workspace.returnTarget)
      : null;
  const hasSelection = pair.length > 0 || Boolean(pendingFips);
  const statusErrors = compareStatusErrors({
    alignment: workspace.alignment,
    directoryError: workspace.directoryError,
    evidenceError: workspace.evidenceError,
    metadataError: workspace.metadataError,
    profile: workspace.profile,
    profileError: workspace.profileError,
    catalogError: workspace.catalogError,
  });
  const statusSteps: CompareLoadStep[] = [
    {
      done: !workspace.metadataLoading,
      id: "release",
      label: "Loading release information…",
    },
    {
      done: !workspace.directoryLoading,
      id: "counties",
      label: "Loading the county list…",
    },
    ...(pair.length === 2
      ? [
          {
            done: !(
              workspace.profileLoading ||
              (workspace.profileCoolingDown &&
                (!workspace.profileError || workspace.profileRetrying))
            ),
            id: "records",
            label: workspace.profileCoolingDown
              ? "Waiting for the server retry window…"
              : "Loading published county records…",
          },
          {
            done: !(
              workspace.evidenceLoading ||
              (workspace.catalogCoolingDown &&
                (!workspace.catalogError || workspace.catalogRetrying))
            ),
            id: "observations",
            label: workspace.catalogCoolingDown
              ? "Waiting for the server retry window before requesting the measure catalog again."
              : workspace.profile
                ? "Loading additional observations…"
                : "Loading aligned evidence…",
          },
        ]
      : []),
  ];
  const retryTargets = {
    catalog: Boolean(workspace.catalogError) || workspace.catalogCoolingDown,
    evidence: Boolean(workspace.evidenceError),
    profile:
      Boolean(workspace.profileError) ||
      Boolean(workspace.profile?.retryable) ||
      workspace.profileCoolingDown,
  };
  // The button stays usable during a server retry window so a retry can be
  // queued. It is disabled only while a retry is already running or waiting.
  const retryWaiting =
    (workspace.catalogCoolingDown &&
      (!workspace.catalogError || workspace.catalogRetrying)) ||
    (workspace.profileCoolingDown &&
      (!workspace.profileError || workspace.profileRetrying));
  const retryBusy =
    retryWaiting ||
    workspace.catalogRetrying ||
    workspace.evidenceRetrying ||
    workspace.profileRetrying;
  const statusRetry =
    pair.length === 2 &&
    (retryTargets.catalog || retryTargets.evidence || retryTargets.profile)
      ? {
          busy: retryBusy,
          label: retryWaiting
            ? "Waiting for the server retry window…"
            : retryBusy
              ? "Retrying…"
              : "Retry what did not load",
          waiting: retryWaiting,
          onRetry: () => {
            if (retryTargets.catalog) {
              workspace.retryCatalog();
            }
            if (retryTargets.evidence) {
              void workspace.retryEvidence();
            }
            if (retryTargets.profile) {
              handleRetryProfile();
            }
          },
        }
      : null;

  return (
    <div
      className="ux-reset-compare"
      data-ask-atlas="optional"
      data-fips={pair.join(",")}
      data-page="compare"
      data-pinned={pinned ? "true" : "false"}
      data-pair-issue={workspace.pairIssue}
      data-query-pair={pair.join(",")}
      data-catalog-cooling={workspace.catalogCoolingDown ? "true" : "false"}
      data-recovery={workspace.recoveryState}
      data-return={workspace.returnTarget ?? ""}
      data-explorer-return={workspace.returnHref ?? ""}
      data-stale-url={workspace.entry.staleUrlIgnored ? "true" : "false"}
      data-testid="compare-workspace"
    >
      <ComparePinnedPair
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        visible={pinned}
        onEdit={() => {
          pickersRef.current?.scrollIntoView({
            behavior: "auto",
            block: "start",
          });
          pickersRef.current?.querySelector("input")?.focus();
        }}
        onSwap={handleSwapPair}
      />
      <header className="ux-reset-compare-header">
        <PageIntroduction page="compare" />
      </header>

      <fieldset className="ux-reset-compare-pair" ref={pickersRef}>
        <legend className="sr-only">Counties to compare</legend>
        <div
          data-fips={pair.join(",")}
          data-stale-url={workspace.entry.staleUrlIgnored ? "true" : "false"}
          data-testid="compare-pair"
        >
          <p className="sr-only">
            {pair.length === 2
              ? `${leftOption?.label ?? leftFips} and ${rightOption?.label ?? rightFips}`
              : (leftOption?.label ?? (leftFips || "No counties selected."))}
          </p>
        </div>
        <div className="ux-reset-compare-slots">
          <CompareCountyPicker
            clearLabel="Clear first county"
            evidenceHref={leftFips ? workspace.investigateHref(leftFips) : null}
            evidenceLabel={leftFips ? countyEvidenceLinkLabel(0) : null}
            label="First county"
            letter="A"
            options={leftOptions}
            reviewCategory={reviewCategoryBadge(workspace.profile, leftFips)}
            selectedFips={leftFips}
            testId="compare-slot-0"
            onClear={
              leftFips
                ? () => {
                    workspace.removeMember(leftFips);
                  }
                : null
            }
            onSelect={(fips) => {
              if (pendingFips) {
                workspace.setPair([fips, pendingFips]);
                setPendingSecond("");
                return;
              }
              workspace.setSlot(0, fips);
            }}
          />
          <Button
            aria-label="Swap first and second county"
            className="ux-reset-compare-swap"
            data-testid="compare-swap"
            disabled={pair.length !== 2}
            size="icon"
            type="button"
            variant="outline"
            onClick={handleSwapPair}
          >
            <ArrowLeftRight aria-hidden="true" />
          </Button>
          <CompareCountyPicker
            autoFocus={Boolean(originLabel)}
            clearLabel="Clear second county"
            evidenceHref={
              rightFips ? workspace.investigateHref(rightFips) : null
            }
            evidenceLabel={rightFips ? countyEvidenceLinkLabel(1) : null}
            label="Second county"
            letter="B"
            options={rightOptions}
            reviewCategory={reviewCategoryBadge(workspace.profile, rightFips)}
            selectedFips={rightFips}
            testId="compare-slot-1"
            onClear={
              rightFips
                ? () => {
                    if (pendingFips) {
                      setPendingSecond("");
                      return;
                    }
                    workspace.removeMember(rightFips);
                  }
                : null
            }
            onSelect={(fips) => {
              if (pair.length === 0) {
                setPendingSecond(fips);
                return;
              }
              workspace.setSlot(1, fips);
            }}
          />
        </div>
        {originLabel || hasSelection ? (
          <div className="ux-reset-compare-pair-actions">
            {originLabel ? (
              <p
                className="ux-reset-compare-origin"
                data-testid="compare-origin"
              >
                {originLabel}: {leftLabel}
              </p>
            ) : null}
            {hasSelection ? (
              <Button
                aria-label="Clear both counties"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  setPendingSecond("");
                  workspace.clearPair();
                }}
              >
                Clear both
              </Button>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <div data-testid="compare-recovery" role="status">
        {pairInstruction ? (
          <p className="ux-reset-compare-empty" data-testid="compare-empty">
            {pairInstruction}
          </p>
        ) : null}
        {issueMessages.map((message) => (
          <p key={message}>{message}</p>
        ))}
        {workspace.slotMessage ? <p>{workspace.slotMessage}</p> : null}
      </div>

      {hasSelection ? null : <CompareEmptyGuide />}

      <CompareStatusStrip
        errors={statusErrors}
        reserve={pair.length === 2}
        retry={statusRetry}
        steps={statusSteps}
      />

      {pair.length === 2 ? (
        <section
          aria-labelledby="compare-results-title"
          className="ux-reset-compare-unified"
        >
          <div className="ux-reset-compare-results-head">
            <h2
              className="ux-reset-compare-results-title"
              id="compare-results-title"
            >
              County comparison
            </h2>
            {resultsReady ? (
              <CompareShareBar
                askHref={askHref}
                counties={[leftOption, rightOption].flatMap((option) =>
                  option
                    ? [
                        {
                          countyName: option.countyName,
                          fips: option.fips,
                          label: option.label,
                          stateCode: option.stateCode,
                        },
                      ]
                    : []
                )}
                releaseId={workspace.releaseId ?? ""}
              />
            ) : null}
          </div>
          <CompareCountyProfileSection
            alignment={workspace.profile}
            coolingDown={workspace.profileCoolingDown}
            embedded
            error={workspace.profileError}
            leftLabel={leftLabel}
            loading={workspace.profileLoading}
            period={workspace.period}
            retrying={workspace.profileRetrying}
            rightLabel={rightLabel}
            showPeriodNote={false}
            onRetry={handleRetryProfile}
          />
          {workspace.profileLoading && !workspace.profile ? (
            <div
              aria-hidden="true"
              className="ux-reset-compare-skeleton"
              data-testid="compare-skeleton"
            >
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {workspace.profile ? (
            <div
              data-testid={
                workspace.alignment ? "compare-alignment" : undefined
              }
            >
              <div
                data-testid={workspace.profile ? "compare-profile" : undefined}
              >
                <CompareAlignedSheet
                  counties={counties}
                  countyLimitations={countyLimitations}
                  model={surveillanceIntelligence}
                  period={workspace.period}
                  profile={workspace.profile}
                  rows={visualRows}
                  sharedLimitation={sharedLimitation}
                  sourceEntries={sourceEntries}
                  supplemental={reconciledRows}
                />
              </div>
            </div>
          ) : (
            <>
              {workspace.profileError ? surveillanceIntelligence : null}
              {reconciledRows.length > 0 ? (
                <div data-testid="compare-alignment">
                  <CompareAdditionalObservations
                    counties={counties}
                    rows={reconciledRows}
                  />
                </div>
              ) : null}
              {sourceEntries.length > 0 ? (
                <CompareSourcesTable
                  counties={counties}
                  entries={sourceEntries}
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <details className="ux-reset-explorer-release">
        <summary>Release and coverage</summary>
        <p className="type-small">Review scope {workspace.scopeLabel}.</p>
        <p className="type-small">{PAGE_INTRODUCTION_COPY.compare.stripBody}</p>
        <ReleaseEvidenceStateStrip
          context={
            workspace.metadata
              ? releaseEvidenceContextFromMetadata(workspace.metadata)
              : null
          }
          errorMessage={workspace.metadataError}
          loadState={releaseLoadState}
        />
      </details>
    </div>
  );
}

function countyEvidenceLinkLabel(index: 0 | 1): string {
  switch (index) {
    case 0: {
      return "View county evidence for the first county";
    }
    case 1: {
      return "View county evidence for the second county";
    }
    default: {
      const exhaustive: never = index;
      return exhaustive;
    }
  }
}

export function ResetCompareExperience() {
  return (
    <Suspense
      fallback={
        <AtlasStatusMessage tone="loading">
          Loading comparison…
        </AtlasStatusMessage>
      }
    >
      <CompareExperienceInner />
    </Suspense>
  );
}
