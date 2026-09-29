import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  LIVING_WITH_LYME_RESOURCES,
  LIVING_WITH_LYME_SECTIONS,
  PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubShell } from "@/features/ux-lab/people-first-hub/hub-shell";

export function LivingWithLymePage() {
  return (
    <PeopleFirstHubShell current="living-with-lyme">
      <main className="people-first-hub-main">
        <header className="people-first-hub-page-intro">
          <p className="eyebrow">Living with Lyme</p>
          <h1 className="type-page">
            Ongoing concerns and credible next reads
          </h1>
          <p className="type-body people-first-hub-lead">
            Atlas can acknowledge people already affected by Lyme—not only
            visitors looking for prevention. This sample page shows trustworthy
            resource cards with explicit source-neutral placeholders. It is not
            clinical guidance or a care plan.
          </p>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
        </header>

        {LIVING_WITH_LYME_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="type-section">{section.heading}</h2>
            <p className="type-body">{section.body}</p>
          </section>
        ))}

        <section aria-labelledby="living-with-lyme-resources">
          <h2 className="type-section" id="living-with-lyme-resources">
            Representative resources
          </h2>
          <p className="type-body">
            Each card follows a trustworthy-resource pattern: title, summary,
            sample source, freshness, and boundary text.
          </p>
          <ul className="people-first-hub-resource-list">
            {LIVING_WITH_LYME_RESOURCES.map((resource) => (
              <li key={resource.id}>
                <Card>
                  <CardHeader>
                    <div className="people-first-hub-card-heading">
                      <h3 className="type-card">{resource.title}</h3>
                      <Badge variant="outline">Sample resource</Badge>
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

        <p className="type-body">
          <Link
            className="people-first-hub-text-link"
            href={peopleFirstHubHref()}
          >
            Back to People-First Atlas front door
          </Link>
        </p>
      </main>
    </PeopleFirstHubShell>
  );
}
