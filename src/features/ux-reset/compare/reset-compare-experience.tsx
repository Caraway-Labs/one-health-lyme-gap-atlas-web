"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";

import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromCompare } from "@/features/ux-reset/ask-atlas/inherited-context";
import { resetAskAtlasWorkspaceHref } from "@/features/ux-reset/ask-atlas/workspace-href";
import type {
  CompareAlignedRow,
  CompareAlignment,
  CompareCell,
  CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import {
  CompareCompactEvidence,
  compareReaderState,
} from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  CompareCountyPicker,
  type ReviewCategoryBadge,
} from "@/features/ux-reset/compare/compare-county-picker";
import {
  compareReviewCategoryTone,
  publishedReviewPriority,
  type CompareProfileAlignment,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  CompareCountyProfileSection,
  CompareEvidenceGroup,
  ComparePairedValues,
  ComparePeriodQualification,
  CompareProfileGroups,
  type CompareProfileGroup,
} from "@/features/ux-reset/compare/compare-county-profile-section";
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
  COMPARE_COMMUNITY_ROW_IDS,
  COMPARE_HUMAN_ROW_IDS,
  COMPARE_LIMITATION_ROW_ID,
  COMPARE_REVIEW_ROW_IDS,
  COMPARE_SCORE_ROW_IDS,
  COMPARE_STATE_CONTEXT_ROW_ID,
  COMPARE_VECTOR_ROW_IDS,
  reconcileAlignmentRows,
  sharedReleaseLimitation,
  tickAggregateNote,
  tickStatusRowNote,
} from "@/features/ux-reset/compare/compare-unified-rows";
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
import { cn } from "@/lib/utils";

function relationText(relation: CompareRelation): string {
  switch (relation.kind) {
    case "similar": {
      return "Same value";
    }
    case "different": {
      return `Values differ by ${relation.absoluteDifference}.`;
    }
    case "withheld": {
      return relation.explanation;
    }
    default: {
      const exhaustive: never = relation;
      return exhaustive;
    }
  }
}

function relationReasons(relation: CompareRelation): string {
  if (relation.kind !== "withheld") {
    return "";
  }
  return relation.reasons.join(",");
}

