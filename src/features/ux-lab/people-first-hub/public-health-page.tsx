import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
  PEOPLE_FIRST_PUBLIC_HEALTH_MODULES,
  PEOPLE_FIRST_PUBLIC_HEALTH_PLACE,
  PEOPLE_FIRST_TASKS,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubShell } from "@/features/ux-lab/people-first-hub/hub-shell";

const textLinkClassName = buttonVariants({
  className: "people-first-hub-path-link",
  variant: "outline",
});

export function PeopleFirstPublicHealthPage() {
  const task = PEOPLE_FIRST_TASKS["public-health"];

  return (
    <PeopleFirstHubShell current="public-health">
      <main className="people-first-hub-main people-first-hub-workspace">
        <header className="people-first-hub-workspace-mast">
          <p className="eyebrow">Atlas professional workspace</p>
          <h1 className="type-page">{task.navLabel}</h1>
          <p className="type-body people-first-hub-lead">{task.description}</p>
          <p className="people-first-hub-workspace-place">
            Place context: {PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.name},{" "}
            {PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.region}
          </p>
          <Badge className="people-first-hub-workspace-badge" variant="outline">
            Sample workspace
          </Badge>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
        </header>

        <section aria-labelledby="public-health-from-public">
          <h2 className="type-section" id="public-health-from-public">
            From the people-first front door
          </h2>
          <p className="type-body">
            A resident can read public paths without entering this workspace.
            Opening it is how an epidemiologist reaches Atlas tools that sit
            behind the same trustworthy brand—still under People-First Atlas
            navigation above.
          </p>
          <Link className={textLinkClassName} href={peopleFirstHubHref()}>
            Return to the front door
          </Link>
        </section>

        <section aria-labelledby="public-health-from-clinicians">
          <h2 className="type-section" id="public-health-from-clinicians">
            Related clinician resources
          </h2>
          <p className="type-body">
            Clinician listings stay in the lighter hub shell. Surveillance
            summaries and investigation entry stay here.
          </p>
          <Link
            className={textLinkClassName}
            href={peopleFirstHubHref("clinicians")}
          >
            Open clinician resources
          </Link>
        </section>

        <section aria-labelledby="public-health-modules">
          <h2 className="type-section" id="public-health-modules">
            Representative professional modules
          </h2>
          <ul className="people-first-hub-module-list">
            {PEOPLE_FIRST_PUBLIC_HEALTH_MODULES.map((module) => (
              <li key={module.id}>
                <Card>
                  <CardHeader>
                    <h3 className="type-card">{module.title}</h3>
                    <CardDescription>
                      Sample module for {PEOPLE_FIRST_PUBLIC_HEALTH_PLACE.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{module.summary}</p>
                    {module.id === "investigation-entry" ? (
                      <p className="type-small">
                        In the live Atlas, investigation work continues in the
                        Action Center. This prototype does not change that
                        workspace.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <nav
          aria-label="Cross-audience navigation"
          className="people-first-hub-cross-nav"
        >
          <p className="type-small">
            <Link
              className="people-first-hub-text-link"
              href={peopleFirstHubHref("learn")}
            >
              Return to Learn about Lyme (public path)
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
