import { describe, expect, it } from "vitest";

import {
  inheritedContextFromCompare,
  inheritedContextFromExplore,
  inheritedContextFromInvestigate,
  inheritedContextFromReview,
  parseAskAtlasInheritedContext,
  serializeAskAtlasInheritedContext,
  type AskAtlasInheritedContext,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import type { ExploreCommittedSelection } from "@/features/ux-reset/explore/explore-model";

function evidence(sourceId: string, sourceFamily: string): EvidenceObjectModel {
  return {
    availability: "available",
    claimLabel: "Reported Lyme cases",
    displayValue: "4",
    provenance: {
      evidenceType: "count",
      inspectSummary: "CDC surveillance covering 2023.",
      limitations: [],
      observationPeriod: "2023",
      sourceFamily,
      technical: { sourceId },
    },
    reasonCode: "OBSERVED",
  };
}

function committed(
  rowEvidence: EvidenceObjectModel | null
): ExploreCommittedSelection {
  return {
    handoffPeriod: "2023-01-01",
    mapScope: "CO",
    measureId: "reported-cases",
    measureLabel: "Reported Lyme cases",
    measureType: "count",
    observationPeriod: "2023",
    releaseId: "alpha-2026",
    rows: [
      {
        availability: rowEvidence ? "available" : "unavailable",
        choroplethBin: "neutral",
        countyName: "Adams",
        displayValue: rowEvidence ? "4" : "Unavailable",
        evidence: rowEvidence,
        fips: "08001",
        observationPeriod: "2023",
        state: "CO",
        stateName: "Colorado",
        unit: "cases",
      },
    ],
    unit: "cases",
  };
}

function field(
  context: AskAtlasInheritedContext | null,
  key: "geography" | "measure" | "period" | "release" | "source"
) {
  return context?.fields[key];
}

describe("Ask Atlas inherited context allowlist", () => {
  it("returns no context until Explore has a committed selection", () => {
    expect(
      inheritedContextFromExplore({ committed: null, selectedFips: "08001" })
    ).toBeNull();
  });

  it("publishes validated Explore identity and omits a source the row did not return", () => {
    const partial = inheritedContextFromExplore({
      committed: committed(null),
      selectedFips: "08001",
    });
    expect(field(partial, "geography")).toStrictEqual({
      id: "08001",
      label: "Adams, Colorado (08001)",
      state: "validated",
    });
    expect(field(partial, "measure")).toMatchObject({
      id: "reported-cases",
      state: "validated",
    });
    expect(field(partial, "period")).toMatchObject({
      id: "2023-01-01",
      state: "validated",
    });
    expect(field(partial, "release")).toMatchObject({
      id: "alpha-2026",
      state: "validated",
    });
    expect(field(partial, "source")).toStrictEqual({ state: "absent" });
  });

  it("does not treat an unselected county as validated geography", () => {
    const context = inheritedContextFromExplore({
      committed: committed(evidence("reported-cases", "CDC surveillance")),
      selectedFips: "99999",
    });
    expect(field(context, "geography")).toStrictEqual({ state: "absent" });
    expect(field(context, "source")).toStrictEqual({ state: "absent" });
  });

  it("keeps a validated source separate from retrieved-answer claims", () => {
    const context = inheritedContextFromExplore({
      committed: committed(evidence("reported-cases", "CDC surveillance")),
      selectedFips: "08001",
    });
    expect(field(context, "source")).toStrictEqual({
      id: "reported-cases",
      label: "CDC surveillance",
      state: "validated",
    });
    const serialized = serializeAskAtlasInheritedContext(context!);
    expect(serialized).not.toContain("retrieved");
    expect(parseAskAtlasInheritedContext(serialized)).toStrictEqual(context);
  });

  it("rejects allowlist documents that add a field or claim an unvalidated value", () => {
    expect(parseAskAtlasInheritedContext('{"surface":"explore"}')).toBeNull();
    expect(
      parseAskAtlasInheritedContext(
        JSON.stringify({
          fields: {
            geography: { id: "08001", label: "Adams", state: "validated" },
            measure: { state: "absent" },
            period: { state: "absent" },
            prompt: { id: "invented", label: "Invented", state: "validated" },
            release: { state: "absent" },
            source: { state: "absent" },
          },
          surface: "explore",
        })
      )
    ).toBeNull();
    expect(
      parseAskAtlasInheritedContext(
        JSON.stringify({
          fields: {
            geography: { guess: "08001", state: "validated" },
            measure: { state: "absent" },
            period: { state: "absent" },
            release: { state: "absent" },
            source: { state: "absent" },
          },
          surface: "explore",
        })
      )
    ).toBeNull();
  });

  it("does not claim an Investigate county, release, or source the page did not validate", () => {
    expect(
      inheritedContextFromInvestigate({
        bundle: null,
        identity: null,
        period: "2023-01-01",
        releaseId: "alpha-2026",
        releaseMismatch: true,
        requestedFips: "08001",
      })
    ).toBeNull();
    const releaseOnly = inheritedContextFromInvestigate({
      bundle: null,
      identity: null,
      period: "2023-01-01",
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: null,
    });
    expect(field(releaseOnly, "release")?.state).toBe("validated");
    expect(field(releaseOnly, "geography")).toStrictEqual({ state: "absent" });
    expect(field(releaseOnly, "period")).toStrictEqual({ state: "absent" });
    expect(field(releaseOnly, "source")).toStrictEqual({ state: "absent" });
  });

  it("publishes Review release without inventing a measure, period, or source", () => {
    const national = inheritedContextFromReview({
      rankedCounties: [],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    expect(field(national, "release")).toMatchObject({ id: "alpha-2026" });
    expect([
      field(national, "geography"),
      field(national, "measure"),
      field(national, "period"),
      field(national, "source"),
    ]).toStrictEqual([
      { state: "absent" },
      { state: "absent" },
      { state: "absent" },
      { state: "absent" },
    ]);
    expect(
      inheritedContextFromReview({
        rankedCounties: [],
        releaseId: "alpha-2026",
        releaseReady: false,
        requestedCounty: null,
      })
    ).toBeNull();
  });

  it("publishes a resolved Compare pair and withholds an unresolved county label", () => {
    const ready = inheritedContextFromCompare({
      alignmentReady: true,
      counties: [
        { fips: "08001", label: "Adams, Colorado (08001)" },
        { fips: "08013", label: "Boulder, Colorado (08013)" },
      ],
      period: "2023-01-01",
      releaseId: "alpha-2026",
    });
    expect(field(ready, "geography")).toMatchObject({
      id: "08001,08013",
      state: "validated",
    });
    expect(field(ready, "measure")).toStrictEqual({ state: "absent" });
    expect(field(ready, "source")).toStrictEqual({ state: "absent" });
    const unresolved = inheritedContextFromCompare({
      alignmentReady: true,
      counties: [
        { fips: "08001", label: "County 08001" },
        { fips: "08013", label: "Boulder, Colorado (08013)" },
      ],
      period: null,
      releaseId: "alpha-2026",
    });
    expect(field(unresolved, "geography")).toStrictEqual({ state: "absent" });
    expect(field(unresolved, "period")).toStrictEqual({ state: "absent" });
  });
});
