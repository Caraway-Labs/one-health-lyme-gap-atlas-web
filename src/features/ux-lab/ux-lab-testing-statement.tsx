import Link from "next/link";

import {
  UX_LAB_PATH,
  UX_LAB_TESTING_LABEL,
  type UxLabConceptId,
  uxLabConceptById,
} from "@/features/ux-lab/prototype-contract";

export function UxLabTestingStatement({
  conceptId,
}: {
  conceptId: UxLabConceptId;
}) {
  const concept = uxLabConceptById(conceptId);

  return (
    <aside aria-label={UX_LAB_TESTING_LABEL} className="ux-lab-testing-note">
      <p className="type-body">
        <strong>{UX_LAB_TESTING_LABEL}.</strong> {concept.hypothesis}
      </p>
      <p className="type-small">
        <strong>How this concept stays distinct.</strong> {concept.difference}
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
