"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePublishAskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/ask-atlas-context";
import { inheritedContextFromCompare } from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  ASK_ATLAS_PAGE_REFERENCE_PARAM,
  askAtlasEntryHref,
} from "@/features/ux-reset/ask-atlas/page-reference";
import type {
  CompareAlignedRow,
  CompareCell,
  CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import {
  CompareCompactEvidence,
  compareReaderState,
} from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  CompareCountyProfileSection,
  CompareProfileRows,
} from "@/features/ux-reset/compare/compare-county-profile-section";
import { compareReturnLabel } from "@/features/ux-reset/compare/compare-entry";
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
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/paths";
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

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
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
  const handleRetryProfile = () => {
    workspace.retryProfile();
  };

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
      data-stale-url={workspace.entry.staleUrlIgnored ? "true" : "false"}
      data-testid="compare-workspace"
    >
      <header className="ux-reset-compare-header">
        <div>
          <h1>Compare counties</h1>
          <p>Inspect two county evidence profiles side by side.</p>
        </div>
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "ux-reset-compare-action"
          )}
          data-return={workspace.returnTarget ?? "review"}
          data-testid="compare-return"
          data-variant="secondary"
          href={workspace.returnHref ?? ATLAS_EXPLORER_PATH}
        >
          {workspace.returnTarget
            ? compareReturnLabel(workspace.returnTarget)
            : "Return to Explorer"}
        </Link>
      </header>

      <fieldset className="ux-reset-compare-pair">
        <legend className="sr-only">Counties to compare</legend>
        <div
          data-fips={pair.join(",")}
          data-stale-url={workspace.entry.staleUrlIgnored ? "true" : "false"}
          data-testid="compare-pair"
        >
          <p className="type-small">
            {pair.length === 2
              ? `${leftOption?.label ?? leftFips} and ${rightOption?.label ?? rightFips}`
              : (leftOption?.label ?? (leftFips || "No counties selected."))}
          </p>
        </div>
        <div className="ux-reset-compare-slots">
          <CountySlot
            disabled={false}
            label="First county"
            options={leftOptions}
            selectedFips={leftFips}
            selectedLabel={leftOption?.label}
            testId="compare-slot-0"
            onSelect={(fips) => {
              workspace.setSlot(0, fips);
            }}
          />
          <CountySlot
            disabled={pair.length === 0}
            label="Second county"
            options={rightOptions}
            selectedFips={rightFips}
            selectedLabel={rightOption?.label}
            testId="compare-slot-1"
            onSelect={(fips) => {
              workspace.setSlot(1, fips);
            }}
          />
        </div>
        <div className="ux-reset-compare-pair-actions">
          {leftFips ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                workspace.removeMember(leftFips);
              }}
            >
              Remove {leftOption?.label ?? leftFips}
            </Button>
          ) : null}
          {rightFips ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                workspace.removeMember(rightFips);
              }}
            >
              Clear second county
            </Button>
          ) : null}
          {pair.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                workspace.clearPair();
              }}
            >
              Clear counties
            </Button>
          ) : null}
        </div>
      </fieldset>

      {pair.length === 0 ? (
        <section className="ux-reset-compare-empty" data-testid="compare-empty">
          <h2>No counties selected</h2>
          <p>
            Choose the first and second county. Atlas will not select counties
            for you.
          </p>
        </section>
      ) : null}
      {pair.length === 1 ? (
        <section className="ux-reset-compare-empty" data-testid="compare-empty">
          <h2>Choose a second county</h2>
          <p>
            {workspace.returnTarget
              ? "Your Explorer county is carried forward. Select another county explicitly; Atlas does not choose a neighbor for you."
              : "Select another county explicitly. Atlas does not choose a neighbor for you."}
          </p>
        </section>
      ) : null}

      <div data-testid="compare-recovery" role="status">
        {workspace.recoveryMessages.map((message) => (
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
        </AtlasStatusMessage>
      ) : null}

      {pair.length === 2 ? (
        <section className="ux-reset-compare-unified">
          <h2 className="sr-only">County comparison</h2>
          <CompareCountyProfileSection
            alignment={workspace.profile}
            coolingDown={workspace.profileCoolingDown}
            embedded
            error={workspace.profileError}
            leftLabel={leftOption?.label ?? leftFips}
            loading={workspace.profileLoading}
            period={workspace.period}
            retrying={workspace.profileRetrying}
            rightLabel={rightOption?.label ?? rightFips}
            onRetry={handleRetryProfile}
          />
          {workspace.profile || reconciledRows.length > 0 ? (
            <>
              {sharedLimitation ? (
                <details className="ux-reset-compare-shared-note">
                  <summary>Shared release limitations</summary>
                  <p>{sharedLimitation}</p>
                </details>
              ) : null}
              {counts && reconciledRows.length > 0 ? (
                <p className="type-small" data-testid="compare-summary">
                  {countPhrase(
                    counts.similar,
                    "additional measure shares",
                    "additional measures share"
                  )}{" "}
                  the same value.{" "}
                  {countPhrase(
                    counts.different,
                    "measure differs",
                    "measures differ"
                  )}
                  .{" "}
                  {countPhrase(
                    counts.withheld,
                    "comparison is",
                    "comparisons are"
                  )}{" "}
                  withheld. A missing value stays missing and is not zero.
                </p>
              ) : (
                <p className="type-small">
                  A missing value stays missing and is not zero.
                </p>
              )}
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
                  <Table>
                    <TableCaption>
                      One comparison. Review, human surveillance, tick and
                      pathogen evidence, then community context. A catalog
                      observation stays only when its period or value is not the
                      same record.
                    </TableCaption>
                    <colgroup>
                      <col className="ux-reset-compare-col-measure" />
                      <col className="ux-reset-compare-col-county" />
                      <col className="ux-reset-compare-col-county" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={compareCellClass} scope="col">
                          Evidence measure
                        </TableHead>
                        <CountyColumnHead
                          evidenceHref={workspace.investigateHref(leftFips)}
                          fips={leftFips}
                          label={leftOption?.label ?? leftFips}
                          slot={0}
                        />
                        <CountyColumnHead
                          evidenceHref={workspace.investigateHref(rightFips)}
                          fips={rightFips}
                          label={rightOption?.label ?? rightFips}
                          slot={1}
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workspace.profile ? (
                        <>
                          <CompareSectionHeading title="Review" />
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={COMPARE_REVIEW_ROW_IDS}
                          />
                          <CompareSectionHeading title="Human surveillance" />
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={COMPARE_HUMAN_ROW_IDS}
                          />
                          <CompareSectionHeading title="Tick and pathogen evidence" />
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={vectorRowIds}
                            rowNote={(rowId) =>
                              rowId === "tick_status"
                                ? tickStatusRowNote(
                                    workspace.profile?.rows ?? []
                                  )
                                : null
                            }
                          />
                          <CompareSectionHeading title="Community context" />
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={COMPARE_COMMUNITY_ROW_IDS}
                          />
                        </>
                      ) : null}
                      {reconciledRows.length > 0 ? (
                        <CompareSectionHeading title="Additional observations" />
                      ) : null}
                      {reconciledRows.map((entry, index) => (
                        <TableRow
                          data-measure-id={entry.row.measureId}
                          data-row-index={index}
                          data-testid={`compare-row-${entry.row.measureId}`}
                          key={entry.row.measureId}
                        >
                          <TableHead className={compareCellClass} scope="row">
                            <span>{entry.row.measureLabel}</span>
                            <span className="type-small">
                              {entry.row.measureId}
                            </span>
                            {entry.note ? (
                              <span className="type-small">{entry.note}</span>
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
                          </TableHead>
                          <TableCell
                            className={compareCellClass}
                            data-county={leftOption?.label ?? leftFips}
                          >
                            <CompareCellView
                              cell={entry.row.left}
                              fips={workspace.alignment?.leftFips ?? leftFips}
                              measureId={entry.row.measureId}
                            />
                          </TableCell>
                          <TableCell
                            className={compareCellClass}
                            data-county={rightOption?.label ?? rightFips}
                          >
                            <CompareCellView
                              cell={entry.row.right}
                              fips={workspace.alignment?.rightFips ?? rightFips}
                              measureId={entry.row.measureId}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {workspace.profile ? (
                    <details className="ux-reset-compare-score-method">
                      <summary>Score and methodology</summary>
                      <p className="type-small">
                        These are published score components. They are not case
                        counts, and this comparison does not rank the counties.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={compareCellClass} scope="col">
                              Evidence measure
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {leftOption?.label ?? leftFips}
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {rightOption?.label ?? rightFips}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={COMPARE_SCORE_ROW_IDS}
                          />
                        </TableBody>
                      </Table>
                    </details>
                  ) : null}
                  {workspace.profile ? (
                    <section
                      aria-labelledby="compare-state-context-title"
                      className="ux-reset-compare-state-context"
                    >
                      <h3 id="compare-state-context-title">
                        State-level reporting context
                      </h3>
                      <p className="type-small">
                        State-unallocated human records are not county case
                        counts.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={compareCellClass} scope="col">
                              Evidence measure
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {leftOption?.label ?? leftFips}
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {rightOption?.label ?? rightFips}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={[COMPARE_STATE_CONTEXT_ROW_ID]}
                          />
                        </TableBody>
                      </Table>
                    </section>
                  ) : null}
                  {workspace.profile && limitationTextsDiffer ? (
                    <section aria-labelledby="compare-gaps-title">
                      <h3 id="compare-gaps-title">
                        Evidence gaps and comparability
                      </h3>
                      <p className="type-small">
                        These limitations differ by county. A shared release
                        limitation is stated once above the comparison.
                      </p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={compareCellClass} scope="col">
                              Evidence measure
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {leftOption?.label ?? leftFips}
                            </TableHead>
                            <TableHead className={compareCellClass} scope="col">
                              {rightOption?.label ?? rightFips}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <CompareProfileRows
                            alignment={workspace.profile}
                            leftLabel={leftOption?.label ?? leftFips}
                            rightLabel={rightOption?.label ?? rightFips}
                            rowIds={[COMPARE_LIMITATION_ROW_ID]}
                          />
                        </TableBody>
                      </Table>
                    </section>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <details className="ux-reset-explorer-release">
        <summary>Release and coverage</summary>
        <p className="type-small">Review scope {workspace.scopeLabel}.</p>
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

      {pair.length > 0 ? (
        <nav
          aria-label="Continue from this comparison"
          className="ux-reset-compare-next"
        >
          {/* Column headings carry both links once the comparison is open. */}
          {pair.length === 2
            ? null
            : pair.map((fips, index) => {
                if (index !== 0 && index !== 1) {
                  return null;
                }
                return (
                  <Link
                    className={cn(
                      buttonVariants({ variant: "secondary" }),
                      "ux-reset-compare-action"
                    )}
                    data-fips={fips}
                    data-testid={`compare-investigate-${fips}`}
                    data-variant="secondary"
                    href={workspace.investigateHref(fips)}
                    key={fips}
                  >
                    {countyEvidenceLinkLabel(index)}
                  </Link>
                );
              })}
          {askHref ? (
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
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

const compareCellClass = "h-auto whitespace-normal align-top";

function CompareSectionHeading({ title }: { title: string }) {
  return (
    <TableRow>
      <TableHead className={compareCellClass} colSpan={3} scope="colgroup">
        {title}
      </TableHead>
    </TableRow>
  );
}

function CountyColumnHead({
  evidenceHref,
  fips,
  label,
  slot,
}: {
  evidenceHref: string;
  fips: string;
  label: string;
  slot: 0 | 1;
}) {
  return (
    <TableHead className={compareCellClass} scope="col">
      <span className="ux-reset-compare-county-name">{label}</span>
      <span className="ux-reset-compare-fips">FIPS {fips}</span>
      <Link
        className={cn(
          buttonVariants({ size: "sm", variant: "secondary" }),
          "ux-reset-compare-action"
        )}
        data-fips={fips}
        data-testid={`compare-investigate-${fips}`}
        data-variant="secondary"
        href={evidenceHref}
      >
        {countyEvidenceLinkLabel(slot)}
      </Link>
    </TableHead>
  );
}

function countyEvidenceLinkLabel(index: 0 | 1): string {
  switch (index) {
    case 0: {
      return "View first county evidence";
    }
    case 1: {
      return "View second county evidence";
    }
    default: {
      const exhaustive: never = index;
      return exhaustive;
    }
  }
}

function CountySlot({
  disabled,
  label,
  onSelect,
  options,
  selectedFips,
  selectedLabel,
  testId,
}: {
  disabled: boolean;
  label: string;
  onSelect: (fips: string) => void;
  options: readonly { disabled: boolean; fips: string; label: string }[];
  selectedFips: string;
  selectedLabel: string | undefined;
  testId: string;
}) {
  return (
    <label className="ux-reset-compare-slot">
      <span className="type-small">{label}</span>
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
          className="h-11 w-full"
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
    </label>
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
