import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  OPEN_ATLAS_LABEL,
  PEOPLE_HOME,
  RETURN_TO_PEOPLE_ENV_LABEL,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import { cn } from "@/lib/utils";

const returnClassName = buttonVariants({ variant: "outline" });

export function PeopleWorkspaceTeaser() {
  return (
    <div className="people-plus-workspace-teaser">
      <div className="people-plus-workspace-band">
        <p>
          You left the people-first environment.{" "}
          <Link href={PEOPLE_HOME}>{RETURN_TO_PEOPLE_ENV_LABEL}</Link>
        </p>
      </div>
      <header>
        <p className="eyebrow">
          Professional workspace (prototype placeholder)
        </p>
        <h1 className="type-page">{OPEN_ATLAS_LABEL}</h1>
        <p className="type-body people-plus-lead">
          This route reserves the deliberate mode change into a denser
          epidemiology workspace. The next story in this concept adds
          investigation entry, evidence review, and the reviewed
          evidence-to-education handoff. For this story, the public and
          clinician shell stays intentionally lighter.
        </p>
      </header>
      <Card>
        <CardHeader>
          <h2 className="type-card">What belongs here later</h2>
          <CardDescription>
            Sample outline only. No live Action Center, county identifiers, or
            scores appear in this placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="people-plus-topic-list">
            <li>
              County and state evidence review with source and uncertainty cues.
            </li>
            <li>
              Investigation workspace reference with a path back to public
              outreach previews.
            </li>
            <li>
              Reviewed handoff from professional findings into understandable
              public and clinician artifacts.
            </li>
          </ul>
        </CardContent>
      </Card>
      <p className="type-small">{UX_LAB_SAMPLE_NOTICE}</p>
      <Link className={cn(returnClassName, "w-fit")} href={PEOPLE_HOME}>
        {RETURN_TO_PEOPLE_ENV_LABEL}
      </Link>
    </div>
  );
}
