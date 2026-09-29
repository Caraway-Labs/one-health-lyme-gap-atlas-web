import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { metadata as peoplePlusMetadata } from "@/app/ux-lab/people-plus-workspace/layout";
import LivingWithLymePage from "@/app/ux-lab/people-plus-workspace/living-with-lyme/page";
import PeopleLocalContextPage from "@/app/ux-lab/people-plus-workspace/local/page";
import PeopleOutreachPreviewPage from "@/app/ux-lab/people-plus-workspace/outreach-preview/page";
import PeoplePlusHomePage from "@/app/ux-lab/people-plus-workspace/page";
import PeopleEvidenceReviewPage from "@/app/ux-lab/people-plus-workspace/workspace/evidence/page";
import PeopleProfessionalOverviewPage from "@/app/ux-lab/people-plus-workspace/workspace/page";
import { PEOPLE_CLINICIAN_RESOURCES } from "@/features/ux-lab/people-plus-workspace/content";
import {
  PEOPLE_REVIEWED_HANDOFF,
  REVIEWED_HANDOFF_ID,
} from "@/features/ux-lab/people-plus-workspace/handoff-content";
import {
  OPEN_ATLAS_LABEL,
  PEOPLE_CLINICIANS_PATH,
  PEOPLE_EDUCATION_PATH,
  PEOPLE_HOME,
  PEOPLE_LIVING_PATH,
  PEOPLE_LOCAL_PATH,
  PEOPLE_OUTREACH_PREVIEW_PATH,
  PEOPLE_PLUS_TESTING_HYPOTHESIS,
  PEOPLE_PRO_EVIDENCE_PATH,
  PEOPLE_WORKSPACE_PATH,
  RETURN_TO_PEOPLE_ENV_LABEL,
  peopleHandoffClinicianHref,
  peopleHandoffPublicEducationHref,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { PeopleCliniciansPageContent } from "@/features/ux-lab/people-plus-workspace/people-clinicians-view";
import { PeopleEducationPageContent } from "@/features/ux-lab/people-plus-workspace/people-education-view";
import { PeoplePlusWorkspaceTestingNote } from "@/features/ux-lab/people-plus-workspace/people-plus-testing-note";
import { PeoplePlusShell } from "@/features/ux-lab/people-plus-workspace/people-shell";
import { PeoplePlusProfessionalShell } from "@/features/ux-lab/people-plus-workspace/professional-shell";
import {
  UX_LAB_ROBOTS,
  UX_LAB_TESTING_LABEL,
} from "@/features/ux-lab/prototype-contract";

let pathname: string = PEOPLE_HOME;

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname,
}));

const prohibitedClaim =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;

