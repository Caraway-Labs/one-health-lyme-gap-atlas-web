import Link from "next/link";

import {
  UX_LAB_PATH,
  UX_LAB_TESTING_LABEL,
} from "@/features/ux-lab/prototype-contract";

const GEOGRAPHY_FIRST_V2_HYPOTHESIS =
  "Whether leading with place makes Atlas immediately relevant while users can still tell surveillance context apart from personal medical risk.";

const GEOGRAPHY_FIRST_V2_DIFFERENCE =
  "Geography is the front door, essential uncertainty sits beside local claims, general education plus Living with Lyme stay visible without choosing a location, and clinician plus public-health evidence open on separate same-place routes.";

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
        <strong>Compared with Geography-First (round 1).</strong> This v2 route
        keeps stronger evidence boundaries on the local entry screen. The
        original{" "}
        <Link href="/ux-lab/geography-first">Geography-First prototype</Link> is
        unchanged.
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
