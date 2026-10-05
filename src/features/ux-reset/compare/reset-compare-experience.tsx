"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
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
import type {
  CompareAlignedRow,
  CompareCell,
  CompareRelation,
} from "@/features/ux-reset/compare/compare-alignment";
import {
  compareOptionDisabled,
  useCompareWorkspace,
} from "@/features/ux-reset/compare/use-compare-workspace";
import {
  EvidenceObject,
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import { usePublishExploreCommittedNavigation } from "@/features/ux-reset/explore-committed-navigation";
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
        <p>{cell.message}</p>
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
        <EvidenceObject
          claimHeadingLevel="h3"
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
  usePublishAskAtlasInheritedContext(
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
    })
  );
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
  const counts = useMemo(
    () =>
      workspace.alignment ? summaryCounts(workspace.alignment.rows) : null,
    [workspace.alignment]
  );
  const failedMeasures =
    workspace.alignment?.outcomes.some(
      (outcome) => outcome.status === "failed"
    ) ?? false;

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
      data-stale-url={workspace.entry.staleUrlIgnored ? "true" : "false"}
      data-testid="compare-workspace"
    >
      <header className="ux-reset-compare-header">
        <p className="eyebrow">Two-county evidence</p>
        <h1>Compare</h1>
        <p className="type-body">
          Compare two counties on governed measures. Each column keeps its own
          unit, period, and availability. This page does not rank counties.
        </p>
        <p className="type-small">Review scope {workspace.scopeLabel}.</p>
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

      <fieldset className="ux-reset-compare-pair">
        <legend className="type-card">Counties to compare</legend>
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
              Remove {rightOption?.label ?? rightFips}
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
          Loading aligned evidence…
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

      {workspace.alignment && counts ? (
        <section
          className="ux-reset-compare-table"
          data-testid="compare-alignment"
        >
          <AtlasSectionHeader
            description="Rows follow governed measure identity. A blank side stays blank."
            eyebrow="Aligned measures"
            headingLevel="h2"
            title="Side-by-side evidence"
          />
          <p data-testid="compare-summary">
            {countPhrase(counts.similar, "measure shares", "measures share")}{" "}
            the same value.{" "}
            {countPhrase(
              counts.different,
              "measure differs",
              "measures differ"
            )}
            . {countPhrase(counts.withheld, "comparison is", "comparisons are")}{" "}
            withheld.
          </p>
          <Table>
            <TableCaption>
              Aligned by governed measure identity. A missing observation stays
              missing and is not zero.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Measure</TableHead>
                <TableHead scope="col">
                  {leftOption?.label ?? leftFips}
                </TableHead>
                <TableHead scope="col">
                  {rightOption?.label ?? rightFips}
                </TableHead>
                <TableHead scope="col">Comparison</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.alignment.rows.map((row, index) => (
                <TableRow
                  data-measure-id={row.measureId}
                  data-row-index={index}
                  data-testid={`compare-row-${row.measureId}`}
                  key={row.measureId}
                >
                  <TableHead scope="row">
                    <span className="type-card">{row.measureLabel}</span>
                    <span className="type-small">{row.measureId}</span>
                  </TableHead>
                  <TableCell>
                    <CompareCellView
                      cell={row.left}
                      fips={workspace.alignment?.leftFips ?? leftFips}
                      measureId={row.measureId}
                    />
                  </TableCell>
                  <TableCell>
                    <CompareCellView
                      cell={row.right}
                      fips={workspace.alignment?.rightFips ?? rightFips}
                      measureId={row.measureId}
                    />
                  </TableCell>
                  <TableCell>
                    <p
                      data-reasons={relationReasons(row.relation)}
                      data-relation={row.relation.kind}
                      data-signed-difference={
                        row.relation.kind === "different"
                          ? String(row.relation.signedDifference)
                          : ""
                      }
                      data-testid={`compare-relation-${row.measureId}`}
                    >
                      {relationText(row.relation)}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {pair.length > 0 ? (
        <nav
          aria-label="Continue from this comparison"
          className="ux-reset-compare-next"
        >
          {pair.map((fips) => {
            const label =
              workspace.options.find((option) => option.fips === fips)?.label ??
              fips;
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
                Investigate {label}
              </Link>
            );
          })}
          <Link
            className={cn(buttonVariants(), "ux-reset-compare-action")}
            data-fips={pair.join(",")}
            data-testid="compare-action"
            data-variant="primary"
            href={workspace.actionHref}
          >
            Continue to Action
          </Link>
        </nav>
      ) : null}
    </div>
  );
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