function CompareCellView({
  cell,
  fips,
  measureId,
}: {
  cell: CompareCell;
  fips: string;
  measureId: string;
}) {
  if (cell.kind === "empty") {
    return (
      <div
        data-fips={fips}
        data-measure-id={measureId}
        data-observation={cell.reason}
        data-testid={`compare-cell-${measureId}-${fips}`}
      >
        <p>{compareReaderState(cell.reason, cell.message)}</p>
      </div>
    );
  }
  return (
    <div
      data-fips={fips}
      data-measure-id={measureId}
      data-observation="present"
      data-testid={`compare-cell-${measureId}-${fips}`}
    >
      {cell.records.map((record) => (
        <CompareCompactEvidence
          key={record.observation.observation_id}
          model={record.evidence}
        />
      ))}
    </div>
  );
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

function failedMeasureLabels(alignment: CompareAlignment | null): string[] {
  if (!alignment) {
    return [];
  }
  const labels: string[] = [];
  for (const outcome of alignment.outcomes) {
    if (outcome.status !== "failed") {
      continue;
    }
    const row = alignment.rows.find(
      (entry) => entry.measureId === outcome.measureId
    );
    labels.push(row?.measureLabel ?? outcome.measureId);
  }
  return labels;
}

function summaryCounts(rows: readonly CompareAlignedRow[]) {
  let different = 0;
  let similar = 0;
  let withheld = 0;
  for (const row of rows) {
    switch (row.relation.kind) {
      case "different": {
        different += 1;
        break;
      }
      case "similar": {
        similar += 1;
        break;
      }
      case "withheld": {
        withheld += 1;
        break;
      }
      default: {
        const exhaustive: never = row.relation;
        return exhaustive;
      }
    }
  }
  return { different, similar, withheld };
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
  const reconciledRows = useMemo(
    () =>
      workspace.alignment
        ? reconcileAlignmentRows(workspace.profile, workspace.alignment.rows)
        : [],
    [workspace.alignment, workspace.profile]
  );
  const counts = useMemo(
    () =>
      workspace.alignment
        ? summaryCounts(reconciledRows.map((entry) => entry.row))
        : null,
    [reconciledRows, workspace.alignment]
  );
  const sharedLimitation = workspace.profile
    ? sharedReleaseLimitation(workspace.profile.rows)
    : null;
  const tickDecision = workspace.profile
    ? tickAggregateNote(workspace.profile.rows)
    : null;
  const vectorRowIds = COMPARE_VECTOR_ROW_IDS.filter(
    (rowId) => rowId !== "tick_status" || tickDecision !== "hide"
  );
  const limitationRow = workspace.profile?.rows.find(
    (row) => row.id === COMPARE_LIMITATION_ROW_ID
  );
  const limitationTextsDiffer = Boolean(
    limitationRow &&
    limitationRow.left.kind === "text" &&
    limitationRow.right.kind === "text" &&
    limitationRow.left.text.trim() !== limitationRow.right.text.trim()
  );
  const failedMeasures =
    workspace.alignment?.outcomes.some(
      (outcome) => outcome.status === "failed"
    ) ?? false;
  const failedLabels = failedMeasureLabels(workspace.alignment);
  const overviewCounts = counts && reconciledRows.length > 0 ? counts : null;
  const leftLabel = leftOption?.label ?? leftFips;
  const rightLabel = rightOption?.label ?? rightFips;
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
  const profileGroups: CompareProfileGroup[] = workspace.profile
    ? [
        {
          id: "review",
          rowIds: COMPARE_REVIEW_ROW_IDS,
          title: "Review category and reasons",
        },
        {
          id: "human",
          rowIds: COMPARE_HUMAN_ROW_IDS,
          title: "Human disease surveillance",
        },
        {
          id: "vector",
          rowIds: vectorRowIds,
          rowNote: (rowId) =>
            rowId === "tick_status"
              ? tickStatusRowNote(workspace.profile?.rows ?? [])
              : null,
          title: "Tick, vector, and pathogen observations",
        },
        {
          id: "community",
          rowIds: COMPARE_COMMUNITY_ROW_IDS,
          title: "Population and community context",
        },
        {
          description:
            "State-unallocated human records are not county case counts.",
          id: "state-context",
          rowIds: [COMPARE_STATE_CONTEXT_ROW_ID],
          title: "State-level reporting context",
        },
        {
          description:
            "Published score components. They are not case counts, and this comparison does not rank the counties.",
          id: "scores",
          rowIds: COMPARE_SCORE_ROW_IDS,
          title: "Score components",
        },
        ...(limitationTextsDiffer
          ? [
              {
                description: "These limitations differ by county.",
                id: "limitations",
                rowIds: [COMPARE_LIMITATION_ROW_ID],
                title: "Evidence gaps and limitations",
              } satisfies CompareProfileGroup,
            ]
          : []),
      ]
    : [];
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
    failedLabels,
    failedMeasures,
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
    evidence: failedMeasures || Boolean(workspace.evidenceError),
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
          <h2
            className="ux-reset-compare-results-title"
            id="compare-results-title"
          >
            County comparison
          </h2>
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
          {workspace.profile || reconciledRows.length > 0 ? (
            <>
              <div
                data-testid={
                  workspace.alignment ? "compare-alignment" : undefined
                }
              >
                <div
                  data-testid={
                    workspace.profile ? "compare-profile" : undefined
                  }
                >
                  {workspace.profile ? (
                    <CompareProfileGroups
                      afterContent={surveillanceIntelligence}
                      afterGroupId="human"
                      alignment={workspace.profile}
                      groups={profileGroups}
                      leftLabel={leftLabel}
                      rightLabel={rightLabel}
                    />
                  ) : null}
                  {!workspace.profile && workspace.profileError
                    ? surveillanceIntelligence
                    : null}
                  {reconciledRows.length > 0 ? (
                    <CompareEvidenceGroup
                      columnLabels={[leftLabel, rightLabel]}
                      defaultOpen={!workspace.profile}
                      key={
                        workspace.profile ? "with-profile" : "alignment-only"
                      }
                      description="Catalog observations kept when their period or value is not the same county-record row. A comparison is withheld when the governed fields do not support one."
                      testId="compare-group-additional"
                      title="Additional observations"
                    >
                      {reconciledRows.map((entry, index) => (
                        <article
                          className="ux-reset-compare-item"
                          data-measure-id={entry.row.measureId}
                          data-row-index={index}
                          data-testid={`compare-row-${entry.row.measureId}`}
                          key={entry.row.measureId}
                        >
                          <h4>{entry.row.measureLabel}</h4>
                          <p className="type-small">{entry.row.measureId}</p>
                          {entry.note ? (
                            <p className="type-small">{entry.note}</p>
                          ) : null}
                          <p
                            data-reasons={relationReasons(entry.row.relation)}
                            data-relation={entry.row.relation.kind}
                            data-signed-difference={
                              entry.row.relation.kind === "different"
                                ? String(entry.row.relation.signedDifference)
                                : ""
                            }
                            data-testid={`compare-relation-${entry.row.measureId}`}
                          >
                            {relationText(entry.row.relation)}
                          </p>
                          <ComparePairedValues
                            left={
                              <CompareCellView
                                cell={entry.row.left}
                                fips={workspace.alignment?.leftFips ?? leftFips}
                                measureId={entry.row.measureId}
                              />
                            }
                            leftLabel={leftLabel}
                            right={
                              <CompareCellView
                                cell={entry.row.right}
                                fips={
                                  workspace.alignment?.rightFips ?? rightFips
                                }
                                measureId={entry.row.measureId}
                              />
                            }
                            rightLabel={rightLabel}
                          />
                        </article>
                      ))}
                    </CompareEvidenceGroup>
                  ) : null}
                </div>
              </div>
              <CompareOverview
                counts={overviewCounts}
                partial={failedMeasures}
              />
              {sharedLimitation ? (
                <details className="ux-reset-compare-shared-note">
                  <summary>Shared release limitations</summary>
                  <p>{sharedLimitation}</p>
                </details>
              ) : null}
              <ComparePeriodQualification period={workspace.period} />
            </>
          ) : workspace.profileError ? (
            surveillanceIntelligence
          ) : null}
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

      {askHref ? (
        <nav
          aria-label="Continue from this comparison"
          className="ux-reset-compare-next"
        >
          <Link
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "ux-reset-compare-action"
            )}
            data-testid="compare-ask-atlas"
            data-variant="secondary"
            href={askHref}
          >
            Ask Atlas about this comparison
          </Link>
        </nav>
      ) : null}
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

