import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeographyFirstV2CliniciansPage } from "@/app/ux-lab/geography-first-v2/clinicians/page";
import { GeographyFirstV2EvidencePage } from "@/app/ux-lab/geography-first-v2/evidence/page";
import { metadata as geographyFirstV2Metadata } from "@/app/ux-lab/geography-first-v2/layout";
import { GeographyFirstV2Page } from "@/app/ux-lab/geography-first-v2/page";
import { GeographyFirstV2TestingStatement } from "@/features/ux-lab/geography-first-v2/geography-first-v2-testing-statement";
import {
  GEOGRAPHY_FIRST_V2_CLINICIANS_PATH,
  GEOGRAPHY_FIRST_V2_DIFFERENCE,
  GEOGRAPHY_FIRST_V2_EVIDENCE_BOUNDARIES,
  GEOGRAPHY_FIRST_V2_EVIDENCE_PATH,
  GEOGRAPHY_FIRST_V2_HYPOTHESIS,
  GEOGRAPHY_FIRST_V2_PATH,
  GEOGRAPHY_FIRST_V2_PLACES,
  GEOGRAPHY_FIRST_V2_STATE_REVIEW,
  geographyFirstV2CopyStrings,
  resolveGeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";
import {
  UX_LAB_ROBOTS,
  UX_LAB_SAMPLE_NOTICE,
  UX_LAB_SECOND_ROUND_LABEL,
  uxLabConceptById,
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

async function renderClinicians(place?: string | string[]) {
  const page = await GeographyFirstV2CliniciansPage({
    searchParams: Promise.resolve(place === undefined ? {} : { place }),
  });
  return render(page);
}

async function renderEvidence(place?: string | string[]) {
  const page = await GeographyFirstV2EvidencePage({
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

  it("matches the UX Lab workshop comparison contract", () => {
    const concept = uxLabConceptById("geography-first-v2");
    expect(concept.hypothesis).toBe(GEOGRAPHY_FIRST_V2_HYPOTHESIS);
    expect(concept.difference).toBe(GEOGRAPHY_FIRST_V2_DIFFERENCE);
    expect(concept.researchRound).toBe("second");
  });

  it("repeats the testing statement with a comparison link", () => {
    render(<GeographyFirstV2TestingStatement />);

    expect(
      screen.getByRole("complementary", {
        name: "What this variant is testing",
      }).textContent
    ).toContain("personal medical risk");
    expect(screen.getByText(UX_LAB_SECOND_ROUND_LABEL)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Comparison guide" })
        .getAttribute("href")
    ).toBe("/ux-lab#ux-lab-comparison");
    expect(
      screen.getByRole("link", { name: /Geography-First prototype/i })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first");
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

  it("links public, clinician, and evidence views for the same place", async () => {
    await renderPlace();

    expect(
      screen
        .getByRole("link", {
          name: /Clinician context for Ridge Sample County/i,
        })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2/clinicians?place=ridge-sample-county");
    expect(
      screen
        .getByRole("link", {
          name: /Public-health evidence for Ridge Sample County/i,
        })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2/evidence?place=ridge-sample-county");
    expect(
      screen
        .getAllByRole("link", { name: /Public local entry/i })[0]
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2?place=ridge-sample-county");
  });

  it("keeps clinician resources separate from care direction", async () => {
    await renderClinicians();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ridge Sample County",
      })
    ).toBeTruthy();
    expect(screen.getByText(/Not clinical care direction/i)).toBeTruthy();
    expect(screen.getAllByText(/^Source$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("links clinician view to evidence while keeping the place parameter", async () => {
    await renderClinicians();

    expect(
      screen
        .getByRole("link", { name: /Public-health evidence/i })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2/evidence?place=ridge-sample-county");
  });

  it("shows deeper evidence with state review entry and professional handoffs", async () => {
    await renderEvidence();

    expect(
      screen.getByRole("heading", {
        name: GEOGRAPHY_FIRST_V2_STATE_REVIEW.label,
      })
    ).toBeTruthy();
    expect(
      screen.getAllByText(/^Uncertainty\./i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen
        .getByRole("link", { name: "Investigation workspace" })
        .getAttribute("href")
    ).toBe("/investigate");
    expect(
      screen
        .getByRole("link", { name: /Clinician context/i })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first-v2/clinicians?place=ridge-sample-county");
  });

  it("keeps audience routes out of production navigation", () => {
    const productionNav = NAVIGATION_ITEMS.map((item) => item.href);
    expect(productionNav).not.toContain(GEOGRAPHY_FIRST_V2_PATH);
    expect(productionNav).not.toContain(GEOGRAPHY_FIRST_V2_CLINICIANS_PATH);
    expect(productionNav).not.toContain(GEOGRAPHY_FIRST_V2_EVIDENCE_PATH);
  });
});
