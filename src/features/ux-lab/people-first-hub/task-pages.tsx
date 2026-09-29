import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  LEARN_TOPIC_CARDS,
  LOCAL_CONTEXT_PLACE,
  LOCAL_CONTEXT_ROWS,
  PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
  PEOPLE_FIRST_TASKS,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubShell } from "@/features/ux-lab/people-first-hub/hub-shell";

export function PeopleFirstLearnPage() {
  const task = PEOPLE_FIRST_TASKS.learn;

  return (
    <PeopleFirstHubShell current="learn">
      <main className="people-first-hub-main">
        <header className="people-first-hub-page-intro">
          <p className="eyebrow">{task.navLabel}</p>
          <h1 className="type-page">Background in plain language</h1>
          <p className="type-body people-first-hub-lead">{task.description}</p>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
        </header>
        <ul className="people-first-hub-topic-list">
          {LEARN_TOPIC_CARDS.map((topic) => (
            <li key={topic.id}>
              <Card>
                <CardHeader>
                  <h2 className="type-card">{topic.title}</h2>
                </CardHeader>
                <CardContent>
                  <p>{topic.summary}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
        <BackLink />
      </main>
    </PeopleFirstHubShell>
  );
}

export function PeopleFirstLocalContextPage() {
  const task = PEOPLE_FIRST_TASKS["local-context"];

  return (
    <PeopleFirstHubShell current="local-context">
      <main className="people-first-hub-main">
        <header className="people-first-hub-page-intro">
          <p className="eyebrow">{task.navLabel}</p>
          <h1 className="type-page">
            {LOCAL_CONTEXT_PLACE.name} context sample
          </h1>
          <p className="type-body people-first-hub-lead">{task.description}</p>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
        </header>
        <article className="people-first-hub-local">
          <div className="people-first-hub-local-heading">
            <div>
              <p className="eyebrow">Sample geography</p>
              <h2 className="type-section">
                {LOCAL_CONTEXT_PLACE.kind} in {LOCAL_CONTEXT_PLACE.region}
              </h2>
              <p className="type-body">
                {LOCAL_CONTEXT_PLACE.name} is a fictional stand-in. It is not a
                real county finding and does not describe transmission in your
                area.
              </p>
            </div>
            <Badge variant="outline">Sample data</Badge>
          </div>
          <ul className="people-first-hub-topic-list">
            {LOCAL_CONTEXT_ROWS.map((row) => (
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
        </article>
        <BackLink />
      </main>
    </PeopleFirstHubShell>
  );
}

function BackLink() {
  return (
    <p className="type-body">
      <Link className="people-first-hub-text-link" href={peopleFirstHubHref()}>
        Back to People-First Atlas front door
      </Link>
    </p>
  );
}
