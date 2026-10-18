import { describe, expect, it } from "vitest";

import {
  countyReferenceFromScoreSummaries,
  countyReferenceMatchesQuery,
  explorerAvailableDataGate,
  explorerCountyListCsv,
  explorerCountyListFilename,
  explorerCountySelectionLabel,
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

  it("requires five of six inputs before most data fields matches", () => {
    const counties = [
      autauga,
      { ...autauga, evidenceCompleteness: 83, fips: "01005" },
    ];
    expect({
      atThreshold: filterExplorerCountyReference(
        [{ ...autauga, evidenceCompleteness: 83 }],
        {
          evidence: "complete",
          query: "",
          scope: "AL",
        }
      ).map((county) => county.fips),
      dropsEightyPercent: filterExplorerCountyReference(counties, {
        evidence: "complete",
        query: "",
        scope: "AL",
      }).map((county) => county.fips),
    }).toStrictEqual({
      atThreshold: ["01001"],
      dropsEightyPercent: ["01005"],
    });
  });

  it("keeps a restrictive filter closed while the county reference is loading or failed", () => {
    const loading = explorerAvailableDataGate({
      availableData: "complete",
      counties: [autauga],
      isError: false,
      isSuccess: false,
      scope: "AL",
    });
    const failed = explorerAvailableDataGate({
      availableData: "human",
      counties: [autauga],
      isError: true,
      isSuccess: false,
      scope: "AL",
    });
    const open = explorerAvailableDataGate({
      availableData: "all",
      counties: [],
      isError: true,
      isSuccess: false,
      scope: "AL",
    });
    const ready = explorerAvailableDataGate({
      availableData: "complete",
      counties: [
        autauga,
        { ...autauga, evidenceCompleteness: 83, fips: "01005" },
      ],
      isError: false,
      isSuccess: true,
      scope: "AL",
    });
    expect({
      failed,
      loading,
      open,
      readyFips: ready.kind === "ready" ? [...ready.fips] : [],
      readyKind: ready.kind,
    }).toStrictEqual({
      failed: { kind: "error" },
      loading: { kind: "loading" },
      open: { kind: "open" },
      readyFips: ["01005"],
      readyKind: "ready",
    });
  });

  it("formats the selected county without using the label as an id", () => {
    expect(explorerCountySelectionLabel(autauga)).toBe("Autauga, AL - 01001");
    expect(
      countyReferenceMatchesQuery(autauga, "Autauga, AL - 01001")
    ).toBeTruthy();
    expect(
      countyReferenceMatchesQuery(autauga, "Autauga, AL · 01001")
    ).toBeTruthy();
    expect(countyReferenceMatchesQuery(autauga, "al")).toBeTruthy();
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
