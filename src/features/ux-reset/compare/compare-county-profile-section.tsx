"use client";

import { Fragment, type ReactNode, useRef } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import {
  CompareCompactEvidence,
  compareReaderState,
} from "@/features/ux-reset/compare/compare-compact-evidence";
import {
  compareProfilePeriodQualification,
  type CompareProfileAlignment,
  type CompareProfileCell,
  type CompareProfileRow,
  type CompareProfileRowId,
} from "@/features/ux-reset/compare/compare-county-profile";
import {
  COMPARE_COMMUNITY_ROW_IDS,
  COMPARE_HUMAN_ROW_IDS,
  COMPARE_LIMITATION_ROW_ID,
  COMPARE_REVIEW_ROW_IDS,
  COMPARE_SCORE_ROW_IDS,
  COMPARE_STATE_CONTEXT_ROW_ID,
  COMPARE_VECTOR_ROW_IDS,
} from "@/features/ux-reset/compare/compare-unified-rows";

const standaloneProfileGroups: readonly CompareProfileGroup[] = [
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
    rowIds: COMPARE_VECTOR_ROW_IDS,
    title: "Tick, vector, and pathogen observations",
  },
  {
    id: "community",
    rowIds: COMPARE_COMMUNITY_ROW_IDS,
    title: "Population and community context",
  },
  {
    description: "State-unallocated human records are not county case counts.",
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
  {
    id: "limitations",
    rowIds: [COMPARE_LIMITATION_ROW_ID],
    title: "Evidence gaps and limitations",
  },
];

function profileRetryLabel(coolingDown: boolean, retrying: boolean): string {
  if (coolingDown && retrying) {
    return "Waiting for the server retry window…";
  }
  if (retrying) {
    return "Retrying county records…";
  }
  return "Retry county records";
}

