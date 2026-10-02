import Link from "next/link";

import {
  PEOPLE_FIRST_HUB_DIFFERENCE,
  PEOPLE_FIRST_HUB_HYPOTHESIS,
} from "@/features/ux-lab/people-first-hub/content";
import {
  UX_LAB_PATH,
  UX_LAB_SECOND_ROUND_LABEL,
  UX_LAB_TESTING_LABEL,
} from "@/features/ux-lab/prototype-contract";

export function PeopleFirstHubTestingStatement() {
  return (
    <aside aria-label={UX_LAB_TESTING_LABEL} className="ux-lab-testing-note">
      <p className="type-body">
        <strong>{UX_LAB_TESTING_LABEL}.</strong> {PEOPLE_FIRST_HUB_HYPOTHESIS}
      </p>
      <p className="type-small">
        <strong>How this concept stays distinct.</strong>{" "}
        {PEOPLE_FIRST_HUB_DIFFERENCE}
      </p>
      <p className="type-small">
        <strong>{UX_LAB_SECOND_ROUND_LABEL}.</strong> This issue 306 prototype
        sits alongside the first-round UX Lab concepts (issues 291–298). It does
        not replace them.
      </p>
      <p className="type-small">
        <strong>Compared with first-round concepts.</strong> Task paths replace
        upfront persona or lane selection; lived-experience, clinician, and
        professional destinations stay in one continuous shell.
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
