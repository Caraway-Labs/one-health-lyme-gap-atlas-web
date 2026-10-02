import Link from "next/link";

import {
  UX_LAB_PATH,
  UX_LAB_SECOND_ROUND_LABEL,
  UX_LAB_TESTING_LABEL,
  uxLabConceptById,
} from "@/features/ux-lab/prototype-contract";

export function PeoplePlusWorkspaceTestingNote() {
  const concept = uxLabConceptById("people-plus-workspace");
  const publicSiteConcept = uxLabConceptById("public-site-pro-app");

  return (
    <aside aria-label={UX_LAB_TESTING_LABEL} className="ux-lab-testing-note">
      <p className="type-body">
        <strong>{UX_LAB_TESTING_LABEL}.</strong> {concept.hypothesis}
      </p>
      <p className="type-small">
        <strong>How this concept stays distinct.</strong> {concept.difference}
      </p>
      <p className="type-small">
        <strong>{UX_LAB_SECOND_ROUND_LABEL}.</strong> This issue 308 prototype
        sits alongside the first-round UX Lab concepts (issues 291–298). It is
        deferred product research—not a selected production architecture.
      </p>
      <p className="type-small">
        <strong>Compared with {publicSiteConcept.title}.</strong> Both use two
        related environments, but this concept leads with lived experience in
        the public shell and prototypes a reviewed evidence-to-education handoff
        with an explicit human-review boundary—not only a public site opening
        into the professional app.
      </p>
      <p className="type-small">
        <strong>Workshop non-goals.</strong> No live reporting, county lookup,
        automated publishing, accounts, or production navigation changes.
      </p>
      <Link href={`${UX_LAB_PATH}#ux-lab-comparison`}>Comparison guide</Link>
    </aside>
  );
}