function ProfileCellView({
  cell,
  fips,
  rowId,
}: {
  cell: CompareProfileCell;
  fips: string;
  rowId: string;
}) {
  if (cell.kind === "empty") {
    return (
      <p
        data-fips={fips}
        data-observation={cell.reason}
        data-testid={`compare-profile-cell-${rowId}-${fips}`}
      >
        {compareReaderState(cell.reason, cell.message)}
      </p>
    );
  }
  if (cell.kind === "text") {
    return (
      <p
        data-fips={fips}
        data-observation="text"
        data-testid={`compare-profile-cell-${rowId}-${fips}`}
      >
        {cell.text}
      </p>
    );
  }
  if (cell.kind === "reasons") {
    return (
      <ul
        className="ux-reset-compare-reasons"
        data-fips={fips}
        data-observation="reasons"
        data-testid={`compare-profile-cell-${rowId}-${fips}`}
      >
        {cell.reasons.map((reason) => (
          <li key={reason.label}>
            <p className="ux-reset-compare-reason-label">{reason.label}</p>
            <details className="ux-reset-compare-reason-text">
              <summary>Full text for {reason.label}</summary>
              <p>{reason.text}</p>
            </details>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div
      data-fips={fips}
      data-observation="present"
      data-testid={`compare-profile-cell-${rowId}-${fips}`}
    >
      <CompareCompactEvidence model={cell.evidence} />
    </div>
  );
}

export function ComparePairedValues({
  left,
  leftLabel,
  right,
  rightLabel,
}: {
  left: ReactNode;
  leftLabel: string;
  right: ReactNode;
  rightLabel: string;
}) {
  return (
    <div className="ux-reset-compare-values">
      <div className="ux-reset-compare-side" data-county={leftLabel}>
        <p className="ux-reset-compare-side-label">{leftLabel}</p>
        {left}
      </div>
      <div className="ux-reset-compare-side" data-county={rightLabel}>
        <p className="ux-reset-compare-side-label">{rightLabel}</p>
        {right}
      </div>
    </div>
  );
}

function profileRowsFor(
  alignment: CompareProfileAlignment,
  rowIds: readonly CompareProfileRowId[] | undefined
): CompareProfileRow[] {
  if (!rowIds) {
    return [...alignment.rows];
  }
  return rowIds.flatMap((id) => {
    const row = alignment.rows.find((entry) => entry.id === id);
    return row ? [row] : [];
  });
}

export function CompareProfileRows({
  alignment,
  leftLabel,
  rightLabel,
  rowIds,
  rowNote,
}: {
  alignment: CompareProfileAlignment;
  leftLabel: string;
  rightLabel: string;
  rowIds?: readonly CompareProfileRowId[];
  rowNote?: (rowId: CompareProfileRowId) => string | null;
}) {
  const rows = profileRowsFor(alignment, rowIds);
  return rows.map((row) => (
    <article
      className="ux-reset-compare-item"
      data-row-id={row.id}
      data-testid={`compare-profile-row-${row.id}`}
      key={row.id}
    >
      <h4>{row.label}</h4>
      {rowNote?.(row.id) ? (
        <p className="type-small">{rowNote(row.id)}</p>
      ) : null}
      <ComparePairedValues
        left={
          <ProfileCellView
            cell={row.left}
            fips={alignment.leftFips}
            rowId={row.id}
          />
        }
        leftLabel={leftLabel}
        right={
          <ProfileCellView
            cell={row.right}
            fips={alignment.rightFips}
            rowId={row.id}
          />
        }
        rightLabel={rightLabel}
      />
    </article>
  ));
}

export type CompareProfileGroup = {
  description?: string;
  id: string;
  rowIds: readonly CompareProfileRowId[];
  rowNote?: (rowId: CompareProfileRowId) => string | null;
  title: string;
};

export function CompareEvidenceGroup({
  children,
  columnLabels,
  defaultOpen,
  description,
  testId,
  title,
}: {
  children: ReactNode;
  columnLabels?: readonly [string, string];
  defaultOpen: boolean;
  description?: string;
  testId: string;
  title: string;
}) {
  const initialized = useRef(false);
  return (
    <details
      className="ux-reset-compare-group"
      data-testid={testId}
      ref={(element) => {
        if (!element || initialized.current) {
          return;
        }
        initialized.current = true;
        element.open = defaultOpen;
      }}
    >
      <summary>
        <h3 className="ux-reset-compare-group-title">{title}</h3>
        {description ? (
          <span className="ux-reset-compare-group-description type-small">
            {description}
          </span>
        ) : null}
      </summary>
      <div className="ux-reset-compare-group-body">
        {columnLabels ? (
          <div aria-hidden="true" className="ux-reset-compare-column-labels">
            <p>{columnLabels[0]}</p>
            <p>{columnLabels[1]}</p>
          </div>
        ) : null}
        {children}
      </div>
    </details>
  );
}

export function CompareProfileGroups({
  afterContent = null,
  afterGroupId,
  alignment,
  groups,
  leftLabel,
  openFirst = true,
  rightLabel,
}: {
  afterContent?: ReactNode;
  afterGroupId?: string;
  alignment: CompareProfileAlignment;
  groups: readonly CompareProfileGroup[];
  leftLabel: string;
  openFirst?: boolean;
  rightLabel: string;
}) {
  const visible = groups.flatMap((group) => {
    const rows = profileRowsFor(alignment, group.rowIds);
    return rows.length > 0 ? [{ group, rows }] : [];
  });
  const anchored = visible.some((entry) => entry.group.id === afterGroupId);
  const anchorId = anchored ? afterGroupId : visible[0]?.group.id;
  if (visible.length === 0) {
    return afterContent;
  }
  return visible.map(({ group }, index) => (
    <Fragment key={group.id}>
      <CompareEvidenceGroup
        columnLabels={[leftLabel, rightLabel]}
        defaultOpen={openFirst && index === 0}
        description={group.description}
        testId={`compare-group-${group.id}`}
        title={group.title}
      >
        <CompareProfileRows
          alignment={alignment}
          leftLabel={leftLabel}
          rightLabel={rightLabel}
          rowIds={group.rowIds}
          rowNote={group.rowNote}
        />
      </CompareEvidenceGroup>
      {afterContent && group.id === anchorId ? afterContent : null}
    </Fragment>
  ));
}

export function ComparePeriodQualification({
  period,
}: {
  period: string | null;
}) {
  return (
    <details className="ux-reset-compare-qualification">
      <summary>How dates and releases work</summary>
      <p className="type-small" data-testid="compare-profile-comparability">
        {compareProfilePeriodQualification(period)}
      </p>
    </details>
  );
}

export function CompareCountyProfileSection({
  alignment,
  coolingDown = false,
  embedded = false,
  error,
  leftLabel,
  loading,
  onRetry,
  period,
  retrying,
  rightLabel,
  showPeriodNote = true,
}: {
  alignment: CompareProfileAlignment | null;
  coolingDown?: boolean;
  embedded?: boolean;
  error: string | null;
  leftLabel: string;
  loading: boolean;
  onRetry: () => void;
  period: string | null;
  retrying: boolean;
  rightLabel: string;
  showPeriodNote?: boolean;
}) {
  if (!(loading || error || alignment)) {
    return null;
  }
  return (
    <section
      aria-busy={loading || retrying}
      className="ux-reset-compare-table"
      data-records-ready={alignment?.recordsReady ? "true" : "false"}
      data-release-mismatch={alignment?.releaseMismatch ? "true" : "false"}
      data-testid="compare-profile-section"
    >
      {embedded ? null : (
        <AtlasSectionHeader
          description="Original values for each county. No rank and no calculated difference."
          eyebrow="County record"
          headingLevel="h2"
          title="Published county evidence"
        />
      )}
      {showPeriodNote ? <ComparePeriodQualification period={period} /> : null}
      {loading ? (
        <AtlasStatusMessage tone="loading">
          <p data-testid="compare-profile-loading">
            Loading published county records…
          </p>
        </AtlasStatusMessage>
      ) : null}
      {coolingDown && !error ? (
        <AtlasStatusMessage
          action={
            <Button
              aria-busy
              data-testid="compare-retry-profile"
              data-waiting="true"
              disabled
              type="button"
              variant="secondary"
            >
              Waiting for the server retry window…
            </Button>
          }
          tone="loading"
        >
          <p data-testid="compare-profile-wait">
            Waiting for the server retry window before requesting county records
            again.
          </p>
        </AtlasStatusMessage>
      ) : null}
      {error ? (
        <AtlasStatusMessage
          action={
            <Button
              aria-busy={retrying}
              data-testid="compare-retry-profile"
              data-waiting={coolingDown && retrying ? "true" : "false"}
              disabled={retrying}
              type="button"
              variant="secondary"
              onClick={onRetry}
            >
              {profileRetryLabel(coolingDown, retrying)}
            </Button>
          }
          tone="error"
        >
          <p data-testid="compare-profile-error">{error}</p>
        </AtlasStatusMessage>
      ) : null}
      {alignment?.retryable && !error ? (
        <AtlasStatusMessage
          action={
            <Button
              aria-busy={retrying}
              data-testid="compare-retry-profile"
              disabled={retrying}
              type="button"
              variant="secondary"
              onClick={onRetry}
            >
              {profileRetryLabel(coolingDown, retrying)}
            </Button>
          }
          tone="error"
        >
          A county record could not be loaded. Values that were not returned
          stay blank.
        </AtlasStatusMessage>
      ) : null}
      {alignment?.releaseMismatch ? (
        <AtlasStatusMessage tone="error">
          <p data-testid="compare-profile-release-mismatch">
            A county record belongs to a different release, so its values were
            not shown.
          </p>
        </AtlasStatusMessage>
      ) : null}
      {alignment && !embedded ? (
        <div data-testid="compare-profile">
          <p className="type-small">
            Published county-record groups. A missing value stays missing and is
            not zero. No difference is calculated.
          </p>
          <CompareProfileGroups
            alignment={alignment}
            groups={standaloneProfileGroups}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
          />
        </div>
      ) : null}
    </section>
  );
}
