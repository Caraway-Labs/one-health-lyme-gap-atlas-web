import { describe, expect, it } from "vitest";

import {
  countyReferenceFromScoreSummaries,
  countyReferenceMatchesQuery,
  explorerCountyListCsv,
  explorerCountyListFilename,
  filterExplorerCountyReference,
  type ExplorerCountyReference,
} from "@/features/ux-reset/review/explorer-county-reference";

const autauga: ExplorerCountyReference = {
  burgdorferiStatus: "Present",
  county: "Autauga",
  evidenceCompleteness: 80,
  fips: "01001",
  humanStatus: "published_count_floor",
  state: "AL",
  stateName: "Alabama",
  tickStatus: "Established",
};

const baldwin: ExplorerCountyReference = {
  burgdorferiStatus: "No records",
  county: "Baldwin",
  evidenceCompleteness: 1,
  fips: "01003",
  humanStatus: "missing",
  state: "AL",
  stateName: "Alabama",
  tickStatus: "No records",
};

describe("explorer county reference", () => {
  it("keeps lower-48 and DC counties and drops Alaska and Hawaii", () => {
    const reference = countyReferenceFromScoreSummaries([
      {
        burgdorferi_status: "No records",
        county: "Aleutians East",
        evidence_completeness: 1,
        fips: "02013",
        human_status: "missing",
        state: "AK",
        state_name: "Alaska",
        tick_status: "No records",
      },
      {
        burgdorferi_status: "No records",
        county: "Hawaii",
        evidence_completeness: 1,
        fips: "15001",
        human_status: "missing",
        state: "HI",
        state_name: "Hawaii",
        tick_status: "No records",
      },
      {
        burgdorferi_status: "Present",
        county: "District of Columbia",
        evidence_completeness: 6,
        fips: "11001",
        human_status: "published_count_floor",
        state: "DC",
        state_name: "District of Columbia",
        tick_status: "Reported",
      },
      {
        burgdorferi_status: autauga.burgdorferiStatus,
        county: autauga.county,
        evidence_completeness: autauga.evidenceCompleteness,
        fips: autauga.fips,
        human_status: autauga.humanStatus,
        state: autauga.state,
        state_name: autauga.stateName,
        tick_status: autauga.tickStatus,
      },
    ]);

    expect(reference.map((county) => county.fips)).toStrictEqual([
      "01001",
      "11001",
    ]);
    expect(reference[0]).not.toHaveProperty("score");
    expect(reference[0]).not.toHaveProperty("priority");
  });

  it("filters by the existing available-data dimensions and the selected state", () => {
    const counties = [autauga, baldwin];
    expect(
      filterExplorerCountyReference(counties, {
        evidence: "human",
        query: "",
        scope: "AL",
      }).map((county) => county.fips)
    ).toStrictEqual(["01001"]);
    expect(
      filterExplorerCountyReference(counties, {
        evidence: "ecological",
        query: "",
        scope: "AL",
      }).map((county) => county.fips)
    ).toStrictEqual(["01001"]);
    expect(
      filterExplorerCountyReference(counties, {
        evidence: "complete",
        query: "bald",
        scope: "ALL",
      })
    ).toStrictEqual([]);
    expect(
      filterExplorerCountyReference(counties, {
        evidence: "all",
        query: "",
        scope: "CO",
      })
    ).toStrictEqual([]);
  });

  it("matches a selected county label that contains the name and FIPS", () => {
    expect(
      countyReferenceMatchesQuery(autauga, "Autauga, AL · 01001")
    ).toBeTruthy();
    expect(countyReferenceMatchesQuery(baldwin, "01001")).toBeFalsy();
  });

  it("writes a quoted five-digit FIPS and does not include score columns", () => {
    const csv = explorerCountyListCsv([
      { county: "Autauga", fips: "1001", state: "AL" },
      { county: '=cmd|"calc"', fips: "01003", state: "AL" },
    ]);
    expect(csv).toBe(
      'fips,county,state\r\n"01001","Autauga","AL"\r\n"01003","\'=cmd|""calc""","AL"\r\n'
    );
    expect(csv).not.toContain("score");
    expect(csv).not.toContain("priority");
    expect(explorerCountyListFilename("ALL")).toBe(
      "atlas-explorer-counties-all.csv"
    );
    expect(explorerCountyListFilename("AL")).toBe(
      "atlas-explorer-counties-al.csv"
    );
  });
});