describe("People-first public + workspace prototype (story 1)", () => {
  afterEach(() => {
    cleanup();
    pathname = PEOPLE_HOME;
  });

  it("marks the concept noindex like other UX Lab routes", () => {
    expect(peoplePlusMetadata.robots).toStrictEqual(UX_LAB_ROBOTS);
  });

  it("shows the research testing note without requiring UX Lab index registration", () => {
    render(<PeoplePlusWorkspaceTestingNote />);

    expect(
      screen.getByRole("complementary", { name: UX_LAB_TESTING_LABEL })
        .textContent
    ).toContain(PEOPLE_PLUS_TESTING_HYPOTHESIS);
  });

  it("keeps public paths in a lighter people-first shell without app-shell chrome", () => {
    render(
      <PeoplePlusShell>
        <PeoplePlusHomePage />
      </PeoplePlusShell>
    );

    const nav = screen.getByRole("navigation", {
      name: "People-first Atlas",
    });
    expect(nav.textContent).toMatch(
      /Education and prevention.*Living with Lyme.*Local context.*Clinician resources/
    );
    expect(screen.getByText("People-first")).toBeTruthy();
    expect(document.querySelector(".app-shell")).toBeNull();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("surfaces lived experience, clinician resources, and a secondary workspace entry", () => {
    render(
      <PeoplePlusShell>
        <PeoplePlusHomePage />
      </PeoplePlusShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Open lived-experience page" })
        .getAttribute("href")
    ).toBe(PEOPLE_LIVING_PATH);
    expect(
      screen
        .getByRole("link", { name: "Open clinician resources" })
        .getAttribute("href")
    ).toBe(PEOPLE_CLINICIANS_PATH);
    expect(
      screen
        .getAllByRole("link", { name: OPEN_ATLAS_LABEL })[0]
        ?.getAttribute("href")
    ).toBe(PEOPLE_WORKSPACE_PATH);
  });

  it("renders education and lived-experience pages", () => {
    pathname = PEOPLE_EDUCATION_PATH;
    const education = render(
      <PeoplePlusShell>
        <PeopleEducationPageContent />
      </PeoplePlusShell>
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Learn about ticks and Lyme disease",
      })
    ).toBeTruthy();
    education.unmount();

    pathname = PEOPLE_LIVING_PATH;
    render(
      <PeoplePlusShell>
        <LivingWithLymePage />
      </PeoplePlusShell>
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Living with Lyme and ongoing concerns",
      })
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("renders local context and clinician resource cues", () => {
    pathname = PEOPLE_LOCAL_PATH;
    const local = render(
      <PeoplePlusShell>
        <PeopleLocalContextPage />
      </PeoplePlusShell>
    );
    expect(screen.getByText("Sample County")).toBeTruthy();
    local.unmount();

    pathname = PEOPLE_CLINICIANS_PATH;
    render(
      <PeoplePlusShell>
        <PeopleCliniciansPageContent />
      </PeoplePlusShell>
    );
    expect(
      PEOPLE_CLINICIAN_RESOURCES.every(
        (resource) =>
          screen.queryByText(resource.title) &&
          screen.queryByText(resource.applicability)
      )
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });
});

describe("Professional workspace and evidence-to-education handoff (story 2)", () => {
  afterEach(() => {
    cleanup();
    pathname = PEOPLE_HOME;
  });

  it("uses the denser professional app shell outside the people-first header", () => {
    pathname = PEOPLE_WORKSPACE_PATH;
    render(
      <PeoplePlusProfessionalShell>
        <PeopleProfessionalOverviewPage />
      </PeoplePlusProfessionalShell>
    );

    expect(document.querySelector(".people-plus-header")).toBeNull();
    expect(document.querySelector(".app-shell.ux-lab-pro-app")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Professional workspace" })
        .textContent
    ).toMatch(/Evidence review.*Outreach resource preview/);
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("shows county evidence review with provenance and a link to outreach preview", () => {
    pathname = PEOPLE_PRO_EVIDENCE_PATH;
    render(
      <PeoplePlusProfessionalShell>
        <PeopleEvidenceReviewPage />
      </PeoplePlusProfessionalShell>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "County evidence review" })
    ).toBeTruthy();
    expect(screen.getAllByText(/Sample County/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Uncertainty\./)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open reviewed outreach preview" })
        .getAttribute("href")
    ).toBe(PEOPLE_OUTREACH_PREVIEW_PATH);
    expect(document.body.textContent).toMatch(/Human-reviewed|publishable/i);
  });

  it("renders outreach preview with public and clinician continuation links", () => {
    pathname = PEOPLE_OUTREACH_PREVIEW_PATH;
    render(
      <PeoplePlusShell>
        <PeopleOutreachPreviewPage />
      </PeoplePlusShell>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Outreach and resource package preview",
      })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Continue to public education view" })
        .getAttribute("href")
    ).toBe(peopleHandoffPublicEducationHref(REVIEWED_HANDOFF_ID));
    expect(
      screen
        .getByRole("link", { name: "Continue to clinician resource view" })
        .getAttribute("href")
    ).toBe(peopleHandoffClinicianHref(REVIEWED_HANDOFF_ID));
    expect(document.body.textContent).toMatch(
      /no automated publishing.*publishable/is
    );
  });

  it("carries handoff context into public education and clinician pages", () => {
    pathname = PEOPLE_EDUCATION_PATH;
    render(
      <PeoplePlusShell>
        <PeopleEducationPageContent handoff={PEOPLE_REVIEWED_HANDOFF} />
      </PeoplePlusShell>
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Reviewed outreach context travels with this page",
      })
    ).toBeTruthy();
    expect(
      screen.getByText(PEOPLE_REVIEWED_HANDOFF.evidencePeriod)
    ).toBeTruthy();
    cleanup();

    pathname = PEOPLE_CLINICIANS_PATH;
    render(
      <PeoplePlusShell>
        <PeopleCliniciansPageContent handoff={PEOPLE_REVIEWED_HANDOFF} />
      </PeoplePlusShell>
    );
    expect(
      screen.getByText(PEOPLE_REVIEWED_HANDOFF.clinicianPackage.headline)
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: "Open public explanation with the same context",
        })
        .getAttribute("href")
    ).toBe(peopleHandoffPublicEducationHref(REVIEWED_HANDOFF_ID));
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });

  it("keeps a return path from the professional workspace to the people-first home", () => {
    pathname = PEOPLE_WORKSPACE_PATH;
    render(
      <PeoplePlusProfessionalShell>
        <PeopleProfessionalOverviewPage />
      </PeoplePlusProfessionalShell>
    );

    expect(
      screen
        .getAllByRole("link", { name: RETURN_TO_PEOPLE_ENV_LABEL })[0]
        ?.getAttribute("href")
    ).toBe(PEOPLE_HOME);
  });
});
