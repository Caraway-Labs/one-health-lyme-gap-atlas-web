import Link from "next/link";

import {
  GEOGRAPHY_FIRST_V2_DIFFERENCE,
  GEOGRAPHY_FIRST_V2_HYPOTHESIS,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import {
  UX_LAB_PATH,
  UX_LAB_SECOND_ROUND_LABEL,
  UX_LAB_TESTING_LABEL,
} from "@/features/ux-lab/prototype-contract";

export function GeographyFirstV2TestingStatement() {
  return (
    <aside
      aria-label={UX_LAB_TESTING_LABEL}
      className="ux-lab-testing-note geography-first-v2-testing-note"
    >
      <p className="type-body">
        <strong>{UX_LAB_TESTING_LABEL}.</strong> {GEOGRAPHY_FIRST_V2_HYPOTHESIS}
      </p>
      <p className="type-small">
        <strong>How this concept stays distinct.</strong>{" "}
        {GEOGRAPHY_FIRST_V2_DIFFERENCE}
      </p>
      <p className="type-small">
        <strong>{UX_LAB_SECOND_ROUND_LABEL}.</strong> This issue 307 prototype
        sits alongside the first-round UX Lab concepts (issues 291–298). It does
        not replace them.
      </p>
      <p className="type-small">
        <strong>Compared with Geography-First (round 1).</strong> The original{" "}
        <Link href="/ux-lab/geography-first">Geography-First prototype</Link>{" "}
        (issue 296) is unchanged. Use both routes in a workshop to compare local
        entry, lived-experience depth, and evidence boundaries.
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
