import Link from "next/link";

import {
  PEOPLE_PLUS_TESTING_DIFFERENCE,
  PEOPLE_PLUS_TESTING_HYPOTHESIS,
} from "@/features/ux-lab/people-plus-workspace/paths";
import {
  UX_LAB_PATH,
  UX_LAB_TESTING_LABEL,
} from "@/features/ux-lab/prototype-contract";

export function PeoplePlusWorkspaceTestingNote() {
  return (
    <aside aria-label={UX_LAB_TESTING_LABEL} className="ux-lab-testing-note">
      <p className="type-body">
        <strong>{UX_LAB_TESTING_LABEL}.</strong>{" "}
        {PEOPLE_PLUS_TESTING_HYPOTHESIS}
      </p>
      <p className="type-small">
        <strong>How this concept stays distinct.</strong>{" "}
        {PEOPLE_PLUS_TESTING_DIFFERENCE}
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
