import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeographyFirstPage } from "@/app/ux-lab/geography-first/page";
import {
  GEOGRAPHY_FIRST_PATH,
  GEOGRAPHY_FIRST_PLACES,
  geographyFirstCopyStrings,
  resolveGeographyFirstPlace,
} from "@/features/ux-lab/geography-first/sample-places";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import { NAVIGATION_ITEMS } from "@/lib/navigation";

const prohibited =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;

async function renderPlace(place?: string | string[]) {
  const page = await GeographyFirstPage({
    searchParams: Promise.resolve(place === undefined ? {} : { place }),
  });
  return render(page);
}

describe("Geography-First prototype", () => {
  afterEach(cleanup);

  it("keeps sample copy free of scores, classifications, and clinical direction", () => {
    const violations = geographyFirstCopyStrings().filter((text) =>
      prohibited.test(text)
    );
    expect(GEOGRAPHY_FIRST_PLACES.length).toBeGreaterThan(1);
    expect(violations).toStrictEqual([]);
  });

  it("defaults to the representative county and keeps the route out of production navigation", () => {
    expect(resolveGeographyFirstPlace()).toMatchObject({
      place: { id: "sample-county", name: "Sample County" },
      status: "selected",
    });
    expect(resolveGeographyFirstPlace("06037")).toMatchObject({
      requestedId: "06037",
      status: "missing",
    });
    expect(NAVIGATION_ITEMS.map((item) => item.href)).not.toContain(
      GEOGRAPHY_FIRST_PATH
    );
  });

  it("shows a nonexpert county view with visible limits and a clinician section", async () => {
    await renderPlace();

    expect(
      screen.getByRole("heading", { level: 1, name: "Sample County" })
    ).toBeTruthy();
    expect(
      screen.getByRole("note", { name: "What this place does not mean" })
        .textContent
    ).toContain("not the same as exposure");
    expect(screen.getByText(/not evidence that risk is absent/i)).toBeTruthy();
    expect(screen.getByText(UX_LAB_SAMPLE_NOTICE)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Public summary" })
    ).toBeTruthy();
  });

  it("keeps clinician resources visible and surveillance evidence closed", async () => {
    await renderPlace();

    expect(
      screen.getByRole("heading", { name: "For clinicians" })
    ).toBeTruthy();
    expect(screen.getByText("Clinician resource cards")).toBeTruthy();
    expect(
      screen
        .getByText("Open the sample surveillance summary")
        .closest("details")
        ?.hasAttribute("open")
    ).toBeFalsy();
  });

  it("hands the selected place to the live professional Atlas", async () => {
    await renderPlace();

    expect(
      screen
        .getByRole("link", { name: "Investigation Workspace" })
        .getAttribute("href")
    ).toBe("/investigate");
    expect(
      screen
        .getByRole("link", { name: "Geographic Explorer" })
        .getAttribute("href")
    ).toBe("/geographic_explorer");
    expect(
      screen.getByText(/Sample County stays the subject of this handoff/i)
    ).toBeTruthy();
  });

  it("filters fictional places without dropping the open county", async () => {
    await renderPlace("sample-parish");

    expect(
      screen.getByRole("heading", { level: 1, name: "Sample Parish" })
    ).toBeTruthy();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Find a sample place" }),
      {
        target: { value: "harbor" },
      }
    );

    expect(screen.getByRole("link", { name: /Harbor Sample/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Sample Parish/ })).toBeNull();
    expect(
      screen.getByText(/The open place is hidden by this search/i)
    ).toBeTruthy();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Find a sample place" }),
      {
        target: { value: "not-a-place" },
      }
    );
    expect(screen.getByRole("status").textContent).toContain(
      "No sample place matches that search."
    );
  });

  it("refuses unknown places instead of inventing a county", async () => {
    await renderPlace(["not-real", "sample-county"]);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sample place not found" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Sample County" })
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Return to Sample County" })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first?place=sample-county");
  });
});
