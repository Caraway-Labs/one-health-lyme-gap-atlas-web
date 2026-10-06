import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EvidenceObject } from "@/features/ux-reset/evidence";
import {
  investigateFamilyPublication,
  type CountyEvidenceBundle,
  type CountyEvidenceFamilySection,
  type CountyEvidenceObservation,
  type FamilyPublication,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateFindingSummary,
  investigateLimitationSummary,
} from "@/features/ux-reset/investigate/investigate-visible-summary";

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
  retrying = false,
}: {
  bundle: CountyEvidenceBundle;
  onRetryFailures?: () => void;
  retrying?: boolean;
}) {
  const finding = bundle.leadFinding;
  const limitation = bundle.leadLimitation;
  const findingSummary = investigateFindingSummary(bundle);
  const limitationSummary = investigateLimitationSummary(bundle);
  const failedMeasureIds = new Set(
    bundle.measureFailures.map((failure) => failure.measureId)
  );
  const unsupportedMeasureIds = new Set(bundle.unsupportedPeriodMeasureIds);
  const handleRetryFailures = () => {
    onRetryFailures?.();
  };

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
