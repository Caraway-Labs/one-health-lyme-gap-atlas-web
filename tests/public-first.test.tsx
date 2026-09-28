import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(
  import("next/navigation"),
  () =>
    ({
      useRouter: () => ({ push: vi.fn<() => void>() }),
    }) as unknown as Partial<typeof import("next/navigation")>
);

import {
  publicFirstCopyCorpus,
  publicFirstHref,
  readPublicFirstPlace,
} from "@/features/ux-lab/public-first/content";
import { PublicFirstFrontDoor } from "@/features/ux-lab/public-first/front-door";
import {
  PublicFirstClinicalPage,
  PublicFirstSurveillancePage,
} from "@/features/ux-lab/public-first/professional-pages";
import { UxLabShell } from "@/features/ux-lab/ux-lab-shell";

const prohibited =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%|risk score/i;

describe("Public-first local snapshot", () => {
  afterEach(cleanup);

  it("keeps sample copy free of scores and clinical direction", () => {
    for (const line of publicFirstCopyCorpus()) {
      expect(line).not.toMatch(prohibited);
    }
  });

  it("falls back when a place id is missing or unknown", () => {
    expect(readPublicFirstPlace()).toMatchObject({
      place: { id: "sample-county" },
      unrecognizedPlace: false,
    });
    expect(readPublicFirstPlace("not-a-place")).toMatchObject({
      place: { id: "sample-county" },
      unrecognizedPlace: true,
    });
    expect(
      readPublicFirstPlace(["river-parish", "sample-county"])
    ).toMatchObject({
      place: { id: "river-parish" },
      unrecognizedPlace: false,
    });
  });

  it("opens on a local snapshot with secondary professional paths", () => {
    const selection = readPublicFirstPlace();
    render(
      <UxLabShell>
        <PublicFirstFrontDoor selection={selection} />
      </UxLabShell>
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Sample County local snapshot",
      })
    ).toBeTruthy();
    expect(screen.getByLabelText("Explore a sample place")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open Clinical Resources" })
        .getAttribute("href")
    ).toBe(publicFirstHref("sample-county", "clinical"));
    expect(
      screen
        .getByRole("link", { name: "Open Public Health & Surveillance" })
        .getAttribute("href")
    ).toBe(publicFirstHref("sample-county", "surveillance"));
  });

  it("separates surveillance context from personal medical questions", () => {
    render(<PublicFirstFrontDoor selection={readPublicFirstPlace()} />);

    expect(screen.getByText(/not personal medical risk/i)).toBeTruthy();
    expect(
      screen.getByText(/does not claim that local transmission/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Sample labels for prototype layout only/i)
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Read tick awareness" })
        .getAttribute("href")
    ).toBe("#tick-awareness");
  });

  it("carries the public place into clinical resources", () => {
    render(
      <PublicFirstClinicalPage
        selection={readPublicFirstPlace("harbor-borough")}
      />
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Clinical Resources" })
    ).toBeTruthy();
    expect(screen.getByText(/not a clinical care pathway/i)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to the Harbor Borough snapshot" })
        .getAttribute("href")
    ).toBe("/ux-lab/public-first?place=harbor-borough");
  });

  it("opens a professional surveillance workspace for the same place", () => {
    render(
      <PublicFirstSurveillancePage
        selection={readPublicFirstPlace("harbor-borough")}
      />
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Public Health & Surveillance",
      })
    ).toBeTruthy();
    expect(screen.getByText(/Atlas professional workspace/i)).toBeTruthy();
    expect(screen.getByText(/Action Center/i)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Local snapshot" })
        .getAttribute("aria-current")
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Public Health & Surveillance" })
        .getAttribute("aria-current")
    ).toBe("page");
  });
});
