import Link from "next/link";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID,
  GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES,
  GEOGRAPHY_FIRST_V2_GENERAL_EDUCATION,
  GEOGRAPHY_FIRST_V2_LIVED_EXPERIENCE,
  geographyFirstV2LocalClaims,
  geographyFirstV2PlaceHref,
  type GeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";

const nonGeographicLinkClassName = buttonVariants({
  className:
    "geography-first-v2-path-link h-auto min-h-[var(--control-height)] justify-start px-4 py-2 text-left whitespace-normal",
  variant: "outline",
});

const returnLinkClassName = buttonVariants({
  className: "h-[var(--control-height)] px-4",
  variant: "outline",
});

export function GeographyFirstV2Missing({
  requestedId,
}: {
  requestedId: string;
}) {
  return (
    <AtlasStatusMessage
      action={
        <Link
          className={returnLinkClassName}
          href={geographyFirstV2PlaceHref(GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID)}
        >
          Return to Ridge Sample County
        </Link>
      }
      className="geography-first-v2-missing"
      title="Sample place not found"
      titleAs="h1"
    >
      <p>
        <strong>{requestedId}</strong> is not one of the fictional places in
        this v2 prototype. This page does not look up governed counties.
      </p>
    </AtlasStatusMessage>
  );
}

export function GeographyFirstV2NonGeographicPaths() {
  return (
    <nav
      aria-labelledby="geography-first-v2-without-place"
      className="geography-first-v2-non-geographic"
    >
      <h2 className="type-section" id="geography-first-v2-without-place">
        Without choosing a place
      </h2>
      <p className="type-body">
        Geography is the main entry, but not every question starts with a map.
        These sample paths stay visible for general education and for people
        already affected by Lyme.
      </p>
      <ul className="geography-first-v2-path-list">
        <li>
          <a
            className={nonGeographicLinkClassName}
            href="#general-education-section"
          >
            General Lyme education
          </a>
        </li>
        <li>
          <a
            className={nonGeographicLinkClassName}
            href="#living-with-lyme-section"
          >
            Living with Lyme / ongoing concerns
          </a>
        </li>
      </ul>
    </nav>
  );
}

export function GeographyFirstV2Experience({
  place,
}: {
  place: GeographyFirstV2Place;
}) {
  const representative = place.id === GEOGRAPHY_FIRST_V2_DEFAULT_PLACE_ID;
  const localClaims = geographyFirstV2LocalClaims(place.name);

  return (
    <article className="geography-first-v2-place-view">
      <header className="geography-first-v2-place-header">
        <p className="eyebrow">Geography-first v2 · local entry</p>
        <div className="geography-first-v2-title-row">
          <h1 className="type-page">{place.name}</h1>
          <Badge variant="outline">
            {representative ? "Representative sample" : "Sample place"}
          </Badge>
        </div>
        <p className="type-body">{place.setting}</p>
        <p className="geography-first-v2-lead type-body">
          Start from {place.name} to read a plain-language local summary. This
          prototype tests whether place feels relevant without turning
          surveillance into personal risk guidance.
        </p>
      </header>

      <section
        aria-labelledby="evidence-boundaries"
        className="geography-first-v2-boundaries"
        id="evidence-boundaries-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description="Essential limits for this place. You do not need to open methodology to see them."
          eyebrow="Evidence boundaries"
          title="What Atlas can and cannot say here"
          titleId="evidence-boundaries"
        />
        <ul className="geography-first-v2-boundary-list">
          {GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES.map((boundary) => (
            <li key={boundary.id}>
              <h3 className="type-card">{boundary.label}</h3>
              <p className="type-body">{boundary.detail}</p>
            </li>
          ))}
        </ul>
        <p className="geography-first-v2-notice type-small">
          {UX_LAB_SAMPLE_NOTICE}
        </p>
      </section>

      <section
        aria-labelledby="local-summary"
        className="geography-first-v2-section"
        id="local-summary-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description="Sample surveillance context for people who are not epidemiologists. Limitations sit beside each claim."
          eyebrow="Public"
          title="Local summary"
          titleId="local-summary"
        />
        <ul className="geography-first-v2-claims">
          {localClaims.map((row) => (
            <li key={row.id}>
              <h3 className="type-card">{row.title}</h3>
              <p className="type-body">{row.claim}</p>
              <p
                className="geography-first-v2-limitation type-body"
                role="note"
              >
                <strong>Limitation.</strong> {row.limitation}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="general-education"
        className="geography-first-v2-section geography-first-v2-education"
        id="general-education-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description="Reachable without selecting a different place. Sample education labels only."
          eyebrow="Education"
          title="General Lyme education"
          titleId="general-education"
        />
        <ul className="geography-first-v2-topic-list">
          {GEOGRAPHY_FIRST_V2_GENERAL_EDUCATION.map((topic) => (
            <li key={topic.id} id={`education-${topic.id}`}>
              <h3 className="type-card">{topic.title}</h3>
              <p className="type-body">{topic.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="living-with-lyme"
        className="geography-first-v2-section geography-first-v2-lived"
        id="living-with-lyme-section"
      >
        <AtlasSectionHeader
          className="geography-first-v2-heading"
          description="For people whose primary need may not be geographic. Not clinical guidance."
          eyebrow="Lived experience"
          title="Living with Lyme / ongoing concerns"
          titleId="living-with-lyme"
        />
        <ul className="geography-first-v2-topic-list">
          {GEOGRAPHY_FIRST_V2_LIVED_EXPERIENCE.map((topic) => (
            <li key={topic.id} id={`lived-${topic.id}`}>
              <h3 className="type-card">{topic.title}</h3>
              <p className="type-body">{topic.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