function CompareOverview({
  counts,
  partial,
}: {
  counts: { different: number; similar: number; withheld: number } | null;
  partial: boolean;
}) {
  return (
    <section
      aria-labelledby="compare-overview-title"
      className="ux-reset-compare-overview"
      data-testid="compare-summary"
    >
      <h2 className="sr-only" id="compare-overview-title">
        Comparison overview
      </h2>
      {counts ? (
        <ul className="ux-reset-compare-overview-counts">
          <li data-testid="compare-count-similar">
            <strong>{counts.similar}</strong>
            <span>Shared comparable values</span>
          </li>
          <li data-testid="compare-count-different">
            <strong>{counts.different}</strong>
            <span>Differing comparable values</span>
          </li>
          <li data-testid="compare-count-withheld">
            <strong>{counts.withheld}</strong>
            <span>Comparisons withheld</span>
          </li>
        </ul>
      ) : null}
      {partial ? (
        <p data-testid="compare-overview-partial">
          Some additional observations did not load. Those failed requests stay
          in the withheld count. They are not treated as matched, shared, or
          different. Loaded county records stay visible.
        </p>
      ) : null}
      <details className="ux-reset-compare-overview-note">
        <summary>How these counts are defined</summary>
        {counts ? (
          <p className="type-small">
            Shared and differing counts include only additional catalog
            observations whose measure, unit, period, release, and method match.
            Withheld counts are not comparable: one side may be missing, a
            request may have failed, or the unit, period, release, or method may
            differ. Withheld observations are not counted as shared or
            different. Zero differing observations does not mean the counties
            are equivalent. A missing value stays missing and is not zero.
          </p>
        ) : (
          <p className="type-small">
            A missing value stays missing and is not zero. County-record rows
            stay published values. This page does not calculate a difference for
            them.
          </p>
        )}
      </details>
    </section>
  );
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
