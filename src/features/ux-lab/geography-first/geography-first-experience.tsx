import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  GEOGRAPHY_FIRST_CLINICIAN_TOPICS,
  GEOGRAPHY_FIRST_DEFAULT_PLACE_ID,
  GEOGRAPHY_FIRST_PROFESSIONAL_LINKS,
  GEOGRAPHY_FIRST_PUBLIC_TOPICS,
  GEOGRAPHY_FIRST_SURVEILLANCE_DISCLOSURES,
  geographyFirstPlaceHref,
  type GeographyFirstPlace,
} from "@/features/ux-lab/geography-first/sample-places";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";

const handoffLinkClassName = buttonVariants({
  className:
    "h-auto min-h-[var(--control-height)] justify-start px-4 py-2 text-left whitespace-normal",
  variant: "default",
});

const returnLinkClassName = buttonVariants({
  className: "h-[var(--control-height)] px-4",
  variant: "outline",
});

export function GeographyFirstMissing({
  requestedId,
}: {
  requestedId: string;
}) {
  return (
    <AtlasStatusMessage
      action={
        <Link
          className={returnLinkClassName}
          href={geographyFirstPlaceHref(GEOGRAPHY_FIRST_DEFAULT_PLACE_ID)}
        >
          Return to Sample County
        </Link>
      }
      className="geography-first-missing"
      title="Sample place not found"
      titleAs="h1"
    >
      <p>
        <strong>{requestedId}</strong> is not one of the fictional places in
        this prototype. This page does not look up governed counties.
      </p>
    </AtlasStatusMessage>
  );
}

export function GeographyFirstExperience({
  place,
}: {
  place: GeographyFirstPlace;
}) {
  const representative = place.id === GEOGRAPHY_FIRST_DEFAULT_PLACE_ID;

  return (
    <article className="geography-first-place-view">
      <header className="geography-first-place-header">
        <p className="eyebrow">Geography-first · shared place</p>
        <div className="geography-first-title-row">
          <h1 className="type-page">{place.name}</h1>
          <Badge variant="outline">
            {representative ? "Representative sample" : "Sample place"}
          </Badge>
        </div>
        <p className="type-body">{place.setting}</p>
        <p className="geography-first-lead type-body">
          {place.kind} pages in this prototype keep public education, clinician
          resources, and surveillance evidence on one place. Deeper material
          stays available without leading the page.
        </p>
      </header>

      <nav aria-label="Information depth" className="geography-first-depth">
        <ol>
          <li>
            <a href="#public-summary-section">Public summary</a>
            <span>Shown first</span>
          </li>
          <li>
            <a href="#clinicians-section">For clinicians</a>
            <span>Labeled section</span>
          </li>
          <li>
            <a href="#surveillance-section">Surveillance evidence</a>
            <span>Closed until opened</span>
          </li>
          <li>
            <a href="#professional-atlas-section">Professional Atlas</a>
            <span>Live handoff</span>
          </li>
        </ol>
      </nav>

      <section
        aria-labelledby="place-limits"
        className="geography-first-limits"
        id="place-limits-section"
        role="note"
      >
        <h2 id="place-limits">What this place does not mean</h2>
        <p>
          Living in {place.name} is not the same as exposure. A missing,
          suppressed, or unpublished record is not evidence that risk is absent.
          This page does not classify local risk, and it is not clinical
          guidance.
        </p>
        <p>{UX_LAB_SAMPLE_NOTICE}</p>
      </section>

      <section
        aria-labelledby="public-summary"
        className="geography-first-section"
        id="public-summary-section"
      >
        <AtlasSectionHeader
          className="geography-first-heading"
          description="Plain-language sample for people who are not surveillance specialists."
          eyebrow="Public"
          title="Public summary"
          titleId="public-summary"
        />
        <ul className="geography-first-topics">
          {GEOGRAPHY_FIRST_PUBLIC_TOPICS.map((topic) => (
            <li key={topic.id}>
              <h3 className="type-card">{topic.title}</h3>
              <p className="type-body">{topic.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="clinicians"
        className="geography-first-section geography-first-clinician"
        id="clinicians-section"
      >
        <AtlasSectionHeader
          className="geography-first-heading"
          description={`Resource labels for clinicians working from ${place.name}. They sit beside the public summary and do not replace it.`}
          eyebrow="Clinicians"
          title="For clinicians"
          titleId="clinicians"
        />
        <ul className="geography-first-cards">
          {GEOGRAPHY_FIRST_CLINICIAN_TOPICS.map((topic) => (
            <li key={topic.id}>
              <Card>
                <CardHeader>
                  <h3 className="type-card">{topic.title}</h3>
                  <CardDescription>{topic.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">Sample label</Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="surveillance"
        className="geography-first-section"
        id="surveillance-section"
      >
        <AtlasSectionHeader
          className="geography-first-heading"
          description="Deeper surveillance evidence stays closed until you open it."
          eyebrow="Public health"
          title="Surveillance evidence"
          titleId="surveillance"
        />
        <div className="geography-first-disclosures">
          {GEOGRAPHY_FIRST_SURVEILLANCE_DISCLOSURES.map((item) => (
            <details className="geography-first-disclosure" key={item.id}>
              <summary>{item.summary}</summary>
              <p>{item.body}</p>
            </details>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="professional-atlas"
        className="geography-first-section geography-first-handoff"
        id="professional-atlas-section"
      >
        <AtlasSectionHeader
          className="geography-first-heading"
          description={`${place.name} stays the subject of this handoff. The place is fictional, so these links open the live Atlas without a county identifier or a sample finding.`}
          eyebrow="Public health"
          title="Continue in the professional Atlas"
          titleId="professional-atlas"
        />
        <ul className="geography-first-handoff-list">
          {GEOGRAPHY_FIRST_PROFESSIONAL_LINKS.map((link) => (
            <li key={link.id}>
              <Link className={handoffLinkClassName} href={link.href}>
                {link.label}
              </Link>
              <p className="type-small">
                Continues {place.name}. {link.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
