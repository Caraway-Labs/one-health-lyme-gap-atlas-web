/**
 * Disposable routes for the People-First Public + Professional Workspace prototype.
 */

import type { PrototypeRoute } from "@/features/ux-lab/public-site-pro-app/paths";

export const PEOPLE_PLUS_WORKSPACE_PATH =
  "/ux-lab/people-plus-workspace" as const;

export const PEOPLE_HOME = PEOPLE_PLUS_WORKSPACE_PATH;

export const PEOPLE_EDUCATION_PATH =
  `${PEOPLE_PLUS_WORKSPACE_PATH}/education` as const;

export const PEOPLE_LIVING_PATH =
  `${PEOPLE_PLUS_WORKSPACE_PATH}/living-with-lyme` as const;

export const PEOPLE_LOCAL_PATH = `${PEOPLE_PLUS_WORKSPACE_PATH}/local` as const;

export const PEOPLE_CLINICIANS_PATH =
  `${PEOPLE_PLUS_WORKSPACE_PATH}/clinicians` as const;

export const PEOPLE_WORKSPACE_PATH =
  `${PEOPLE_PLUS_WORKSPACE_PATH}/workspace` as const;

export const PEOPLE_PRO_EVIDENCE_PATH =
  `${PEOPLE_WORKSPACE_PATH}/evidence` as const;

export const PEOPLE_OUTREACH_PREVIEW_PATH =
  `${PEOPLE_PLUS_WORKSPACE_PATH}/outreach-preview` as const;

export const OPEN_ATLAS_LABEL = "Open Atlas for Public Health";

export const RETURN_TO_PEOPLE_ENV_LABEL = "Return to people-first Atlas";

export const PEOPLE_PLUS_TESTING_HYPOTHESIS =
  "Whether a people-first public and clinician environment, connected to but lighter than a professional workspace, feels more understandable than asking everyone into the same interaction model.";

export const PEOPLE_PLUS_TESTING_DIFFERENCE =
  "Lived-experience and clinician paths stay in a calm public shell. The epidemiology workspace is denser, opened on purpose, and connects to reviewed outreach previews that carry geography, provenance, caveats, and a human-approval boundary into public and clinician views.";

export const PEOPLE_PRO_NAV = [
  {
    href: PEOPLE_WORKSPACE_PATH,
    id: "overview",
    label: "Workspace overview",
    match: "exact",
  },
  {
    href: PEOPLE_PRO_EVIDENCE_PATH,
    id: "evidence",
    label: "Evidence review",
    match: "prefix",
  },
] as const satisfies readonly PrototypeRoute[];

export function peopleHandoffPublicEducationHref(handoffId: string): string {
  return `${PEOPLE_EDUCATION_PATH}?handoff=${encodeURIComponent(handoffId)}`;
}

export function peopleHandoffClinicianHref(handoffId: string): string {
  return `${PEOPLE_CLINICIANS_PATH}?handoff=${encodeURIComponent(handoffId)}`;
}

export const PEOPLE_PUBLIC_NAV = [
  {
    href: PEOPLE_EDUCATION_PATH,
    id: "education",
    label: "Education and prevention",
    match: "prefix",
  },
  {
    href: PEOPLE_LIVING_PATH,
    id: "living",
    label: "Living with Lyme",
    match: "prefix",
  },
  {
    href: PEOPLE_LOCAL_PATH,
    id: "local",
    label: "Local context",
    match: "prefix",
  },
  {
    href: PEOPLE_CLINICIANS_PATH,
    id: "clinicians",
    label: "Clinician resources",
    match: "prefix",
  },
] as const satisfies readonly PrototypeRoute[];
