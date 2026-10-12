"use client";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  compareProfilePeriodQualification,
  type CompareProfileAlignment,
  type CompareProfileCell,
} from "@/features/ux-reset/compare/compare-county-profile";
import { EvidenceObject } from "@/features/ux-reset/evidence";

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
        {cell.message}
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
        data-fips={fips}
        data-observation="reasons"
        data-testid={`compare-profile-cell-${rowId}-${fips}`}
      >
        {cell.reasons.map((reason) => (
          <li key={reason.label}>
            <span className="type-small">{reason.label}</span>
            <p>{reason.text}</p>
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
      <EvidenceObject claimHeadingLevel="h3" model={cell.evidence} showReason />
    </div>
  );
}

export function CompareCountyProfileSection({
  alignment,
  coolingDown = false,
  error,
  leftLabel,
  loading,
  onRetry,
  period,
  retrying,
  rightLabel,
}: {
  alignment: CompareProfileAlignment | null;
  coolingDown?: boolean;
  error: string | null;
  leftLabel: string;
  loading: boolean;
  onRetry: () => void;
  period: string | null;
  retrying: boolean;
  rightLabel: string;
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
      <AtlasSectionHeader
        description="Original values for each county. No rank and no calculated difference."
        eyebrow="County record"
        headingLevel="h2"
        title="Published county evidence"
      />
      <p className="type-body" data-testid="compare-profile-comparability">
        {compareProfilePeriodQualification(period)}
      </p>
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
      {alignment ? (
        <div data-testid="compare-profile">
          <Table>
            <TableCaption>
              Published county-record rows. A missing value stays missing and is
              not zero. No difference is calculated.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">County record</TableHead>
                <TableHead scope="col">{leftLabel}</TableHead>
                <TableHead scope="col">{rightLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alignment.rows.map((row) => (
                <TableRow
                  data-row-id={row.id}
                  data-testid={`compare-profile-row-${row.id}`}
                  key={row.id}
                >
                  <TableHead scope="row">
                    <span className="type-card">{row.label}</span>
                  </TableHead>
                  <TableCell>
                    <ProfileCellView
                      cell={row.left}
                      fips={alignment.leftFips}
                      rowId={row.id}
                    />
                  </TableCell>
                  <TableCell>
                    <ProfileCellView
                      cell={row.right}
                      fips={alignment.rightFips}
                      rowId={row.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
