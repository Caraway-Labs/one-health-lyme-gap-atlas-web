import type { ReactNode } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EvidenceObject } from "@/features/ux-reset/evidence";
import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import { evidenceAvailabilityValues } from "@/features/ux-reset/evidence/types";
import {
  investigateEvidenceConflicts,
  investigateFamilyPublication,
  investigateMultipleObservations,
  type CountyEvidenceBundle,
  type CountyEvidenceFamilySection,
  type CountyEvidenceObservation,
  type FamilyPublication,
  type InvestigateEvidenceFamilyId,
  type InvestigatePeriodConflict,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateFindingSummary,
  investigateLimitationSummary,
  publishedCaveatRow,
  publishedFindingRow,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import {
  coverageRowAnchor,
  environmentalCoverageRows,
  publishedCountyHierarchy,
  publishedRowAnchor,
  type EnvironmentalCoverageContext,
  type GovernedPublishedState,
  type PublishedCountyRecord,
  type PublishedHierarchyRow,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import type { Measure } from "@/generated/models";

const EMPTY_MEASURES: readonly Measure[] = [];
const NO_PUBLISHED_FINDINGS: readonly PublishedHierarchyRow[] = [];

function observationAnchor(observationId: string): string {
  return `investigate-observation-${observationId}`;
}

function FamilyObservations({
  observations,
}: {
  observations: readonly CountyEvidenceObservation[];
}) {
  if (observations.length === 0) {
    return (
      <p className="type-body" data-testid="investigate-family-empty">
        No governed observations were returned for this family.
      </p>
    );
  }
  return (
    <div className="ux-reset-investigate-observations">
      {observations.map((record) => (
        <div
          data-measure-id={record.measureId}
          data-observation-id={record.observation.observation_id}
          data-period-end={record.observation.period_end}
          data-period-start={record.observation.period_start}
          data-release={record.observation.release_id}
          data-source-id={record.observation.source_id}
          id={observationAnchor(record.observation.observation_id)}
          key={record.observation.observation_id}
        >
          <EvidenceObject claimHeadingLevel="h4" model={record.evidence} />
        </div>
      ))}
    </div>
  );
}

function conflictCopy(conflict: InvestigatePeriodConflict): string {
  const period = formatObservationPeriod(
    conflict.periodStart,
    conflict.periodEnd,
    conflict.temporalGrain
  );
  return `${conflict.measureLabel} returned ${conflict.observationCount} observations for the same period (${period}) with different values. They stay separate and are not combined.`;
}

const COUNTY_RECORD_LOADING_FINDING =
  "The published county record is still loading, so an empty finding is not shown yet.";
const COUNTY_RECORD_LOADING_LIMITATION =
  "The published county record is still loading, so an empty limitation is not shown yet.";
const COUNTY_RECORD_FINDING_FAILURE =
  "The published county record could not be loaded, so findings may be incomplete. That is a request failure, not a statement that no finding was returned.";
const COUNTY_RECORD_LIMITATION_FAILURE =
  "The published county record could not be loaded, so limitations may be incomplete. That is a request failure, not a statement that no limitation was returned.";
const CATALOG_FINDING_FAILURE =
  "The measure catalog could not be loaded, so no observation finding was requested. That is a request failure, not a statement that no finding was returned.";
const CATALOG_LIMITATION_FAILURE =
  "The measure catalog could not be loaded, so no observation limitation was requested. That is a request failure, not a statement that no limitation was returned.";
const CATALOG_GAPS_FAILURE =
  "The measure catalog could not be loaded, so observation gaps were not requested. That is a request failure, not a statement that no gap was returned.";
const EMPTY_GAPS =
  "No conflict, gap, or extra limitation was returned for this county.";

function publicationCopy(publication: FamilyPublication): string | null {
  switch (publication) {
    case "assigned":
    case "empty": {
      return null;
    }
    case "classification_unknown": {
      return "Measures in this release are not classified into this family. Unclassified evidence stays under Domain not assigned.";
    }
    case "domains_unavailable": {
      return "Indicator domains could not be loaded, so observations are not assigned to this family.";
    }
    case "not_in_release": {
      return "This release does not publish measures for this evidence family.";
    }
    case "request_failed": {
      return "Measures in this family could not be loaded. That is a request failure, not unavailable evidence.";
    }
    case "unsupported_period": {
      return "The selected period is not a supported bound for this family's measures, so no observation query was sent.";
    }
    case "unreadable": {
      return "Measures in this family did not produce observations because requests failed or the period is not a supported bound.";
    }
    default: {
      const exhaustive: never = publication;
      return exhaustive;
    }
  }
}

function FamilySection({
  catalogFailed,
  countyFips,
  countyRecordLoading,
  domainsRequestFailed,
  failedMeasureIds,
  hasUnclassifiedMeasures,
  section,
  supplementalRows,
  unsupportedMeasureIds,
}: {
  catalogFailed: boolean;
  countyFips: string;
  countyRecordLoading: boolean;
  domainsRequestFailed: boolean;
  failedMeasureIds: ReadonlySet<string>;
  hasUnclassifiedMeasures: boolean;
  section: CountyEvidenceFamilySection;
  supplementalRows: readonly PublishedHierarchyRow[];
  unsupportedMeasureIds: ReadonlySet<string>;
}) {
  const publication = investigateFamilyPublication({
    domainsRequestFailed,
    failedMeasureIds,
    hasUnclassifiedMeasures,
    measureIds: section.measureIds,
    observationCount: section.observations.length,
    unsupportedMeasureIds,
  });
  const copy = publicationCopy(publication);
  const holdAbsence =
    (countyRecordLoading || catalogFailed) &&
    supplementalRows.length === 0 &&
    (publication === "empty" ||
      publication === "not_in_release" ||
      publication === "classification_unknown");
  const showPublicationCopy = supplementalRows.length === 0 && !holdAbsence;
  return (
    <section
      aria-label={section.label}
      className="ux-reset-investigate-family"
      data-county={countyFips}
      data-evidence-class={section.evidenceClass}
      data-family={section.id}
      data-publication={publication}
      data-testid={`investigate-family-${section.id}`}
    >
      <AtlasSectionHeader
        eyebrow={
          section.evidenceClass === "observed"
            ? "Observed evidence"
            : "Contextual evidence"
        }
        headingLevel="h3"
        title={section.label}
      />
      <p className="type-body">{section.contextNote}</p>
      {holdAbsence ? (
        <p className="type-body" data-testid="investigate-family-pending">
          {catalogFailed
            ? "Observation measures were not loaded because the measure catalog failed."
            : "Published county rows for this family are still loading."}
        </p>
      ) : null}
      {showPublicationCopy && copy ? <p className="type-body">{copy}</p> : null}
      {showPublicationCopy && publication === "empty" ? (
        <p className="type-body" data-testid="investigate-family-empty">
          No governed observations were returned for this family.
        </p>
      ) : null}
      {publication === "assigned" ? (
        <FamilyObservations observations={section.observations} />
      ) : null}
      {supplementalRows.length > 0 ? (
        <div className="ux-reset-investigate-observations">
          <p className="type-body">
            These rows are the published county record. They are separate from
            an observation series.
          </p>
          {supplementalRows.map((row) => (
            <div
              data-evidence-class={section.evidenceClass}
              data-measure-id={row.measureId}
              data-reason-code={row.state.reasonCode}
              data-value-state={row.state.valueState}
              id={publishedRowAnchor(row.measureId)}
              key={row.measureId}
            >
              <EvidenceObject claimHeadingLevel="h4" model={row.evidence} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function observedMeasureIds(bundle: CountyEvidenceBundle): string[] {
  const ids: string[] = [];
  for (const family of bundle.families) {
    for (const record of family.observations) {
      ids.push(record.measureId);
    }
  }
  for (const record of bundle.unassigned) {
    ids.push(record.measureId);
  }
  return ids;
}

function rowsForFamily(
  rows: readonly PublishedHierarchyRow[],
  familyId: InvestigateEvidenceFamilyId
): PublishedHierarchyRow[] {
  return rows.filter((row) => row.familyId === familyId);
}

function limitationLines(bundle: CountyEvidenceBundle): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const records = [
    ...bundle.families.flatMap((family) => [...family.observations]),
    ...bundle.unassigned,
  ];
  for (const record of records) {
    for (const limitation of record.evidence.provenance.limitations) {
      const line = `${record.measureLabel}: ${limitation}`;
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
    if (
      record.evidence.availability === evidenceAvailabilityValues.unavailable &&
      !seen.has(record.measureId)
    ) {
      seen.add(record.measureId);
      lines.push(
        `${record.measureLabel} is unavailable for this county. That is not zero.`
      );
    }
  }
  return lines;
}

function uniqueLines(groups: readonly (readonly string[])[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const line of group) {
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
  }
  return lines;
}

function derivedGapLines(
  rows: readonly { state: GovernedPublishedState }[]
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const line of row.state.gapLines) {
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
  }
  return lines;
}

function coverageContexts(
  bundle: CountyEvidenceBundle
): EnvironmentalCoverageContext[] {
  const contexts: EnvironmentalCoverageContext[] = [];
  const records = [
    ...bundle.families.flatMap((family) => [...family.observations]),
    ...bundle.unassigned,
  ];
  for (const record of records) {
    const context = record.observation.environmental_context;
    if (!context) {
      continue;
    }
    contexts.push({
      context,
      measureId: record.measureId,
      measureLabel: record.measureLabel,
      observationId: record.observation.observation_id,
      provenance: record.evidence.provenance,
    });
  }
  return contexts;
}

export function InvestigateEvidenceHierarchy({
  bundle,
  catalogFailed = false,
  countyRecord = null,
  countyRecordError = null,
  countyRecordLoading = false,
  measures = EMPTY_MEASURES,
  modelAssisted = null,
  onRetryFailures,
  retrying = false,
}: {
  bundle: CountyEvidenceBundle;
  catalogFailed?: boolean;
  countyRecord?: PublishedCountyRecord | null;
  countyRecordError?: string | null;
  countyRecordLoading?: boolean;
  measures?: readonly Measure[];
  modelAssisted?: ReactNode;
  onRetryFailures?: () => void;
  retrying?: boolean;
}) {
  const finding = bundle.leadFinding;
  const limitation = bundle.leadLimitation;
  const failedMeasureIds = new Set(
    bundle.measureFailures.map((failure) => failure.measureId)
  );
  const unsupportedMeasureIds = new Set(bundle.unsupportedPeriodMeasureIds);
  const handleRetryFailures = () => {
    onRetryFailures?.();
  };
  const published = countyRecord
    ? publishedCountyHierarchy({
        measures,
        observedMeasureIds: observedMeasureIds(bundle),
        record: countyRecord,
      })
    : null;
  const publishedRows = published?.rows ?? NO_PUBLISHED_FINDINGS;
  const coverage = environmentalCoverageRows({
    contexts: coverageContexts(bundle),
  });
  const holdEmptyFinding = countyRecordLoading && !finding;
  const holdEmptyLimitation = countyRecordLoading && !limitation;
  const countyRecordFailed =
    Boolean(countyRecordError) && !finding && !published;
  const countyLimitationFailed =
    Boolean(countyRecordError) && !limitation && !published;
  const publishedLead = publishedFindingRow(publishedRows);
  const catalogFindingUnsent = catalogFailed && !finding && !publishedLead;
  const findingSummary = holdEmptyFinding
    ? {
        text: COUNTY_RECORD_LOADING_FINDING,
        title: "Published county record loading",
      }
    : countyRecordFailed
      ? {
          text: COUNTY_RECORD_FINDING_FAILURE,
          title: "Published county record did not load",
        }
      : catalogFindingUnsent
        ? {
            text: CATALOG_FINDING_FAILURE,
            title: "Measure catalog did not load",
          }
        : investigateFindingSummary(bundle, publishedRows);
  const publishedFinding =
    finding || holdEmptyFinding || countyRecordFailed || catalogFindingUnsent
      ? null
      : publishedLead;
  const publishedCaveat =
    limitation || holdEmptyLimitation || countyLimitationFailed
      ? null
      : publishedCaveatRow(publishedRows);
  const coverageCaveat =
    limitation || publishedCaveat
      ? null
      : (coverage.find((row) => row.state.limitationText) ?? null);
  const releaseLimitation = published?.releaseLimitation.trim() ?? "";
  const catalogLimitationUnsent =
    catalogFailed && !limitation && !publishedCaveat && !coverageCaveat;
  const limitationSummary = coverageCaveat?.state.limitationText
    ? {
        text: `${coverageCaveat.evidence.claimLabel}: ${coverageCaveat.state.limitationText}`,
        title: coverageCaveat.evidence.claimLabel,
      }
    : holdEmptyLimitation
      ? {
          text: COUNTY_RECORD_LOADING_LIMITATION,
          title: "Published county record loading",
        }
      : countyLimitationFailed
        ? {
            text: COUNTY_RECORD_LIMITATION_FAILURE,
            title: "Published county record did not load",
          }
        : releaseLimitation && !limitation && !publishedCaveat
          ? {
              text: releaseLimitation,
              title: "Release limitation",
            }
          : catalogLimitationUnsent
            ? {
                text: CATALOG_LIMITATION_FAILURE,
                title: "Measure catalog did not load",
              }
            : investigateLimitationSummary(bundle, publishedRows);
  const conflicts = investigateEvidenceConflicts(bundle);
  const multipleObservations = investigateMultipleObservations(bundle);
  const limitations = uniqueLines([
    limitationLines(bundle),
    derivedGapLines(publishedRows),
    derivedGapLines(coverage),
  ]);
  const publishedGaps = published?.gaps ?? [];
  const hasGapContent =
    conflicts.length > 0 ||
    multipleObservations.length > 0 ||
    bundle.measureFailures.length > 0 ||
    bundle.unsupportedPeriodMeasureIds.length > 0 ||
    limitations.length > 0 ||
    publishedGaps.length > 0 ||
    Boolean(published?.releaseLimitation) ||
    bundle.unassigned.length > 0;

  return (
    <div
      data-county={bundle.county.fips}
      data-release={bundle.releaseId}
      data-testid="investigate-evidence"
    >
      {catalogFailed ? (
        <div data-testid="investigate-catalog-notice">
          <AtlasStatusMessage tone="error">
            The measure catalog could not be loaded. Published county rows are
            shown without an observation series.
          </AtlasStatusMessage>
        </div>
      ) : null}
      <section
        className="ux-reset-investigate-summary"
        data-county={bundle.county.fips}
        data-testid="investigate-finding"
      >
        <AtlasSectionHeader
          eyebrow="What we know"
          headingLevel="h2"
          title={findingSummary.title}
        />
        <Card className="ux-reset-investigate-callout">
          <p className="type-body" data-testid="investigate-finding-text">
            {findingSummary.text}
          </p>
          {finding ? (
            <a
              href={`#${observationAnchor(finding.observation.observation_id)}`}
            >
              Inspect this finding
            </a>
          ) : null}
          {publishedFinding ? (
            <a href={`#${publishedRowAnchor(publishedFinding.measureId)}`}>
              Inspect this finding
            </a>
          ) : null}
        </Card>
      </section>

      <section
        className="ux-reset-investigate-summary"
        data-county={bundle.county.fips}
        data-testid="investigate-limitation"
      >
        <AtlasSectionHeader
          eyebrow="What is uncertain"
          headingLevel="h2"
          title={limitationSummary.title}
        />
        <Card className="ux-reset-investigate-callout">
          <p className="type-body" data-testid="investigate-limitation-text">
            {limitationSummary.text}
          </p>
          {limitation ? (
            <a
              href={`#${observationAnchor(limitation.observation.observation.observation_id)}`}
            >
              Inspect this limitation
            </a>
          ) : null}
          {publishedCaveat?.row.state.inspectTarget ? (
            <a href={`#${publishedCaveat.row.state.inspectTarget}`}>
              Inspect this limitation
            </a>
          ) : null}
          {coverageCaveat?.state.inspectTarget ? (
            <a href={`#${coverageCaveat.state.inspectTarget}`}>
              Inspect this limitation
            </a>
          ) : null}
        </Card>
      </section>

      {bundle.families.map((section) => (
        <div key={section.id}>
          <FamilySection
            catalogFailed={catalogFailed}
            countyFips={bundle.county.fips}
            countyRecordLoading={countyRecordLoading}
            domainsRequestFailed={bundle.domainsRequestFailed}
            failedMeasureIds={failedMeasureIds}
            hasUnclassifiedMeasures={bundle.unclassifiedMeasureIds.length > 0}
            section={section}
            supplementalRows={
              published ? rowsForFamily(published.rows, section.id) : []
            }
            unsupportedMeasureIds={unsupportedMeasureIds}
          />
          {section.id === "vector_pathogen" ? (
            <section
              aria-label="Evidence sufficiency and coverage"
              className="ux-reset-investigate-summary"
              data-evidence-class="coverage"
              data-testid="investigate-coverage"
            >
              <AtlasSectionHeader
                eyebrow="Coverage"
                headingLevel="h2"
                title="Evidence sufficiency and coverage"
              />
              {countyRecordLoading ? (
                <AtlasStatusMessage tone="loading">
                  Loading published county coverage…
                </AtlasStatusMessage>
              ) : null}
              {countyRecordError ? (
                <AtlasStatusMessage tone="error">
                  {countyRecordError}
                </AtlasStatusMessage>
              ) : null}
              {published ? (
                <p
                  className="type-body"
                  data-testid="investigate-coverage-value"
                >
                  {`Published input coverage is ${published.completeness}%. This is not a disease risk score. A lower number is not zero evidence.`}
                </p>
              ) : null}
              {!published && !countyRecordLoading && !countyRecordError ? (
                <p
                  className="type-body"
                  data-testid="investigate-coverage-value"
                >
                  Published input coverage was not returned for this county.
                  That is not zero coverage.
                </p>
              ) : null}
              {coverage.length > 0 ? (
                <div className="ux-reset-investigate-observations">
                  {coverage.map((row) => (
                    <div
                      data-coverage={row.coverageStatus}
                      data-observation-id={row.observationId}
                      data-reason-code={row.state.reasonCode}
                      data-value-state={row.state.valueState}
                      id={coverageRowAnchor(row.observationId)}
                      key={row.observationId}
                    >
                      <EvidenceObject
                        claimHeadingLevel="h4"
                        model={row.evidence}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {modelAssisted}
            </section>
          ) : null}
        </div>
      ))}

      <section
        aria-label="Conflicts, gaps, and limitations"
        className="ux-reset-investigate-summary"
        data-evidence-class="limitation"
        data-testid="investigate-gaps"
      >
        <AtlasSectionHeader
          eyebrow="Limits"
          headingLevel="h2"
          title="Conflicts, gaps, and limitations"
        />
        {conflicts.length > 0 ? (
          <ul data-testid="investigate-conflicts">
            {conflicts.map((conflict) => (
              <li
                key={`${conflict.measureId}:${conflict.periodStart}:${conflict.periodEnd}`}
              >
                {conflictCopy(conflict)}
              </li>
            ))}
          </ul>
        ) : null}
        {multipleObservations.length > 0 ? (
          <ul data-testid="investigate-multiple-observations">
            {multipleObservations.map((group) => (
              <li key={group.measureId}>
                {`${group.measureLabel} returned ${group.observationCount} observations. These are multiple observations, not a conflict.`}
              </li>
            ))}
          </ul>
        ) : null}
        {bundle.measureFailures.length > 0 ? (
          <div
            data-county={bundle.county.fips}
            data-testid="investigate-partial-failure"
          >
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
              {onRetryFailures ? (
                <Button
                  aria-busy={retrying}
                  data-retrying={retrying ? "true" : "false"}
                  data-testid="investigate-retry-evidence"
                  disabled={retrying}
                  type="button"
                  variant="secondary"
                  onClick={handleRetryFailures}
                >
                  {retrying
                    ? "Retrying evidence…"
                    : "Retry evidence that did not load"}
                </Button>
              ) : null}
            </AtlasStatusMessage>
          </div>
        ) : null}
        {bundle.unsupportedPeriodMeasureIds.length > 0 ? (
          <div
            data-county={bundle.county.fips}
            data-testid="investigate-unsupported-period"
          >
            <AtlasStatusMessage tone="empty">
              <p>
                These measures were not queried. The selected period is not a
                supported bound for their published grain.
              </p>
              <ul>
                {bundle.unsupportedPeriodMeasureIds.map((measureId) => (
                  <li key={measureId}>{measureId}</li>
                ))}
              </ul>
            </AtlasStatusMessage>
          </div>
        ) : null}
        {limitations.length > 0 || publishedGaps.length > 0 ? (
          <ul data-testid="investigate-gap-list">
            {limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {publishedGaps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {published?.releaseLimitation ? (
          <p className="type-body" data-testid="investigate-release-limitation">
            {published.releaseLimitation}
          </p>
        ) : null}
        {bundle.unassigned.length > 0 ? (
          <section
            aria-label="Evidence without a family"
            className="ux-reset-investigate-family"
            data-county={bundle.county.fips}
            data-testid="investigate-unassigned"
          >
            <AtlasSectionHeader
              eyebrow="Evidence family"
              headingLevel="h3"
              title="Domain not assigned"
            />
            <p className="type-body">
              These observations use a domain or indicator that is not on the
              family allowlist. That is unknown classification, not an
              unpublished family.
            </p>
            <FamilyObservations observations={bundle.unassigned} />
          </section>
        ) : null}
        {countyRecordLoading && !hasGapContent ? (
          <p className="type-body" data-testid="investigate-gaps-pending">
            Published county gaps are still loading.
          </p>
        ) : null}
        {catalogFailed &&
        !hasGapContent &&
        !countyRecordLoading &&
        !countyRecordError ? (
          <p className="type-body" data-testid="investigate-gaps-catalog">
            {CATALOG_GAPS_FAILURE}
          </p>
        ) : null}
        {hasGapContent ||
        countyRecordLoading ||
        countyRecordError ||
        catalogFailed ? null : (
          <p className="type-body" data-testid="investigate-gaps-empty">
            {EMPTY_GAPS}
          </p>
        )}
      </section>
    </div>
  );
}
