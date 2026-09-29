import Link from "next/link";
import type { ReactNode } from "react";

import {
  PEOPLE_FIRST_HUB_PATH,
  PEOPLE_FIRST_TASK_IDS,
  PEOPLE_FIRST_TASKS,
  peopleFirstHubHref,
  type PeopleFirstTaskId,
} from "@/features/ux-lab/people-first-hub/content";

export function PeopleFirstHubShell({
  children,
  current,
}: {
  children: ReactNode;
  current: PeopleFirstTaskId | "hub";
}) {
  return (
    <div className="people-first-hub" data-current={current}>
      <nav
        aria-label="People-first Atlas tasks"
        className="people-first-hub-nav"
      >
        <div className="people-first-hub-nav-inner">
          <Link
            aria-current={current === "hub" ? "page" : undefined}
            className="people-first-hub-brand"
            href={PEOPLE_FIRST_HUB_PATH}
          >
            People-First Atlas
          </Link>
          <ul className="people-first-hub-task-list">
            {PEOPLE_FIRST_TASK_IDS.map((taskId) => (
              <li key={taskId}>
                <Link
                  aria-current={current === taskId ? "page" : undefined}
                  className={
                    PEOPLE_FIRST_TASKS[taskId].emphasis === "featured"
                      ? "people-first-hub-task-link people-first-hub-task-link-featured"
                      : "people-first-hub-task-link"
                  }
                  href={peopleFirstHubHref(taskId)}
                >
                  {PEOPLE_FIRST_TASKS[taskId].navLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {children}
    </div>
  );
}
