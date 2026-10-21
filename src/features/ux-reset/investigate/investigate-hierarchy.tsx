import {
  Bug,
  CircleAlert,
  Gauge,
  Layers,
  Leaf,
  RotateCcw,
  Scale,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EvidenceObject } from "@/features/ux-reset/evidence";
import { formatObservationPeriod } from "@/features/ux-reset/evidence/format-period";
import type { EvidenceReasonCode } from "@/features/ux-reset/evidence/types";
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
  investigateHandoffLimitation,
  publishedCaveatRow,
  resolveInvestigateFinding,
} from "@/features/ux-reset/investigate/investigate-visible-summary";
import {
  coverageRowAnchor,
  environmentalCoverageRows,
  governedStatusDisclosure,
  publishedCountyHierarchy,
  publishedRowAnchor,
  type EnvironmentalCoverageContext,
  type GovernedPublishedState,
  type PublishedCountyRecord,
  type PublishedHierarchyRow,
} from "@/features/ux-reset/investigate/published-county-hierarchy";
import { KnownEmptySelectionNotice } from "@/features/ux-reset/observations/known-empty-selection-notice";
import { ExplorerLoadingStatus } from "@/features/ux-reset/review/explorer-loading-status";
import { EXPLORER_SECTION_IDS } from "@/features/ux-reset/review/explorer-mode";
import { ExplorerSectionHeading } from "@/features/ux-reset/review/explorer-section-heading";
import type { Measure } from "@/generated/models";

const EMPTY_MEASURES: readonly Measure[] = [];
const NO_PUBLISHED_FINDINGS: readonly PublishedHierarchyRow[] = [];

/**
 * `explorer` is the Atlas Explorer county evidence view: compact evidence
 * cards and small icon section labels. `standard` keeps Investigate as is.
 */
export type InvestigateHierarchyPresentation = "explorer" | "standard";

/**
 * Which part of the hierarchy to render. Explorer places evidence and context
 * in separate tab panels. Both regions read the same props.
 */
export type InvestigateHierarchyRegion = "all" | "context" | "evidence";

function observationAnchor(observationId: string): string {
  return `investigate-observation-${observationId}`;
}

function evidencePresentation(
  presentation: InvestigateHierarchyPresentation
): "compact" | "standard" {
  switch (presentation) {
    case "explorer": {
      return "compact";
    }
    case "standard": {
      return "standard";
    }
    default: {
      const exhaustive: never = presentation;
      return exhaustive;
    }
  }
}

function familyIcon(familyId: InvestigateEvidenceFamilyId): LucideIcon {
  switch (familyId) {
    case "human": {
      return Users;
    }
    case "vector_pathogen": {
      return Bug;
    }
    case "environmental_population": {
      return Leaf;
    }
    default: {
      const exhaustive: never = familyId;
      return exhaustive;
    }
  }
}

/** Section heading: serif eyebrow block in Investigate, icon label in Explorer. */
function HierarchyHeading({
  eyebrow,
  icon,
  level,
  presentation,
  title,
}: {
  eyebrow: string;
  icon: LucideIcon;
  level: "h2" | "h3";
  presentation: InvestigateHierarchyPresentation;
  title: string;
}) {
  switch (presentation) {
    case "explorer": {
      return (
        <ExplorerSectionHeading
          icon={icon}
          level={level}
          note={eyebrow}
          title={title}
        />
      );
    }
    case "standard": {
      return (
        <AtlasSectionHeader
          eyebrow={eyebrow}
          headingLevel={level}
          title={title}
        />
      );
    }
    default: {
      const exhaustive: never = presentation;
      return exhaustive;
    }
  }
}

/** Request-in-flight message: neutral spinner in Explorer, words in Investigate. */
function HierarchyLoading({
  children,
  presentation,
  testId,
}: {
  children: string;
  presentation: InvestigateHierarchyPresentation;
  testId?: string;
}) {
  switch (presentation) {
    case "explorer": {
      return (
        <ExplorerLoadingStatus testId={testId}>
          {children}
        </ExplorerLoadingStatus>
      );
    }
    case "standard": {
      return testId ? (
        <p className="type-body" data-testid={testId}>
          {children}
        </p>
      ) : (
        <AtlasStatusMessage tone="loading">{children}</AtlasStatusMessage>
      );
    }
    default: {
      const exhaustive: never = presentation;
      return exhaustive;
    }
  }
}

