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
import type { CompareAlignment } from "@/features/ux-reset/compare/compare-alignment";
import type { EvidenceObjectModel } from "@/features/ux-reset/evidence/types";
import type { ExploreCommittedSelection } from "@/features/ux-reset/explore/explore-model";
import type { CountyEvidenceBundle } from "@/features/ux-reset/investigate/county-evidence";
import {
  GeographyType,
  ValueState,
  type Observation,
} from "@/generated/models";

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
        releaseId: "alpha-2026",
        releaseMismatch: true,
        requestedFips: "08001",
      })
    ).toBeNull();
    const releaseOnly = inheritedContextFromInvestigate({
      bundle: null,
      identity: null,
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: null,
    });
    expect(field(releaseOnly, "release")?.state).toBe("validated");
    expect(field(releaseOnly, "geography")).toStrictEqual({ state: "absent" });
    expect(field(releaseOnly, "period")).toStrictEqual({ state: "absent" });
    expect(field(releaseOnly, "source")).toStrictEqual({ state: "absent" });
  });

  it("inherits one accepted Investigate period and omits conflicting requests", () => {
    const accepted = inheritedContextFromInvestigate({
      bundle: investigateBundle([
        ["2023-01-01", "2023-12-31"],
        ["2023-01-01", "2023-12-31"],
      ]),
      identity: { fips: "08001", label: "Denver County, Colorado (08001)" },
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: "08001",
    });
    expect(field(accepted, "period")).toStrictEqual({
      id: "2023-01-01",
      label: "2023",
      state: "validated",
    });
    const mismatchedRelease = inheritedContextFromInvestigate({
      bundle: investigateBundle([["2023-01-01", "2023-12-31"]]),
      identity: { fips: "08001", label: "Denver County, Colorado (08001)" },
      releaseId: "alpha-2026",
      releaseMismatch: true,
      requestedFips: "08001",
    });
    expect(field(mismatchedRelease, "period")).toStrictEqual({
      state: "absent",
    });
  });

  it("omits Investigate period when accepted observations disagree, fail, or are unsupported", () => {
    const mixed = inheritedContextFromInvestigate({
      bundle: investigateBundle([
        ["2023-01-01", "2023-12-31"],
        ["2022-01-01", "2022-12-31"],
      ]),
      identity: { fips: "08001", label: "Denver County, Colorado (08001)" },
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: "08001",
    });
    const unsupported = inheritedContextFromInvestigate({
      bundle: investigateBundle([]),
      identity: { fips: "08001", label: "Denver County, Colorado (08001)" },
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: "08001",
    });
    expect(field(mixed, "period")).toStrictEqual({ state: "absent" });
    expect(field(unsupported, "period")).toStrictEqual({ state: "absent" });
    expect(field(unsupported, "release")).toMatchObject({
      id: "alpha-2026",
      state: "validated",
    });
  });

  it("keeps a partial Investigate response when the loaded observations share a period", () => {
    const partial = inheritedContextFromInvestigate({
      bundle: investigateBundle([["2023-01-01", "2023-12-31"]], {
        failedMeasureId: "tick-pathogen",
      }),
      identity: { fips: "08001", label: "Denver County, Colorado (08001)" },
      releaseId: "alpha-2026",
      releaseMismatch: false,
      requestedFips: "08001",
    });
    expect(field(partial, "period")).toStrictEqual({
      id: "2023-01-01",
      label: "2023",
      state: "validated",
    });
    expect(field(partial, "measure")).toMatchObject({
      state: "validated",
    });
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

  it("withholds a blank Review county name from inherited geography", () => {
    const blank = inheritedContextFromReview({
      rankedCounties: [
        { county: "   ", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    const unavailable = inheritedContextFromReview({
      rankedCounties: [
        { county: "Unavailable", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    const named = inheritedContextFromReview({
      rankedCounties: [
        { county: "Denver", fips: "08001", state_name: "Colorado" },
      ],
      releaseId: "alpha-2026",
      releaseReady: true,
      requestedCounty: "08001",
    });
    expect({
      blank: field(blank, "geography"),
      named: field(named, "geography"),
      release: field(blank, "release"),
      unavailable: field(unavailable, "geography"),
    }).toStrictEqual({
      blank: { state: "absent" },
      named: {
        id: "08001",
        label: "Denver, Colorado (08001)",
        state: "validated",
      },
      release: {
        id: "alpha-2026",
        label: "alpha-2026",
        state: "validated",
      },
      unavailable: { state: "absent" },
    });
  });

  it("publishes a resolved Compare pair and withholds an unresolved county label", () => {
    const ready = inheritedContextFromCompare({
      alignment: compareAlignment([["2023-01-01", "2023-12-31"]]),
      alignmentReady: true,
      counties: [
        { fips: "08001", label: "Adams, Colorado (08001)" },
        { fips: "08013", label: "Boulder, Colorado (08013)" },
      ],
      releaseId: "alpha-2026",
    });
    expect(field(ready, "geography")).toMatchObject({
      id: "08001,08013",
      state: "validated",
    });
    expect(field(ready, "measure")).toStrictEqual({ state: "absent" });
    expect(field(ready, "period")).toStrictEqual({
      id: "2023-01-01",
      label: "2023",
      state: "validated",
    });
    expect(field(ready, "source")).toStrictEqual({ state: "absent" });
    const unresolved = inheritedContextFromCompare({
      alignment: compareAlignment([["2023-01-01", "2023-12-31"]]),
      alignmentReady: true,
      counties: [
        { fips: "08001", label: "County 08001" },
        { fips: "08013", label: "Boulder, Colorado (08013)" },
      ],
      releaseId: "alpha-2026",
    });
    expect(field(unresolved, "geography")).toStrictEqual({ state: "absent" });
  });

  it("does not inherit a requested Compare period from mixed, failed, or unsupported rows", () => {
    const requestedPeriod = "1999-01-01";
    const mixed = inheritedContextFromCompare({
      alignment: compareAlignment(
        [
          ["2023-01-01", "2023-12-31"],
          ["2022-01-01", "2022-12-31"],
        ],
        requestedPeriod
      ),
      alignmentReady: true,
      counties: resolvedPair,
      releaseId: "alpha-2026",
    });
    const failed = inheritedContextFromCompare({
      alignment: compareAlignment([], requestedPeriod, "failed"),
      alignmentReady: true,
      counties: resolvedPair,
      releaseId: "alpha-2026",
    });
    const unsupported = inheritedContextFromCompare({
      alignment: compareAlignment([], requestedPeriod, "unsupported_period"),
      alignmentReady: true,
      counties: resolvedPair,
      releaseId: "alpha-2026",
    });
    expect(field(mixed, "period")).toStrictEqual({ state: "absent" });
    expect(field(failed, "period")).toStrictEqual({ state: "absent" });
    expect(field(unsupported, "period")).toStrictEqual({ state: "absent" });
    expect(JSON.stringify(mixed)).not.toContain(requestedPeriod);
    expect(field(unsupported, "release")).toMatchObject({ state: "validated" });
  });
});

const resolvedPair = [
  { fips: "08001", label: "Adams, Colorado (08001)" },
  { fips: "08013", label: "Boulder, Colorado (08013)" },
] as const;

function periodObservation(
  periodStart: string,
  periodEnd: string
): Observation {
  return {
    atlas_acquired_at: null,
    atlas_processed_at: null,
    dataset_id: "fixture",
    denominator: null,
    evidence: {
      provenance_ref: "prov/period",
      resource_id: "reported-cases",
      resource_type: "dataset",
    },
    geography: { geography_id: "08001", geography_type: GeographyType.county },
    limitations: [],
    lineage_source_id: null,
    measure_id: "reported-cases",
    methodology: null,
    methodology_id: "method-1",
    methodology_version: "1.0.0",
    observation_id: `${periodStart}-${periodEnd}`,
    period_end: periodEnd,
    period_start: periodStart,
    provenance_ref: "prov/period",
    release_id: "alpha-2026",
    release_methodology_version: null,
    semantic_version: "1.0.0",
    source_id: "cdc-cases",
    source_label: "CDC surveillance",
    source_published_at: null,
    source_url: null,
    source_vintage: "2026.1",
    temporal_grain: "YEAR",
    unit: "cases",
    value: 4,
    value_state: ValueState.OBSERVED,
  };
}

function investigateBundle(
  periods: readonly (readonly [string, string])[],
  options: { failedMeasureId?: string } = {}
): CountyEvidenceBundle {
  const observations = periods.map(([periodStart, periodEnd]) => ({
    evidence: evidence("cdc-cases", "CDC surveillance"),
    familyId: null,
    indicatorDomain: "human",
    indicatorId: "human-cases",
    measureId: "reported-cases",
    measureLabel: "Reported Lyme cases",
    observation: periodObservation(periodStart, periodEnd),
  }));
  return {
    county: {
      fips: "08001",
      label: "Denver County, Colorado (08001)",
      stateCode: "CO",
    },
    domainsRequestFailed: false,
    families: [],
    leadFinding: observations[0] ?? null,
    leadLimitation: null,
    measureFailures: options.failedMeasureId
      ? [
          {
            measureId: options.failedMeasureId,
            measureLabel: "Tick pathogen detections",
            message: "observations unavailable",
            retryAtMs: null,
          },
        ]
      : [],
    readyMeasureIds: observations.length > 0 ? ["reported-cases"] : [],
    releaseId: "alpha-2026",
    unassigned: observations,
    unclassifiedMeasureIds: [],
    unsupportedPeriodMeasureIds: periods.length === 0 ? ["reported-cases"] : [],
  };
}

function compareAlignment(
  periods: readonly (readonly [string, string])[],
  requestedPeriod: string | null = "1999-01-01",
  emptyReason: "failed" | "unsupported_period" | null = null
): CompareAlignment {
  const records = periods.map(([periodStart, periodEnd]) => ({
    evidence: evidence("cdc-cases", "CDC surveillance"),
    fips: "08001",
    observation: periodObservation(periodStart, periodEnd),
  }));
  const left =
    emptyReason === null
      ? { kind: "observations" as const, records }
      : {
          kind: "empty" as const,
          message: "No accepted observations",
          reason: emptyReason,
        };
  return {
    leftFips: "08001",
    outcomes: [],
    period: requestedPeriod,
    releaseId: "alpha-2026",
    rightFips: "08013",
    rows: [
      {
        definition: null,
        left,
        measureId: "reported-cases",
        measureLabel: "Reported Lyme cases",
        relation: { kind: "similar" },
        right: {
          kind: "empty",
          message: "Missing",
          reason: "missing",
        },
      },
    ],
  };
}
