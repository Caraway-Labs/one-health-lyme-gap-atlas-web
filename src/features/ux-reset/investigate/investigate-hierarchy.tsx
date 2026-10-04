import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Card } from "@/components/ui/card";
import { EvidenceObject } from "@/features/ux-reset/evidence";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import type {
  CountyEvidenceBundle,
  CountyEvidenceFamilySection,
  CountyEvidenceObservation,
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

function FamilySection({
  countyFips,
  domainsRequestFailed,
  failedMeasureIds,
  section,
}: {
  countyFips: string;
  domainsRequestFailed: boolean;
  failedMeasureIds: ReadonlySet<string>;
  section: CountyEvidenceFamilySection;
}) {
  const measuresFailed =
    section.measureIds.length > 0 &&
    section.measureIds.every((measureId) => failedMeasureIds.has(measureId));
  let publication:
    | "assigned"
    | "domains_unavailable"
    | "not_in_release"
    | "request_failed" = "assigned";
  if (domainsRequestFailed) {
    publication = "domains_unavailable";
  } else if (section.measureIds.length === 0) {
    publication = "not_in_release";
  } else if (measuresFailed && section.observations.length === 0) {
    publication = "request_failed";
  }
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
      {publication === "domains_unavailable" ? (
        <p className="type-body">
          Indicator domains could not be loaded, so observations are not
          assigned to this family.
        </p>
      ) : null}
      {publication === "not_in_release" ? (
        <p className="type-body">
          This release does not publish measures for this evidence family.
        </p>
      ) : null}
      {publication === "request_failed" ? (
        <p className="type-body">
          Measures in this family could not be loaded. That is a request
          failure, not unavailable evidence.
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
}: {
  bundle: CountyEvidenceBundle;
}) {
  const finding = bundle.leadFinding;
  const limitation = bundle.leadLimitation;
  const failedMeasureIds = new Set(
    bundle.measureFailures.map((failure) => failure.measureId)
  );
  const known = finding
    ? `${finding.measureLabel}: ${finding.evidence.displayValue}. ${evidenceAvailabilityLabel(finding.evidence.availability)}. Period ${finding.evidence.provenance.observationPeriod}. Source ${finding.evidence.provenance.sourceFamily}.`
    : "No observed or limited finding was published for this county in this release.";
  const uncertain = limitation
    ? `${limitation.observation.measureLabel}: ${limitation.text}`
    : "No material limitation was published on the observations returned for this county.";

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
          title={finding ? finding.measureLabel : "No published finding"}
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
              : "No published limitation"
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
          </AtlasStatusMessage>
        </div>
      ) : null}

      {bundle.families.map((section) => (
        <FamilySection
          countyFips={bundle.county.fips}
          domainsRequestFailed={bundle.domainsRequestFailed}
          failedMeasureIds={failedMeasureIds}
          key={section.id}
          section={section}
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
            These observations did not include a governed human, vector,
            pathogen, environmental, or population domain.
          </p>
          <FamilyObservations observations={bundle.unassigned} />
        </section>
      ) : null}
    </div>
  );
}
