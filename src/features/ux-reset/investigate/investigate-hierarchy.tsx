import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EvidenceObject } from "@/features/ux-reset/evidence";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import {
  countyEvidenceGap,
  investigateFamilyPublication,
  type CountyEvidenceBundle,
  type CountyEvidenceFamilySection,
  type CountyEvidenceGap,
  type CountyEvidenceObservation,
  type FamilyPublication,
} from "@/features/ux-reset/investigate/county-evidence";

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

function gapCopy(
  gap: CountyEvidenceGap,
  subject: "finding" | "limitation"
): string {
  switch (gap) {
    case "failed": {
      return subject === "finding"
        ? "County evidence could not be loaded. That is a request failure, not a statement that no finding was published."
        : "A limitation was not read because the evidence requests failed.";
    }
    case "mixed": {
      return "Some measures failed to load, and others were not queried because the period is not a supported bound.";
    }
    case "returned_empty": {
      return subject === "finding"
        ? "No observed or limited finding was returned for this county."
        : "No material limitation was returned on the observations for this county.";
    }
    case "unsupported_period": {
      return "The selected period is not a supported bound for the published measures, so no observation query was sent.";
    }
    default: {
      const exhaustive: never = gap;
      return exhaustive;
    }
  }
}

function gapTitle(
  gap: CountyEvidenceGap,
  subject: "finding" | "limitation"
): string {
  switch (gap) {
    case "failed": {
      return "Evidence did not load";
    }
    case "mixed": {
      return "Evidence is incomplete";
    }
    case "returned_empty": {
      return subject === "finding"
        ? "No returned finding"
        : "No returned limitation";
    }
    case "unsupported_period": {
      return "Period is not supported";
    }
    default: {
      const exhaustive: never = gap;
      return exhaustive;
    }
  }
}

function FamilySection({
  countyFips,
  domainsRequestFailed,
  failedMeasureIds,
  hasUnclassifiedMeasures,
  section,
  unsupportedMeasureIds,
}: {
  countyFips: string;
  domainsRequestFailed: boolean;
  failedMeasureIds: ReadonlySet<string>;
  hasUnclassifiedMeasures: boolean;
  section: CountyEvidenceFamilySection;
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
  return (
    <section
      aria-label={section.label}
      className="ux-reset-investigate-family"
      data-county={countyFips}
      data-family={section.id}
      data-publication={publication}
      data-testid={`investigate-family-${section.id}`}
    >
      <AtlasSectionHeader
        eyebrow="Evidence family"
        headingLevel="h3"
        title={section.label}
      />
      {section.contextNote ? (
        <p className="type-body">{section.contextNote}</p>
      ) : null}
      {copy ? <p className="type-body">{copy}</p> : null}
      {publication === "empty" ? (
        <p className="type-body" data-testid="investigate-family-empty">
          No governed observations were returned for this family.
        </p>
      ) : null}
      {publication === "assigned" ? (
        <FamilyObservations observations={section.observations} />
      ) : null}
    </section>
  );
}

export function InvestigateEvidenceHierarchy({
  bundle,
  onRetryFailures,
}: {
  bundle: CountyEvidenceBundle;
  onRetryFailures?: () => void;
}) {
  const finding = bundle.leadFinding;
  const limitation = bundle.leadLimitation;
  const failedMeasureIds = new Set(
    bundle.measureFailures.map((failure) => failure.measureId)
  );
  const unsupportedMeasureIds = new Set(bundle.unsupportedPeriodMeasureIds);
  const gap = countyEvidenceGap(bundle);
  const handleRetryFailures = () => {
    onRetryFailures?.();
  };
  const known = finding
    ? `${finding.measureLabel}: ${finding.evidence.displayValue}. ${evidenceAvailabilityLabel(finding.evidence.availability)}. Period ${finding.evidence.provenance.observationPeriod}. Source ${finding.evidence.provenance.sourceFamily}.`
    : gap
      ? gapCopy(gap, "finding")
      : gapCopy("returned_empty", "finding");
  const uncertain = limitation
    ? `${limitation.observation.measureLabel}: ${limitation.text}`
    : gap
      ? gapCopy(gap, "limitation")
      : gapCopy("returned_empty", "limitation");

  return (
    <div
      data-county={bundle.county.fips}
      data-release={bundle.releaseId}
      data-testid="investigate-evidence"
    >
      <section
        className="ux-reset-investigate-summary"
        data-county={bundle.county.fips}
        data-testid="investigate-finding"
      >
        <AtlasSectionHeader
          eyebrow="What we know"
          headingLevel="h2"
          title={
            finding
              ? finding.measureLabel
              : gapTitle(gap ?? "returned_empty", "finding")
          }
        />
        <Card className="ux-reset-investigate-callout">
          <p className="type-body" data-testid="investigate-finding-text">
            {known}
          </p>
          {finding ? (
            <a
              href={`#${observationAnchor(finding.observation.observation_id)}`}
            >
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
          title={
            limitation
              ? limitation.observation.measureLabel
              : gapTitle(gap ?? "returned_empty", "limitation")
          }
        />
        <Card className="ux-reset-investigate-callout">
          <p className="type-body" data-testid="investigate-limitation-text">
            {uncertain}
          </p>
          {limitation ? (
            <a
              href={`#${observationAnchor(limitation.observation.observation.observation_id)}`}
            >
              Inspect this limitation
            </a>
          ) : null}
        </Card>
      </section>

      <section
        aria-label="What context matters"
        className="ux-reset-investigate-summary"
      >
        <AtlasSectionHeader
          eyebrow="What context matters"
          headingLevel="h2"
          title="Environmental and population context"
        />
      </section>

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
                data-testid="investigate-retry-evidence"
                type="button"
                variant="secondary"
                onClick={handleRetryFailures}
              >
                Retry evidence that did not load
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

      {bundle.families.map((section) => (
        <FamilySection
          countyFips={bundle.county.fips}
          domainsRequestFailed={bundle.domainsRequestFailed}
          failedMeasureIds={failedMeasureIds}
          hasUnclassifiedMeasures={bundle.unclassifiedMeasureIds.length > 0}
          key={section.id}
          section={section}
          unsupportedMeasureIds={unsupportedMeasureIds}
        />
      ))}

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
            These observations use a domain that is not on the family allowlist,
            including a missing domain. That is unknown classification, not an
            unpublished family.
          </p>
          <FamilyObservations observations={bundle.unassigned} />
        </section>
      ) : null}
    </div>
  );
}
