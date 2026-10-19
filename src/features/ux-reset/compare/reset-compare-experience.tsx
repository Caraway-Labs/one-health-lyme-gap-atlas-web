"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { AtlasPriorityBadge } from "@/components/atlas-priority-badge";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromCompare } from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  ASK_ATLAS_PAGE_REFERENCE_PARAM,
  askAtlasEntryHref,
} from "@/features/ux-reset/ask-atlas/page-reference";
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

type ReviewCategoryBadge =
  | { kind: "published"; label: string }
  | { kind: "recognized"; priority: string };

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
  const leftFips = pair[0] ?? "";
  const rightFips = pair[1] ?? "";
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
    const href = askAtlasEntryHref({
      context: askContext,
      pathname: RESET_COMPARE_PATH,
      searchParams,
    });
    return href.includes(`${ASK_ATLAS_PAGE_REFERENCE_PARAM}=`) ? href : null;
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
                description:
                  "These limitations differ by county. A shared release limitation is stated once above the comparison.",
                id: "limitations",
                rowIds: [COMPARE_LIMITATION_ROW_ID],
                title: "Evidence gaps and limitations",
              } satisfies CompareProfileGroup,
            ]
          : []),
      ]
    : [];
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
      <header className="ux-reset-compare-header">
        <PageIntroduction page="compare" />
      </header>

      <fieldset className="ux-reset-compare-pair">
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
          <CountySlot
            clearLabel="Clear first county"
            disabled={false}
            evidenceHref={leftFips ? workspace.investigateHref(leftFips) : null}
            evidenceLabel={leftFips ? countyEvidenceLinkLabel(0) : null}
            fips={leftFips}
            label="First county"
            options={leftOptions}
            reviewCategory={reviewCategoryBadge(workspace.profile, leftFips)}
            selectedCounty={leftOption?.countyName}
            selectedFips={leftFips}
            selectedLabel={leftOption?.label}
            selectedState={leftOption?.stateLabel}
            testId="compare-slot-0"
            onClear={
              leftFips
                ? () => {
                    workspace.removeMember(leftFips);
                  }
                : null
            }
            onSelect={(fips) => {
              workspace.setSlot(0, fips);
            }}
          />
          <CountySlot
            clearLabel="Clear second county"
            disabled={pair.length === 0}
            evidenceHref={
              rightFips ? workspace.investigateHref(rightFips) : null
            }
            evidenceLabel={rightFips ? countyEvidenceLinkLabel(1) : null}
            fips={rightFips}
            label="Second county"
            options={rightOptions}
            reviewCategory={reviewCategoryBadge(workspace.profile, rightFips)}
            selectedCounty={rightOption?.countyName}
            selectedFips={rightFips}
            selectedLabel={rightOption?.label}
            selectedState={rightOption?.stateLabel}
            testId="compare-slot-1"
            onClear={
              rightFips
                ? () => {
                    workspace.removeMember(rightFips);
                  }
                : null
            }
            onSelect={(fips) => {
              workspace.setSlot(1, fips);
            }}
          />
        </div>
        {pair.length === 2 ? (
          <div className="ux-reset-compare-pair-actions">
            <Button
              aria-label="Clear both counties"
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                workspace.clearPair();
              }}
            >
              Clear both
            </Button>
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
      {workspace.directoryError ? (
        <AtlasStatusMessage tone="error">
          {workspace.directoryError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.catalogCoolingDown ? (
        <AtlasStatusMessage
          action={
            workspace.catalogError ? null : (
              <Button
                aria-busy
                data-testid="compare-retry-catalog"
                data-waiting="true"
                disabled
                type="button"
                variant="secondary"
              >
                Waiting for the server retry window…
              </Button>
            )
          }
          tone="loading"
        >
          <p data-testid="compare-catalog-wait">
            Waiting for the server retry window before requesting the measure
            catalog again.
          </p>
        </AtlasStatusMessage>
      ) : null}
      {workspace.catalogError ? (
        <AtlasStatusMessage
          action={
            <Button
              aria-busy={workspace.catalogRetrying}
              data-testid="compare-retry-catalog"
              data-waiting={
                workspace.catalogCoolingDown && workspace.catalogRetrying
                  ? "true"
                  : "false"
              }
              disabled={workspace.catalogRetrying}
              type="button"
              variant="secondary"
              onClick={() => {
                workspace.retryCatalog();
              }}
            >
              {workspace.catalogCoolingDown && workspace.catalogRetrying
                ? "Waiting for the server retry window…"
                : "Retry measure catalog"}
            </Button>
          }
          tone="error"
        >
          {workspace.catalogError}
        </AtlasStatusMessage>
      ) : null}
      {workspace.evidenceLoading && !workspace.catalogCoolingDown ? (
        <AtlasStatusMessage tone="loading">
          {workspace.profile
            ? "County records are visible. Additional observations are still loading."
            : "Loading aligned evidence…"}
        </AtlasStatusMessage>
      ) : null}
      {workspace.evidenceError ? (
        <AtlasStatusMessage tone="error">
          {workspace.evidenceError}
        </AtlasStatusMessage>
      ) : null}
      {failedMeasures ? (
        <AtlasStatusMessage
          action={
            <Button
              aria-busy={workspace.evidenceRetrying}
              data-testid="compare-retry-evidence"
              disabled={workspace.evidenceRetrying}
              type="button"
              variant="secondary"
              onClick={() => {
                void workspace.retryEvidence();
              }}
            >
              {workspace.evidenceRetrying
                ? "Retrying evidence…"
                : "Retry evidence that did not load"}
            </Button>
          }
          tone="error"
        >
          Some measures could not be loaded. Evidence that loaded stays in this
          comparison.
          {failedLabels.length > 0
            ? ` Affected measures: ${failedLabels.join(", ")}.`
            : ""}
        </AtlasStatusMessage>
      ) : null}

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
                      alignment={workspace.profile}
                      groups={profileGroups}
                      leftLabel={leftLabel}
                      rightLabel={rightLabel}
                    />
                  ) : null}
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

