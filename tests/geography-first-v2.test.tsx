import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { metadata as geographyFirstV2Metadata } from "@/app/ux-lab/geography-first-v2/layout";
import { GeographyFirstV2Page } from "@/app/ux-lab/geography-first-v2/page";
import {
  GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES,
  GEOGRAPHY_FIRST_V2_PATH,
  GEOGRAPHY_FIRST_V2_PLACES,
  geographyFirstV2CopyStrings,
  resolveGeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import {
  UX_LAB_ROBOTS,
  UX_LAB_SAMPLE_NOTICE,
} from "@/features/ux-lab/prototype-contract";
import { NAVIGATION_ITEMS } from "@/lib/navigation";

const prohibited =
  /incidence|high risk|medium risk|low risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;

async function renderPlace(place?: string | string[]) {
  const page = await GeographyFirstV2Page({
    searchParams: Promise.resolve(place === undefined ? {} : { place }),
  });
  return render(page);
}

describe("Geography-First v2 prototype", () => {
  afterEach(cleanup);

  it("keeps sample copy free of scores, classifications, and clinical direction", () => {
    const violations = geographyFirstV2CopyStrings().filter((text) =>
      prohibited.test(text)
    );
    expect(GEOGRAPHY_FIRST_V2_PLACES.length).toBeGreaterThan(1);
    expect(violations).toStrictEqual([]);
  });

  it("defaults to the representative county and keeps the route out of production navigation", () => {
    expect(resolveGeographyFirstV2Place()).toMatchObject({
      place: { id: "ridge-sample-county", name: "Ridge Sample County" },
      status: "selected",
    });
    expect(resolveGeographyFirstV2Place("06037")).toMatchObject({
      requestedId: "06037",
      status: "missing",
    });
    expect(NAVIGATION_ITEMS.map((item) => item.href)).not.toContain(
      GEOGRAPHY_FIRST_V2_PATH
    );
    expect(geographyFirstV2Metadata.robots).toStrictEqual(UX_LAB_ROBOTS);
  });

  it("leads with place search and shows explicit evidence boundaries", async () => {
    await renderPlace();

    expect(
      screen.getByRole("searchbox", { name: "Search a sample place" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ridge Sample County" })
    ).toBeTruthy();
    for (const boundary of GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES) {
      expect(screen.getByText(boundary.label)).toBeTruthy();
    }
    expect(
      screen.getByText(/Population surveillance is not personal risk guidance/i)
    ).toBeTruthy();
    expect(screen.getByText(UX_LAB_SAMPLE_NOTICE)).toBeTruthy();
  });

  it("places limitations beside local claims without requiring disclosure", async () => {
    await renderPlace();

    const limitations = screen.getAllByText(/^Limitation\./i);
    expect(limitations.length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(/Lack of records or visible data does not mean/i)
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /methodology/i })).toBeNull();
  });

  it("exposes non-geographic education and lived-experience paths", async () => {
    await renderPlace();

    expect(
      screen
        .getByRole("link", { name: "General Lyme education" })
        .getAttribute("href")
    ).toBe("#general-education-section");
    expect(
      screen
        .getByRole("link", {
          name: "Living with Lyme / ongoing concerns",
        })
        .getAttribute("href")
    ).toBe("#living-with-lyme-section");
    expect(
      screen.getByRole("heading", {
        name: "Living with Lyme / ongoing concerns",
      })
    ).toBeTruthy();
    expect(screen.getByText("Living with Lyme")).toBeTruthy();
  });

  it("filters fictional places from search", async () => {
    await renderPlace("meadow-sample-town");

    expect(
      screen.getByRole("heading", { level: 1, name: "Meadow Sample Town" })
    ).toBeTruthy();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search a sample place" }),
      {
        target: { value: "ridge" },
      }
    );
    expect(
      screen.getByRole("link", { name: /Ridge Sample County/ })
    ).toBeTruthy();
  });

  it("refuses unknown places instead of inventing a county", async () => {
    await renderPlace(["not-real", "ridge-sample-county"]);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sample place not found" })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to Ridge Sample County" })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2?place=ridge-sample-county");
  });
});