function FamilyObservations({
  observations,
  presentation,
  showGovernedLimitations,
}: {
  observations: readonly CountyEvidenceObservation[];
  presentation: InvestigateHierarchyPresentation;
  showGovernedLimitations: boolean;
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
          <EvidenceObject
            claimHeadingLevel="h4"
            model={record.evidence}
            presentation={evidencePresentation(presentation)}
            showGovernedLimitations={showGovernedLimitations}
          />
        </div>
      ))}
    </div>
  );
}

function disagreementPhrase(
  disagreement: InvestigatePeriodConflict["disagreement"]
): string {
  switch (disagreement) {
    case "values": {
      return "with different values";
    }
    case "states": {
      return "with different evidence states";
    }
    case "both": {
      return "with different values and evidence states";
    }
    default: {
      const exhaustive: never = disagreement;
      return exhaustive;
    }
  }
}

function conflictCopy(conflict: InvestigatePeriodConflict): string {
  const period = formatObservationPeriod(
    conflict.periodStart,
    conflict.periodEnd,
    conflict.temporalGrain
  );
  return `${conflict.measureLabel} returned ${conflict.observationCount} observations for the same period (${period}) ${disagreementPhrase(conflict.disagreement)}. They stay separate and are not combined.`;
}

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
  omitDisclaimers,
  presentation,
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
  omitDisclaimers: boolean;
  presentation: InvestigateHierarchyPresentation;
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
      <HierarchyHeading
        eyebrow={
          section.evidenceClass === "observed"
            ? "Observed evidence"
            : "Contextual evidence"
        }
        icon={familyIcon(section.id)}
        level="h3"
        presentation={presentation}
        title={section.label}
      />
      {omitDisclaimers ? null : (
        <p className="type-body">{section.contextNote}</p>
      )}
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
        <FamilyObservations
          observations={section.observations}
          presentation={presentation}
          showGovernedLimitations={!omitDisclaimers}
        />
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
              <EvidenceObject
                claimHeadingLevel="h4"
                model={row.evidence}
                presentation={evidencePresentation(presentation)}
                showGovernedLimitations={!omitDisclaimers}
              />
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

function visibleObservations(
  bundle: CountyEvidenceBundle
): CountyEvidenceObservation[] {
  return [
    ...bundle.families.flatMap((family) => [...family.observations]),
    ...bundle.unassigned,
  ];
}

function observationReasonCode(
  record: CountyEvidenceObservation
): EvidenceReasonCode {
  return record.evidence.reasonCode ?? record.observation.value_state;
}