function ReviewCategoryMark({
  badge,
  fips,
}: {
  badge: ReviewCategoryBadge;
  fips: string;
}) {
  const testId = `compare-review-category-${fips}`;
  switch (badge.kind) {
    case "recognized": {
      const tone = compareReviewCategoryTone(badge.priority);
      if (!tone) {
        return (
          <Badge
            data-review-tone="neutral"
            data-testid={testId}
            variant="outline"
          >
            {badge.priority}
          </Badge>
        );
      }
      return (
        <span data-review-tone={tone} data-testid={testId}>
          <AtlasPriorityBadge priority={badge.priority} />
        </span>
      );
    }
    case "published": {
      return (
        <Badge
          data-review-tone="neutral"
          data-testid={testId}
          variant="outline"
        >
          {badge.label}
        </Badge>
      );
    }
    default: {
      const exhaustive: never = badge;
      return exhaustive;
    }
  }
}

function CountySlot({
  clearLabel,
  disabled,
  evidenceHref,
  evidenceLabel,
  fips,
  label,
  onClear,
  onSelect,
  options,
  reviewCategory,
  selectedCounty,
  selectedFips,
  selectedLabel,
  selectedState,
  testId,
}: {
  clearLabel: string;
  disabled: boolean;
  evidenceHref: string | null;
  evidenceLabel: string | null;
  fips: string;
  label: string;
  onClear: (() => void) | null;
  onSelect: (fips: string) => void;
  options: readonly { disabled: boolean; fips: string; label: string }[];
  reviewCategory: ReviewCategoryBadge | null;
  selectedCounty: string | undefined;
  selectedFips: string;
  selectedLabel: string | undefined;
  selectedState: string | undefined;
  testId: string;
}) {
  return (
    <div className="ux-reset-compare-slot">
      <div className="ux-reset-compare-slot-label">
        <span className="type-small">{label}</span>
        {reviewCategory ? (
          <ReviewCategoryMark badge={reviewCategory} fips={fips} />
        ) : null}
      </div>
      <Select
        disabled={disabled}
        value={selectedFips || null}
        onValueChange={(next) => {
          if (!next) {
            return;
          }
          onSelect(next);
        }}
      >
        <SelectTrigger
          aria-label={label}
          className="h-8 w-full"
          data-testid={testId}
        >
          <SelectValue placeholder={`Choose the ${label.toLowerCase()}`}>
            {selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              disabled={option.disabled}
              key={option.fips}
              value={option.fips}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedFips ? (
        <p className="ux-reset-compare-identity">
          <span className="ux-reset-compare-county-name">
            {selectedCounty ?? selectedLabel ?? fips}
          </span>
          <span className="ux-reset-compare-fips">
            {selectedState ? `${selectedState} · ` : ""}FIPS {fips}
          </span>
        </p>
      ) : null}
      {onClear || (evidenceHref && evidenceLabel) ? (
        <div className="ux-reset-compare-slot-actions">
          {onClear ? (
            <Button
              aria-label={clearLabel}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClear}
            >
              Clear
            </Button>
          ) : null}
          {evidenceHref && evidenceLabel ? (
            <Link
              aria-label={evidenceLabel}
              className={cn(
                buttonVariants({ size: "sm", variant: "link" }),
                "ux-reset-compare-action"
              )}
              data-fips={fips}
              data-testid={`compare-investigate-${fips}`}
              data-variant="link"
              href={evidenceHref}
            >
              View county evidence
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
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
