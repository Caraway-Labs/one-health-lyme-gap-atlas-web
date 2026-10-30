import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CountyActionPlan } from "../src/components/county-action-plan";
import {
  CountyEvidencePanel,
  CountyUncertaintyPanel,
} from "../src/components/county-evidence-panel";
import type { CountyDetail } from "../src/generated/models";

const detail: CountyDetail = {
  burgdorferi_status: "No records",
  case_count_floor_2023: null,
  color: "#efc64a",
  county: "Adams County",
  evidence_completeness: 50,
  fips: "08001",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  incidence_floor_2023: null,
  pacificus_status: "No records",
  population: 520_149,
  priority: "Lower Atlas priority — Not a safety finding",
  release: {
    bundle_sha256: "a".repeat(64),
    generated_at: "2026-08-06T05:37:16Z",
    limitations:
      "Population-level hypothesis generator; not diagnosis, exposure location, true incidence, or individual risk.",
    loaded_at: "2026-08-15T15:58:20.809-06:00",
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    methodology_version: "alpha-0.2.0",
    release_id: "alpha-2026-08-06",
    schema_version: "0.2.0",
    scope: "United States counties",
    score_defaults: {} as never,
    sources: [
      {
        key: "human",
        label: "CDC Lyme disease public-use surveillance",
        note: "Published floor.",
        url: "https://data.cdc.gov/d/x5j9-wybp",
        vintage: "2023",
      },
    ],
    states: [],
  },
  rucc_2023: 1,
  scapularis_status: "No records",
  score: {
    access_signal: 67.4,
    community: 56.5,
    ecological: 0,
    human_weakness: 75,
    pathogen_signal: 0,
    rural_signal: 0,
    score: 14.8,
    svi_signal: 72.6,
    tick_signal: 0,
  },
  state: "CO",
  state_name: "Colorado",
  state_unallocated_records_2023: 29,
  svi_percentile: 0.7264,
  tick_status: "No records",
  uninsured_percent: 10.8,
  uninsured_percentile: 0.6742,
};

describe("Investigation Workspace county decision support", () => {
  afterEach(cleanup);

  it("keeps missing evidence distinct from observed values and exposes provenance", () => {
    render(
      <>
        <CountyEvidencePanel detail={detail} />
        <CountyUncertaintyPanel detail={detail} />
      </>
    );

    const panel = screen.getByRole("region", {
      name: "Evidence and data used for this county",
    });
    expect(panel.textContent).toContain("No county-linked published record");
    expect(screen.getAllByText("No county record")).toHaveLength(3);
    expect(screen.getByText(/not converted to zero/)).toBeTruthy();
    expect(screen.getByText(/29 published 2023/)).toBeTruthy();

    fireEvent.click(
      screen.getByText("Show source, release, and methodology context")
    );
    expect(
      screen
        .getByRole("link", {
          name: /CDC Lyme disease public-use surveillance/,
        })
        .getAttribute("rel")
    ).toBe("noopener noreferrer");
  });

  it("shows observed zero separately from unavailable human evidence", () => {
    const observedZero = {
      ...detail,
      case_count_floor_2023: 0,
      incidence_floor_2023: 0,
      evidence_completeness: 100,
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      tick_status: "Established",
      burgdorferi_status: "Present",
    } as CountyDetail;

    render(<CountyEvidencePanel detail={observedZero} />);

    expect(screen.getByText("Reported cases: 0 or more")).toBeTruthy();
    expect(screen.getAllByText("Observed or published")).toHaveLength(3);
    expect(screen.queryByText("No county-linked published record")).toBeNull();
  });

  it("shares the guarded follow-up plan, role/action pairings, and official resources", () => {
    render(<CountyActionPlan detail={detail} />);

    expect(
      screen.getByRole("region", { name: "Conduct targeted follow-up" })
    ).toBeTruthy();
    expect({
      interpretation: screen.getByTestId("follow-up-interpretation")
        .textContent,
      labels: [
        "Review county case information",
        "Review tick and pathogen records",
        "Clarify reporting, if needed",
        "Consider prevention needs",
        "Record the question and next step",
      ].every((label) => screen.getByText(label)),
      partners: screen.getAllByText(/Potential partners:/).length,
    }).toStrictEqual({
      interpretation:
        "This is a review recommendation, not a measure of individual risk or proof that Lyme disease is undercounted.",
      labels: true,
      partners: 5,
    });
    fireEvent.click(screen.getByText("Related official resources"));
    expect(
      screen
        .getByRole("link", {
          name: /Wisconsin: reporting and investigation protocol/,
        })
        .getAttribute("target")
    ).toBe("_blank");
    expect(
      screen
        .getByRole("link", { name: "View all resources →" })
        .getAttribute("href")
    ).toBe("/resources?state=CO#state-resources");
  });

  it("does not call an unavailable review level a recommendation", () => {
    render(<CountyActionPlan detail={{ ...detail, color: "#111111" }} />);
    const interpretation =
      screen.getByTestId("follow-up-interpretation").textContent ?? "";
    expect(interpretation).toContain("No review level is assigned.");
    expect(
      screen.getByTestId("follow-up-verification-note").textContent ?? ""
    ).toContain("not a scored recommendation");
    expect(interpretation).not.toContain("This is a review recommendation");
  });
});
