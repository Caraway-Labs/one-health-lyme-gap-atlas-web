import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { metadata as peopleFirstHubMetadata } from "@/app/ux-lab/people-first-hub/layout";
import {
  peopleFirstHubCopyCorpus,
  peopleFirstHubHref,
} from "@/features/ux-lab/people-first-hub/content";
import { PeopleFirstHubFrontDoor } from "@/features/ux-lab/people-first-hub/front-door";
import { LivingWithLymePage } from "@/features/ux-lab/people-first-hub/living-with-lyme-page";
import { PeopleFirstHubTestingStatement } from "@/features/ux-lab/people-first-hub/testing-statement";
import { UX_LAB_ROBOTS as CONTRACT_ROBOTS } from "@/features/ux-lab/prototype-contract";
import { UxLabShell } from "@/features/ux-lab/ux-lab-shell";

const prohibited =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%|risk score/i;

describe("People-first Atlas hub", () => {
  afterEach(cleanup);

  it("marks the concept route noindex", () => {
    expect(peopleFirstHubMetadata.robots).toStrictEqual(CONTRACT_ROBOTS);
  });

  it("keeps sample copy free of scores and clinical direction", () => {
    for (const line of peopleFirstHubCopyCorpus()) {
      expect(line).not.toMatch(prohibited);
    }
  });

  it("opens on task paths without a persona chooser", () => {
    render(
      <UxLabShell>
        <PeopleFirstHubFrontDoor />
      </UxLabShell>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Understand Lyme in the Atlas/i,
      })
    ).toBeTruthy();
    expect(
      screen.queryByText(/choose your (?<kind>role|audience)/i)
    ).toBeNull();
    const pathwayHrefs = [
      "Open Living with Lyme",
      "Open Learn about Lyme",
      "Open Clinician resources",
      "Open Public-health tools",
    ].map((name) => screen.getByRole("link", { name }).getAttribute("href"));
    expect(pathwayHrefs).toStrictEqual([
      peopleFirstHubHref("living-with-lyme"),
      peopleFirstHubHref("learn"),
      peopleFirstHubHref("clinicians"),
      peopleFirstHubHref("public-health"),
    ]);
  });

  it("highlights living with Lyme on the first screen", () => {
    render(<PeopleFirstHubFrontDoor />);

    expect(screen.getByText("Featured path")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Living with Lyme" })
    ).toBeTruthy();
  });

  it("exposes keyboard-navigable task links in the shell", () => {
    render(<LivingWithLymePage />);

    const nav = screen.getByRole("navigation", {
      name: "People-first Atlas tasks",
    });
    expect(nav).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Living with Lyme" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(screen.getAllByText(/Sample source label/i).length).toBeGreaterThan(
      0
    );
  });

  it("repeats the testing statement with a comparison link", () => {
    render(<PeopleFirstHubTestingStatement />);

    expect(
      screen.getByRole("complementary", {
        name: "What this variant is testing",
      }).textContent
    ).toContain("persona choice");
    expect(
      screen
        .getByRole("link", { name: "Comparison guide" })
        .getAttribute("href")
    ).toBe("/ux-lab#ux-lab-comparison");
  });
});
