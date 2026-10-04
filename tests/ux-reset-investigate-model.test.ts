import { describe, expect, it } from "vitest";

import {
  acceptCountyObservations,
  buildCountyEvidenceBundle,
  classifyInvestigateCountySelection,
  countyEvidenceForRequest,
  evidenceFamilyFromIndicatorDomain,
  InvestigateContractError,
  resolveCountyIdentity,
} from "@/features/ux-reset/investigate/county-evidence";
import { indicatorDomainsById } from "@/features/ux-reset/investigate/load-county-evidence";
import { ValueState, type Measure, type Observation } from "@/generated/models";

import {
  INVESTIGATE_CASES_MEASURE_ID,
  INVESTIGATE_CONTEXT_MEASURE_ID,
  INVESTIGATE_RELEASE_ID,
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateGeographyFixture,
  investigateIndicatorsFixture,
  investigateMeasuresFixture,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const yearBound = {
  handoffPeriod: "2023-01-01",
  kind: "year",
  year: 2023,
} as const;

function measures(): Measure[] {
  return investigateMeasuresFixture as Measure[];
}

describe(classifyInvestigateCountySelection, () => {
  it("distinguishes a missing county from a malformed one", () => {
    expect(classifyInvestigateCountySelection([])).toStrictEqual({
      kind: "missing",
    });
    expect(classifyInvestigateCountySelection(["08001"])).toStrictEqual({
      fips: "08001",
      kind: "county",
    });
    expect(classifyInvestigateCountySelection([" 08001 "])).toStrictEqual({
      fips: "08001",
      kind: "county",
    });
    expect(classifyInvestigateCountySelection(["12"])).toStrictEqual({
      kind: "malformed",
    });
    expect(
      classifyInvestigateCountySelection(["08001", "08013"])
    ).toStrictEqual({
      kind: "malformed",
    });
  });
});

describe("evidence families", () => {
  it("maps only governed domain tokens", () => {
    expect({
      environmental: evidenceFamilyFromIndicatorDomain("environmental"),
      human: evidenceFamilyFromIndicatorDomain("human"),
      missing: evidenceFamilyFromIndicatorDomain(null),
      pathogen: evidenceFamilyFromIndicatorDomain("pathogen"),
      population: evidenceFamilyFromIndicatorDomain("population"),
      unknown: evidenceFamilyFromIndicatorDomain("surveillance"),
      vector: evidenceFamilyFromIndicatorDomain("vector"),
    }).toStrictEqual({
      environmental: "environmental_population",
      human: "human",
      missing: null,
      pathogen: "vector_pathogen",
      population: "environmental_population",
      unknown: null,
      vector: "vector_pathogen",
    });
  });
});

describe(resolveCountyIdentity, () => {
  it("rejects a geography payload for a different county", () => {
    const geography = investigateGeographyFixture("08013");
    expect(geography).not.toBeNull();
    expect(() => resolveCountyIdentity(geography!, "08001")).toThrow(
      InvestigateContractError
    );
  });

  it("keeps the requested county name from governed geography", () => {
    const geography = investigateGeographyFixture("08001");
    expect(resolveCountyIdentity(geography!, "08001")).toStrictEqual({
      fips: "08001",
      label: "Denver County",
      stateCode: "CO",
    });
  });
});

describe(acceptCountyObservations, () => {
  it("preserves two sources and rejects a foreign county or repeated id", () => {
    const observations = investigateObservationsFor({
      fips: "08001",
      measureId: INVESTIGATE_CASES_MEASURE_ID,
      scenario: "ambiguous",
    });
    const accepted = acceptCountyObservations({
      measureId: INVESTIGATE_CASES_MEASURE_ID,
      observations,
      releaseId: INVESTIGATE_RELEASE_ID,
      requestedFips: "08001",
      timeBound: yearBound,
    });
    expect(
      accepted.map((observation) => observation.observation_id)
    ).toStrictEqual(["obs-cases-08001", "obs-cases-state-08001"]);
    expect(
      accepted.map((observation) => observation.source_label)
    ).toStrictEqual(["CDC surveillance", "State health department"]);

    const foreign = {
      ...observations[0],
      geography: { geography_id: "08013", geography_type: "county" as const },
    } satisfies Observation;
    expect(() =>
      acceptCountyObservations({
        measureId: INVESTIGATE_CASES_MEASURE_ID,
        observations: [foreign],
        releaseId: INVESTIGATE_RELEASE_ID,
        requestedFips: "08001",
        timeBound: yearBound,
      })
    ).toThrow(/requested county/);

    expect(() =>
      acceptCountyObservations({
        measureId: INVESTIGATE_CASES_MEASURE_ID,
        observations: [observations[0]!, observations[0]!],
        releaseId: INVESTIGATE_RELEASE_ID,
        requestedFips: "08001",
        timeBound: yearBound,
      })
    ).toThrow(/repeats/);
  });
});

describe(buildCountyEvidenceBundle, () => {
  const identity = resolveCountyIdentity(
    investigateGeographyFixture("08001")!,
    "08001"
  );
  const domains = indicatorDomainsById(
    investigateIndicatorsFixture,
    INVESTIGATE_RELEASE_ID
  );

  it("keeps a finding, a limitation, and an unavailable value that is not zero", () => {
    const bundle = buildCountyEvidenceBundle({
      domainsRequestFailed: false,
      identity,
      indicatorDomains: domains,
      measures: measures(),
      outcomes: [
        {
          measureId: INVESTIGATE_CASES_MEASURE_ID,
          observations: investigateObservationsFor({
            fips: "08001",
            measureId: INVESTIGATE_CASES_MEASURE_ID,
            scenario: "mixed",
          }),
          status: "ready",
        },
        {
          measureId: INVESTIGATE_TICK_MEASURE_ID,
          observations: investigateObservationsFor({
            fips: "08001",
            measureId: INVESTIGATE_TICK_MEASURE_ID,
            scenario: "mixed",
          }),
          status: "ready",
        },
        {
          measureId: INVESTIGATE_CONTEXT_MEASURE_ID,
          observations: investigateObservationsFor({
            fips: "08001",
            measureId: INVESTIGATE_CONTEXT_MEASURE_ID,
            scenario: "mixed",
          }),
          status: "ready",
        },
      ],
      releaseId: INVESTIGATE_RELEASE_ID,
    });

    const environmental = bundle.families.find(
      (family) => family.id === "environmental_population"
    );
    const observation = environmental?.observations[0];
    expect({
      availability: bundle.leadFinding?.evidence.availability,
      display: bundle.leadFinding?.evidence.displayValue,
      environmentalDisplay: observation?.evidence.displayValue,
      limitation: bundle.leadLimitation?.text,
      rawValue: observation?.observation.value,
      sameCounty: countyEvidenceForRequest(bundle, {
        fips: "08001",
        releaseId: INVESTIGATE_RELEASE_ID,
      }),
      valueState: observation?.observation.value_state,
      wrongCounty: countyEvidenceForRequest(bundle, {
        fips: "08013",
        releaseId: INVESTIGATE_RELEASE_ID,
      }),
    }).toStrictEqual({
      availability: "available",
      display: "12 cases",
      environmentalDisplay: "Unavailable",
      limitation: INVESTIGATE_TICK_LIMITATION,
      rawValue: 0,
      sameCounty: bundle,
      valueState: ValueState.UNAVAILABLE,
      wrongCounty: null,
    });
  });

  it("records a failed measure without turning it into unavailable evidence", () => {
    const bundle = buildCountyEvidenceBundle({
      domainsRequestFailed: false,
      identity,
      indicatorDomains: domains,
      measures: measures(),
      outcomes: [
        {
          measureId: INVESTIGATE_CASES_MEASURE_ID,
          observations: investigateObservationsFor({
            fips: "08001",
            measureId: INVESTIGATE_CASES_MEASURE_ID,
            scenario: "mixed",
          }),
          status: "ready",
        },
        {
          measureId: INVESTIGATE_TICK_MEASURE_ID,
          message: "This measure could not be loaded.",
          status: "failed",
        },
        {
          measureId: INVESTIGATE_CONTEXT_MEASURE_ID,
          observations: [],
          status: "ready",
        },
      ],
      releaseId: INVESTIGATE_RELEASE_ID,
    });
    expect(bundle.leadFinding?.evidence.displayValue).toBe("12 cases");
    expect(
      bundle.measureFailures.map((failure) => failure.measureId)
    ).toStrictEqual([INVESTIGATE_TICK_MEASURE_ID]);
    expect(
      bundle.families.find((family) => family.id === "vector_pathogen")
        ?.observations
    ).toStrictEqual([]);
  });
});
