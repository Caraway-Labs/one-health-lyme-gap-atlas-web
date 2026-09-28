import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UX_LAB_CONCEPTS } from "@/features/ux-lab/prototype-contract";
import {
  PUBLIC_FIRST_CONTEXT_ROWS,
  PUBLIC_FIRST_EDUCATION,
  PUBLIC_FIRST_SAMPLE_NOTICE,
  publicFirstHref,
  type PublicFirstSelection,
} from "@/features/ux-lab/public-first/content";
import { PlaceLookup } from "@/features/ux-lab/public-first/place-lookup";

const pathwayLinkClassName = buttonVariants({
  className: "public-first-pathway-link",
  variant: "outline",
});

const educationLinkClassName = buttonVariants({
  className: "public-first-education-link public-first-primary-link",
});

function publicFirstConcept() {
  const concept = UX_LAB_CONCEPTS.find((item) => item.id === "public-first");
  if (!concept) {
    throw new Error(
      "Public-first concept is missing from the UX Lab contract."
    );
  }
  return concept;
}

export function PublicFirstFrontDoor({
  selection,
}: {
  selection: PublicFirstSelection;
}) {
  const { place, unrecognizedPlace } = selection;
  const concept = publicFirstConcept();

  return (
    <main className="public-first">
      <div className="public-first-layout">
        <div className="public-first-primary">
          <header className="public-first-intro">
            <p className="eyebrow">Public local information</p>
            <h1 className="public-first-title">{place.name} local snapshot</h1>
            <p className="public-first-lead">
              Lyme disease and ticks are easier to understand from a place. This
              front door opens on a local snapshot in plain language. You do not
              need to choose a professional role to get started.
            </p>
          </header>

          <PlaceLookup placeId={place.id} />

          {unrecognizedPlace ? (
            <p className="public-first-status" role="status">
              That sample place is not in this prototype. Showing {place.name}.
            </p>
          ) : null}

          <article
            aria-labelledby="public-first-snapshot"
            className="public-first-snapshot"
          >
            <div className="public-first-snapshot-heading">
              <div>
                <p className="eyebrow">Sample geography</p>
                <h2 id="public-first-snapshot">
                  {place.kind} in {place.region}
                </h2>
                <p>
                  {place.name} is a fictional stand-in for a location-shaped
                  layout. It is not a real county finding.
                </p>
              </div>
              <Badge variant="outline">Sample data</Badge>
            </div>

            <div className="public-first-schematic">
              <p className="public-first-schematic-name">{place.name}</p>
              <p>Schematic place marker. Not a surveillance map.</p>
            </div>

            <div
              className="public-first-distinction"
              aria-labelledby="public-first-distinction-title"
            >
              <h3 id="public-first-distinction-title">
                Surveillance context is not personal medical risk
              </h3>
              <div className="public-first-distinction-grid">
                <Card>
                  <CardHeader>
                    <h4 className="type-card">Surveillance context</h4>
                  </CardHeader>
                  <CardContent>
                    <p>
                      This column is for the kinds of monitoring topics a health
                      department might review for a place. {place.name} has no
                      connected surveillance feed in this prototype.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <h4 className="type-card">Individual medical questions</h4>
                  </CardHeader>
                  <CardContent>
                    <p>
                      This snapshot does not estimate whether a person will
                      become ill, where an infection happened, or what care to
                      seek. It does not score counties, and it does not claim
                      that local transmission is occurring in {place.name}.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <ul className="public-first-context-list">
              {PUBLIC_FIRST_CONTEXT_ROWS.map((row) => (
                <li key={row.id}>
                  <Card>
                    <CardHeader>
                      <h3 className="type-card">{row.title}</h3>
                    </CardHeader>
                    <CardContent>
                      <p>{row.summary}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>

            <p className="public-first-notice">{PUBLIC_FIRST_SAMPLE_NOTICE}</p>
          </article>

          <section
            aria-labelledby="public-first-education"
            className="public-first-education"
          >
            <div>
              <h2 id="public-first-education">Prevention and education</h2>
              <p>
                Public materials often group tick awareness, prevention topics,
                and outreach in one place. These calls to action show that
                structure. They are not instructions for a person.
              </p>
            </div>
            <div className="public-first-education-actions">
              {PUBLIC_FIRST_EDUCATION.map((topic) => (
                <a
                  className={educationLinkClassName}
                  href={`#${topic.id}`}
                  key={topic.id}
                >
                  Read {topic.title.toLowerCase()}
                </a>
              ))}
            </div>
            <ul className="public-first-education-list">
              {PUBLIC_FIRST_EDUCATION.map((topic) => (
                <li key={topic.id} id={topic.id}>
                  <h3 className="type-card">{topic.title}</h3>
                  <p>{topic.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside
          className="public-first-aside"
          aria-labelledby="public-first-pathways"
        >
          <p className="eyebrow">Also available</p>
          <h2 id="public-first-pathways">Professional pathways</h2>
          <p>
            Clinician and public-health tools stay reachable from this snapshot.
            They are secondary to the public local view.
          </p>
          <Card>
            <CardHeader>
              <h3 className="type-card">Clinical Resources</h3>
              <CardDescription>
                Sample listings for clinician education and reporting contacts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={pathwayLinkClassName}
                href={publicFirstHref(place.id, "clinical")}
              >
                Open Clinical Resources
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="type-card">Public Health & Surveillance</h3>
              <CardDescription>
                The Atlas workspace for evidence review and investigation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={pathwayLinkClassName}
                href={publicFirstHref(place.id, "surveillance")}
              >
                Open Public Health & Surveillance
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>

      <footer className="public-first-hypothesis">
        <p>
          Prototype hypothesis: {concept.hypothesis} {concept.difference}
        </p>
      </footer>
    </main>
  );
}
