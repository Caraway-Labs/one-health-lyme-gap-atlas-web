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
  PEOPLE_FIRST_HUB_HYPOTHESIS,
  PEOPLE_FIRST_HUB_SAMPLE_NOTICE,
  PEOPLE_FIRST_TASK_IDS,
  PEOPLE_FIRST_TASKS,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubShell } from "@/features/ux-lab/people-first-hub/hub-shell";

const taskLinkClassName = buttonVariants({
  className: "people-first-hub-path-link",
  variant: "outline",
});

const featuredLinkClassName = buttonVariants({
  className: "people-first-hub-path-link people-first-hub-path-link-primary",
  variant: "outline",
});

export function PeopleFirstHubFrontDoor() {
  const publicTasks = PEOPLE_FIRST_TASK_IDS.filter(
    (id) => PEOPLE_FIRST_TASKS[id].audience === "public"
  );
  const professionalTasks = PEOPLE_FIRST_TASK_IDS.filter(
    (id) => PEOPLE_FIRST_TASKS[id].audience === "professional"
  );

  return (
    <PeopleFirstHubShell current="hub">
      <main className="people-first-hub-main">
        <header className="people-first-hub-intro">
          <p className="eyebrow">One Health Lyme Gap Atlas</p>
          <h1 className="type-page">
            Understand Lyme in the Atlas that serves your community
          </h1>
          <p className="type-body people-first-hub-lead">
            Atlas helps public-health teams, clinicians, and residents work from
            the same trustworthy information. Choose what you need to do—not who
            you are. Prevention, tick encounters, and ongoing Lyme concerns all
            have a place here.
          </p>
          <p className="people-first-hub-sample type-small">
            {PEOPLE_FIRST_HUB_SAMPLE_NOTICE}
          </p>
        </header>

        <section
          aria-labelledby="people-first-hub-tasks"
          className="people-first-hub-tasks"
        >
          <h2 className="type-section" id="people-first-hub-tasks">
            What do you need today?
          </h2>
          <ul className="people-first-hub-task-grid">
            {publicTasks.map((taskId) => {
              const task = PEOPLE_FIRST_TASKS[taskId];
              const isFeatured = task.emphasis === "featured";
              return (
                <li key={taskId}>
                  <Card
                    className={
                      isFeatured ? "people-first-hub-card-featured" : undefined
                    }
                  >
                    <CardHeader>
                      <div className="people-first-hub-card-heading">
                        <h3 className="type-card">{task.navLabel}</h3>
                        {isFeatured ? (
                          <Badge variant="secondary">Featured path</Badge>
                        ) : null}
                      </div>
                      <CardDescription>{task.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="people-first-hub-card-actions">
                      <p className="type-small">{task.summary}</p>
                      <Link
                        className={
                          isFeatured ? featuredLinkClassName : taskLinkClassName
                        }
                        href={peopleFirstHubHref(taskId)}
                      >
                        Open {task.navLabel}
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="people-first-hub-professional"
          className="people-first-hub-professional"
        >
          <p className="eyebrow">Also in Atlas</p>
          <h2 className="type-section" id="people-first-hub-professional">
            Professional resources
          </h2>
          <p className="type-body">
            Clinician and public-health tools stay easy to find without turning
            the front door into an analytics dashboard.
          </p>
          <ul className="people-first-hub-professional-grid">
            {professionalTasks.map((taskId) => {
              const task = PEOPLE_FIRST_TASKS[taskId];
              return (
                <li key={taskId}>
                  <Card>
                    <CardHeader>
                      <h3 className="type-card">{task.navLabel}</h3>
                      <CardDescription>{task.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link
                        className={taskLinkClassName}
                        href={peopleFirstHubHref(taskId)}
                      >
                        Open {task.navLabel}
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="people-first-hub-hypothesis">
          <p className="type-small">
            Prototype hypothesis: {PEOPLE_FIRST_HUB_HYPOTHESIS}
          </p>
        </footer>
      </main>
    </PeopleFirstHubShell>
  );
}
