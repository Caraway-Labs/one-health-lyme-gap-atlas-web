import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  GEOGRAPHY_FIRST_V2_CLINICIAN_BOUNDARY,
  GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID,
  geographyFirstV2ClinicianResources,
  type GeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";

export function GeographyFirstV2CliniciansExperience({
  place,
}: {
  place: GeographyFirstV2Place;
}) {
  const representative = place.id === GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID;
  const resources = geographyFirstV2ClinicianResources(place.name);

  return (
    <article className="geography-first-v2-place-view geography-first-v2-clinicians-view">
      <header className="geography-first-v2-place-header">
        <p className="eyebrow">Geography-first v2 · clinician context</p>
        <div className="geography-first-v2-title-row">
          <h1 className="type-page">{place.name}</h1>
          <Badge variant="outline">
            {representative ? "Representative sample" : "Sample place"}
          </Badge>
        </div>
        <p className="type-body">{place.setting}</p>
        <p className="geography-first-v2-lead type-body">
          Resource discovery and reporting cues for clinicians working from{" "}
          {place.name}. Surveillance summaries stay on other routes; this page
          is for applicable materials and jurisdiction context.
        </p>
      </header>

      <section
        aria-labelledby="clinician-boundary"
        className="geography-first-v2-boundaries geography-first-v2-clinician-boundary"
        id="clinician-boundary-section"
        role="note"
      >
        <h2 className="type-card" id="clinician-boundary">
          Not clinical care direction
        </h2>
        <p className="type-body">{GEOGRAPHY_FIRST_V2_CLINICIAN_BOUNDARY}</p>
        <AtlasDataStamp label="Sample clinician catalog cue">
          {UX_LAB_SAMPLE_NOTICE}
        </AtlasDataStamp>
      </section>

      <section
        aria-labelledby="clinician-resources"
        className="geography-first-v2-section"
        id="clinician-resources-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description="Each listing shows source, freshness, and applicability beside the title so readers can judge fit before opening material."
          eyebrow="Clinicians"
          title="Applicable resource discovery"
          titleId="clinician-resources"
        />
        <ul className="geography-first-v2-resource-list">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Card>
                <CardHeader>
                  <Badge variant="secondary">Sample listing</Badge>
                  <h3 className="type-card">{resource.title}</h3>
                  <CardDescription>{resource.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="geography-first-v2-meta">
                    <div>
                      <dt>Source</dt>
                      <dd>{resource.source}</dd>
                    </div>
                    <div>
                      <dt>Freshness</dt>
                      <dd>{resource.freshness}</dd>
                    </div>
                    <div>
                      <dt>Applicability</dt>
                      <dd>{resource.applicability}</dd>
                    </div>
                  </dl>
                  <p
                    className="geography-first-v2-limitation type-body"
                    role="note"
                  >
                    <strong>Boundary.</strong> {resource.boundary}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
