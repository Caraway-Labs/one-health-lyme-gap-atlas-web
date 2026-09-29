/**
 * Mock evidence review and reviewed outreach artifacts for Story 2.
 * Fictional geography and periods only — no scores, incidence, or clinical guidance.
 */

import { PEOPLE_SAMPLE_PLACE } from "@/features/ux-lab/people-plus-workspace/content";

export const REVIEWED_HANDOFF_QUERY = "handoff" as const;

export const REVIEWED_HANDOFF_ID = "sample-county-tick-awareness" as const;

export type PeopleEvidenceSource = {
  id: string;
  label: string;
  note: string;
};

export type PeopleReviewedHandoff = {
  clinicianPackage: {
    headline: string;
    resourceShelfNote: string;
    summary: string;
  };
  evidencePeriod: string;
  geography: typeof PEOPLE_SAMPLE_PLACE;
  humanReview: {
    approvalBoundary: string;
    approvedAt: string;
    approverLabel: string;
    statusLabel: string;
  };
  id: typeof REVIEWED_HANDOFF_ID;
  limitations: string;
  professionalFindings: string;
  publicExplanation: {
    headline: string;
    summary: string;
  };
  sources: readonly PeopleEvidenceSource[];
  uncertainty: string;
};

export const PEOPLE_REVIEWED_HANDOFF: PeopleReviewedHandoff = {
  clinicianPackage: {
    headline: "Clinician outreach package (reviewed sample)",
    resourceShelfNote:
      "Sample note for where governed patient handouts would attach after review. Not a live catalog.",
    summary:
      "Sample framing for clinicians in Sample County’s fictional spring window: what changed in placeholder tick-encounter reporting, what remains uncertain, and where patient-facing language stays separate from surveillance counts.",
  },
  evidencePeriod:
    "Sample evidence window: January–March 2026 (fictional reporting period).",
  geography: PEOPLE_SAMPLE_PLACE,
  humanReview: {
    approvalBoundary:
      "Nothing in the public or clinician paths is treated as publishable until a named reviewer approves the outreach artifact. Automated publishing is not part of this prototype.",
    approvedAt: "Sample approval date: 15 March 2026 (layout only).",
    approverLabel:
      "Sample approver: fictional Sample State health department epidemiology lead.",
    statusLabel: "Human-reviewed for outreach preview",
  },
  id: REVIEWED_HANDOFF_ID,
  limitations:
    "Counts are incomplete for the sample window, geography is a fictional stand-in, and this prototype does not describe risk where you live or supply personal prevention instructions for a person.",
  professionalFindings:
    "Sample professional summary: placeholder tick-encounter reports in Sample County rose compared with the prior fictional quarter, with uneven lab confirmation and missing geography on a subset of forms. The pattern is useful for internal review, not for public risk labeling.",
  publicExplanation: {
    headline: "Community tick awareness (reviewed public explanation)",
    summary:
      "Sample public language: health partners are watching tick encounters in Sample County this season. The message explains what is known from placeholder surveillance, what is still uncertain, and where to find general education without turning maps into personal medical advice.",
  },
  sources: [
    {
      id: "lab-line-list",
      label: "Sample source: fictional lab line list (prototype stub).",
      note: "Sample freshness cue: placeholder extract dated March 2026.",
    },
    {
      id: "provider-forms",
      label: "Sample source: fictional provider encounter forms.",
      note: "Sample completeness cue: partial fields; not population coverage.",
    },
  ],
  uncertainty:
    "Sample uncertainty: reporting delays, inconsistent tick species documentation, and no adjustment for travel-related encounters in this fictional dataset.",
};

export function peopleReviewedHandoffFromParam(
  value: string | string[] | undefined
): PeopleReviewedHandoff | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === PEOPLE_REVIEWED_HANDOFF.id) {
    return PEOPLE_REVIEWED_HANDOFF;
  }
  return undefined;
}