function observationDisclosures(bundle: CountyEvidenceBundle): {
  gapLines: readonly string[];
  uncertaintyText: string | null;
}[] {
  return visibleObservations(bundle).map((record) => {
    const limitations = record.evidence.provenance.limitations;
    const reasonCode = observationReasonCode(record);
    const valueState = record.observation.value_state;
    const gaps = governedStatusDisclosure({
      claimLabel: record.measureLabel,
      limitations,
      reasonCode,
      valueState,
    });
    const [leadLimitation] = limitations;
    const uncertainty = governedStatusDisclosure({
      claimLabel: record.measureLabel,
      limitations: leadLimitation ? [leadLimitation] : [],
      reasonCode,
      valueState,
    });
    return {
      gapLines: gaps.gapLines,
      uncertaintyText: uncertainty.uncertaintyText
        ? `${record.measureLabel}: ${uncertainty.uncertaintyText}`
        : null,
    };
  });
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
  countyRecordRefreshError = null,
  measures = EMPTY_MEASURES,
  modelAssisted = null,
  omitDisclaimers = false,
  onRetryFailures,
  presentation = "standard",
  region = "all",
  retrying = false,
}: {
  bundle: CountyEvidenceBundle;
  catalogFailed?: boolean;
  countyRecord?: PublishedCountyRecord | null;
  countyRecordError?: string | null;
  countyRecordLoading?: boolean;
  /** Refresh failed after a resolved record or a resolved 404. */
  countyRecordRefreshError?: string | null;
  measures?: readonly Measure[];
  modelAssisted?: ReactNode;
  /** Atlas Explorer deletes disclaimer copy. Investigate keeps it. */
  omitDisclaimers?: boolean;
  onRetryFailures?: () => void;
  presentation?: InvestigateHierarchyPresentation;
  region?: InvestigateHierarchyRegion;
  retrying?: boolean;
}) {
  const observationStatus = observationDisclosures(bundle);
  const limitation = bundle.leadLimitation;
  const failedMeasureIds = new Set(
    bundle.measureFailures.map((failure) => failure.measureId)
  );
  const retryableFailures = bundle.measureFailures.filter(
    (failure) => failure.retryable !== false
  );
  const absentFailures = bundle.measureFailures.filter(
    (failure) => failure.retryable === false
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
  const findingSummary = resolveInvestigateFinding({
    bundle,
    catalogFailed,
    countyRecordError,
    countyRecordLoading,
    countyRecordPresent: countyRecord !== null,
    publishedRows,
  });
  const holdEmptyLimitation = countyRecordLoading && !limitation;
  const countyLimitationFailed =
    Boolean(countyRecordError) && !limitation && !published;
  const publishedCaveat =
    holdEmptyLimitation || countyLimitationFailed
      ? null
      : publishedCaveatRow(publishedRows);
  const coverageCaveat =
    coverage.find((row) => row.state.limitationText) ?? null;
  const limitationSummary = investigateHandoffLimitation({
    bundle,
    catalogFailed,
    countyRecordError,
    countyRecordLoading,
    countyRecordPresent: countyRecord !== null,
    publishedReleaseLimitation: published?.releaseLimitation,
    publishedRows,
  });
  const conflicts = investigateEvidenceConflicts(bundle);
  const multipleObservations = investigateMultipleObservations(bundle);
  const limitations = uniqueLines([
    observationStatus.flatMap((disclosure) => disclosure.gapLines),
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

  const showEvidence = region === "all" || region === "evidence";
  const showContext = region === "all" || region === "context";
  const regionTestId =
    region === "context" ? "investigate-context" : "investigate-evidence";

  return (
    <div
      data-county={bundle.county.fips}
      data-release={bundle.releaseId}
      data-testid={regionTestId}
    >
      {showEvidence && catalogFailed ? (
        <div data-testid="investigate-catalog-notice">
          <AtlasStatusMessage tone="error">
            The measure catalog could not be loaded. Published county rows are
            shown without an observation series.
          </AtlasStatusMessage>
        </div>
      ) : null}
      {showEvidence ? (
        <section
          className="ux-reset-investigate-summary"
          data-county={bundle.county.fips}
          data-evidence-state={findingSummary.availability}
          data-testid="investigate-finding"
        >
          <HierarchyHeading
            eyebrow="What we know"
            icon={Scale}
            level="h2"
            presentation={presentation}
            title={findingSummary.title}
          />
          <Card className="ux-reset-investigate-callout">
            <p className="type-body" data-testid="investigate-finding-text">
              {findingSummary.text}
            </p>
            {findingSummary.inspectHref ? (
              <a href={findingSummary.inspectHref}>Inspect this finding</a>
            ) : null}
          </Card>
        </section>
      ) : null}

      {omitDisclaimers || !showEvidence ? null : (
        <section
          className="ux-reset-investigate-summary"
          data-county={bundle.county.fips}
          data-testid="investigate-limitation"
        >
          <HierarchyHeading
            eyebrow="What is uncertain"
            icon={CircleAlert}
            level="h2"
            presentation={presentation}
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
      )}
      {showEvidence ? (
        <KnownEmptySelectionNotice
          omitCaveats={omitDisclaimers}
          selections={bundle.knownEmptySelections}
          testId="investigate-known-empty"
        />
      ) : null}

      {showEvidence ? (
        <div className="ux-reset-evidence-columns">
          {bundle.families.map((section) => (
            <div key={section.id}>
              <FamilySection
                catalogFailed={catalogFailed}
                countyFips={bundle.county.fips}
                countyRecordLoading={countyRecordLoading}
                domainsRequestFailed={bundle.domainsRequestFailed}
                failedMeasureIds={failedMeasureIds}
                hasUnclassifiedMeasures={
                  bundle.unclassifiedMeasureIds.length > 0
                }
                omitDisclaimers={omitDisclaimers}
                presentation={presentation}
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
                  <HierarchyHeading
                    eyebrow="Coverage"
                    icon={Gauge}
                    level="h2"
                    presentation={presentation}
                    title="Evidence sufficiency and coverage"
                  />
                  {countyRecordLoading ? (
                    <HierarchyLoading presentation={presentation}>
                      Loading published county coverage…
                    </HierarchyLoading>
                  ) : null}
                  {countyRecordError ? (
                    <AtlasStatusMessage tone="error">
                      {countyRecordError}
                    </AtlasStatusMessage>
                  ) : null}
                  {countyRecordRefreshError ? (
                    <AtlasStatusMessage tone="error">
                      {countyRecordRefreshError}
                    </AtlasStatusMessage>
                  ) : null}
                  {published ? (
                    <p
                      className="type-body"
                      data-testid="investigate-coverage-value"
                    >
                      {omitDisclaimers
                        ? `Published input coverage is ${published.completeness}%.`
                        : `Published input coverage is ${published.completeness}%. This is not a disease risk score. A lower number is not zero evidence.`}
                    </p>
                  ) : null}
                  {!published && !countyRecordLoading && !countyRecordError ? (
                    <p
                      className="type-body"
                      data-testid="investigate-coverage-value"
                    >
                      {omitDisclaimers
                        ? "Published input coverage was not returned for this county."
                        : "Published input coverage was not returned for this county. That is not zero coverage."}
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
                            presentation={evidencePresentation(presentation)}
                            showGovernedLimitations={!omitDisclaimers}
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
        </div>
      ) : null}

      {showContext ? (
        <section
          aria-label="Conflicts, gaps, and limitations"
          className="ux-reset-investigate-summary"
          data-evidence-class="limitation"
          data-testid="investigate-gaps"
          id={EXPLORER_SECTION_IDS.context}
        >
          <HierarchyHeading
            eyebrow="Limits"
            icon={CircleAlert}
            level="h2"
            presentation={presentation}
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
          {absentFailures.length > 0 ? (
            <div
              data-county={bundle.county.fips}
              data-testid="investigate-absent-measures"
            >
              <AtlasStatusMessage tone="empty">
                <p>
                  These measures have no published county observations. That is
                  missing evidence, not a failed request.
                </p>
                <ul>
                  {absentFailures.map((failure) => (
                    <li key={failure.measureId}>
                      {failure.measureLabel}. {failure.message}
                    </li>
                  ))}
                </ul>
              </AtlasStatusMessage>
            </div>
          ) : null}
          {retryableFailures.length > 0 ? (
            <div
              data-county={bundle.county.fips}
              data-testid="investigate-partial-failure"
            >
              <AtlasStatusMessage tone="error">
                <p>
                  Some measures could not be loaded. Evidence that loaded stays
                  on this county and is not marked unavailable.
                </p>
                <ul>
                  {retryableFailures.map((failure) => (
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
                    <RotateCcw aria-hidden="true" data-icon="inline-start" />
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
                  These measures were not queried. Their catalog period is not a
                  governed year or a selected day, and Atlas does not substitute
                  another period.
                </p>
                <ul>
                  {bundle.unsupportedPeriodMeasureIds.map((measureId) => {
                    const catalogPeriod = measures?.find(
                      (measure) => measure.measure_id === measureId
                    )?.temporal_semantics;
                    return (
                      <li key={measureId}>
                        {measureId}
                        {catalogPeriod
                          ? ` — catalog period: ${catalogPeriod}`
                          : ""}
                      </li>
                    );
                  })}
                </ul>
              </AtlasStatusMessage>
            </div>
          ) : null}
          {(!omitDisclaimers && limitations.length > 0) ||
          publishedGaps.length > 0 ? (
            <ul data-testid="investigate-gap-list">
              {omitDisclaimers
                ? null
                : limitations.map((line) => <li key={line}>{line}</li>)}
              {publishedGaps.map((line) => (
                <li key={line}>
                  {omitDisclaimers
                    ? line.replace(/ That is not zero\.$/, ".")
                    : line}
                </li>
              ))}
            </ul>
          ) : null}
          {omitDisclaimers || !published?.releaseLimitation ? null : (
            <p
              className="type-body"
              data-testid="investigate-release-limitation"
            >
              {published.releaseLimitation}
            </p>
          )}
          {bundle.unassigned.length > 0 ? (
            <section
              aria-label="Evidence without a family"
              className="ux-reset-investigate-family"
              data-county={bundle.county.fips}
              data-testid="investigate-unassigned"
            >
              <HierarchyHeading
                eyebrow="Evidence family"
                icon={Layers}
                level="h3"
                presentation={presentation}
                title="Domain not assigned"
              />
              <p className="type-body">
                These observations use a domain or indicator that is not on the
                family allowlist. That is unknown classification, not an
                unpublished family.
              </p>
              <FamilyObservations
                observations={bundle.unassigned}
                presentation={presentation}
                showGovernedLimitations={!omitDisclaimers}
              />
            </section>
          ) : null}
          {countyRecordLoading && !hasGapContent ? (
            <HierarchyLoading
              presentation={presentation}
              testId="investigate-gaps-pending"
            >
              Published county gaps are still loading.
            </HierarchyLoading>
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
      ) : null}
    </div>
  );
}
