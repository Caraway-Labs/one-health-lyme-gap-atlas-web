import Link from "next/link";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  CLINICIAN_SURVEILLANCE_CONTEXT,
  PEOPLE_FIRST_CLINICIAN_RESOURCES,
  PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
  PEOPLE_FIRST_TASKS,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubShell } from "@/features/ux-lab/people-first-hub/hub-shell";

const continueClassName = buttonVariants({
  className: "people-first-hub-path-link people-first-hub-path-link-primary",
  variant: "outline",
});

const clinicalResources = PEOPLE_FIRST_CLINICIAN_RESOURCES.filter(
  (resource) => resource.kind !== "reporting"
);
const reportingResources = PEOPLE_FIRST_CLINICIAN_RESOURCES.filter(
  (resource) => resource.kind === "reporting"
);

export function PeopleFirstCliniciansPage() {
  const task = PEOPLE_FIRST_TASKS.clinicians;

  return (
    <PeopleFirstHubShell current="clinicians">
      <main className="people-first-hub-main">
        <header className="people-first-hub-page-intro">
          <p className="eyebrow">{task.navLabel}</p>
          <h1 className="type-page">
            Professional materials in the same Atlas
          </h1>
          <p className="type-body people-first-hub-lead">{task.description}</p>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
          <AtlasDataStamp label="Sample catalog cue">
            Listings are layout samples. They are not clinical guidance and do
            not start a reporting workflow.
          </AtlasDataStamp>
        </header>

        <aside className="people-first-hub-boundary">
          <h2 className="type-card">
            {CLINICIAN_SURVEILLANCE_CONTEXT.heading}
          </h2>
          <p className="type-body">{CLINICIAN_SURVEILLANCE_CONTEXT.body}</p>
          <p className="type-body">
            <Link
              className="people-first-hub-text-link"
              href={peopleFirstHubHref("public-health")}
            >
              Open public-health tools for surveillance context
            </Link>
          </p>
        </aside>

        <section aria-labelledby="clinician-clinical-guidance">
          <h2 className="type-section" id="clinician-clinical-guidance">
            Clinical guidance and patient materials
          </h2>
          <p className="type-body">
            Cards below use the same trustworthy-resource pattern as public
            paths, with applicability cues so clinicians can judge fit before
            opening a governed destination.
          </p>
          <ul className="people-first-hub-resource-list">
            {clinicalResources.map((resource) => (
              <li key={resource.id}>
                <Card>
                  <CardHeader>
                    <div className="people-first-hub-card-heading">
                      <h3 className="type-card">{resource.title}</h3>
                      <Badge variant="outline">Sample listing</Badge>
                    </div>
                    <CardDescription>{resource.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="people-first-hub-meta">
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
                      <div>
                        <dt>Boundary</dt>
                        <dd>{resource.boundary}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {reportingResources.length > 0 ? (
          <section aria-labelledby="clinician-reporting">
            <h2 className="type-section" id="clinician-reporting">
              Reporting resources (administrative lane)
            </h2>
            <p className="type-body">
              Reporting contacts sit beside clinical materials but are labeled
              separately so they are not mistaken for care guidance.
            </p>
            <ul className="people-first-hub-resource-list">
              {reportingResources.map((resource) => (
                <li key={resource.id}>
                  <Card>
                    <CardHeader>
                      <div className="people-first-hub-card-heading">
                        <h3 className="type-card">{resource.title}</h3>
                        <Badge variant="secondary">Reporting lane</Badge>
                      </div>
                      <CardDescription>{resource.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <dl className="people-first-hub-meta">
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
                      <p className="type-small">{resource.boundary}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          aria-labelledby="clinician-continue"
          className="people-first-hub-continue"
        >
          <h2 className="type-section" id="clinician-continue">
            Continue into public-health tools
          </h2>
          <p className="type-body">
            Evidence review, methods, and investigation entry live in the
            differentiated professional path—without leaving the People-First
            Atlas navigation.
          </p>
          <Link
            className={continueClassName}
            href={peopleFirstHubHref("public-health")}
          >
            Open public-health tools
          </Link>
        </section>

        <nav
          aria-label="Cross-audience navigation"
          className="people-first-hub-cross-nav"
        >
          <p className="type-small">
            <Link
              className="people-first-hub-text-link"
              href={peopleFirstHubHref("living-with-lyme")}
            >
              Return to Living with Lyme (public path)
            </Link>
            {" · "}
            <Link
              className="people-first-hub-text-link"
              href={peopleFirstHubHref()}
            >
              Back to People-First Atlas front door
            </Link>
          </p>
        </nav>
      </main>
    </PeopleFirstHubShell>
  );
}
