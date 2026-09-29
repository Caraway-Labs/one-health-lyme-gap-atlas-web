import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PeopleCliniciansPage from "@/app/ux-lab/people-plus-workspace/clinicians/page";
import PeopleEducationPage from "@/app/ux-lab/people-plus-workspace/education/page";
import { metadata as peoplePlusMetadata } from "@/app/ux-lab/people-plus-workspace/layout";
import LivingWithLymePage from "@/app/ux-lab/people-plus-workspace/living-with-lyme/page";
import PeopleLocalContextPage from "@/app/ux-lab/people-plus-workspace/local/page";
import PeoplePlusHomePage from "@/app/ux-lab/people-plus-workspace/page";
import PeopleWorkspacePlaceholderPage from "@/app/ux-lab/people-plus-workspace/workspace/page";
import { PEOPLE_CLINICIAN_RESOURCES } from "@/features/ux-lab/people-plus-workspace/content";
import {
  OPEN_ATLAS_LABEL,
  PEOPLE_CLINICIANS_PATH,
  PEOPLE_EDUCATION_PATH,
  PEOPLE_HOME,
  PEOPLE_LIVING_PATH,
  PEOPLE_LOCAL_PATH,
  PEOPLE_PLUS_TESTING_HYPOTHESIS,
  PEOPLE_WORKSPACE_PATH,
  RETURN_TO_PEOPLE_ENV_LABEL,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { PeoplePlusWorkspaceTestingNote } from "@/features/ux-lab/people-plus-workspace/people-plus-testing-note";
import { PeoplePlusShell } from "@/features/ux-lab/people-plus-workspace/people-shell";
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
        <PeopleEducationPage />
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
        <PeopleCliniciansPage />
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

  it("opens a workspace placeholder outside the public shell with a return path", () => {
    pathname = PEOPLE_WORKSPACE_PATH;
    render(<PeopleWorkspacePlaceholderPage />);

    expect(
      screen.getByText("You left the people-first environment.")
    ).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: RETURN_TO_PEOPLE_ENV_LABEL })[0]
        ?.getAttribute("href")
    ).toBe(PEOPLE_HOME);
    expect(document.querySelector(".people-plus-header")).toBeNull();
    expect(document.body.textContent).not.toMatch(prohibitedClaim);
  });
});
