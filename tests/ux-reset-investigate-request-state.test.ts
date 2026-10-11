import { describe, expect, it } from "vitest";

import {
  evidenceFamilyForMeasure,
  InvestigateContractError,
  investigateFamilyPublication,
} from "@/features/ux-reset/investigate/county-evidence";
import {
  investigateQueryOutcome,
  investigateRequestDisclosure,
  investigateRequestNames,
  type InvestigateQueryOutcome,
  type InvestigateRequestName,
} from "@/features/ux-reset/investigate/investigate-request-state";
import { AtlasApiError } from "@/lib/api-mutator";

const FIRST_LOAD: Record<InvestigateRequestName, string> = {
  catalog: "Governed measures could not be loaded.",
  "county-record":
    "The published county record could not be loaded. That is a request failure, not missing evidence.",
  directory: "The published county list for this release could not be loaded.",
  indicators:
    "Governed indicators could not be loaded. Observations stay grouped by the indicator id allowlist. That is a request failure, not a loaded indicator catalog.",
  measures: "Governed measures could not be loaded.",
  metadata: "Unable to load governed release metadata.",
  observations: "County evidence did not load for the requested county.",
};

const REFRESH: Record<InvestigateRequestName, string> = {
  catalog:
    "The measure catalog refresh failed. The last governed catalog is still shown.",
  "county-record":
    "The published county record refresh failed. The last governed result is still shown.",
  directory:
    "The published county list refresh failed. The last governed list is still shown.",
  indicators:
    "The indicator catalog refresh failed. The last governed indicator list is still shown.",
  measures:
    "The measure catalog refresh failed. The last governed catalog is still shown.",
  metadata:
    "The release metadata refresh failed. The last governed release is still shown.",
  observations:
    "County evidence refresh failed. The last governed result is still shown.",
};

const QUERY_SAMPLES = [
  { data: undefined, isError: false, outcome: "never-loaded" },
  { data: { resolved: true }, isError: false, outcome: "loaded" },
  { data: null, isError: false, outcome: "settled-absent" },
  { data: { resolved: true }, isError: true, outcome: "refresh-failed" },
  { data: null, isError: true, outcome: "refresh-failed" },
  { data: undefined, isError: true, outcome: "failed-first-load" },
] as const;

function expectedDisclosure(input: {
  data: unknown;
  outcome: InvestigateQueryOutcome;
  request: InvestigateRequestName;
}) {
  return {
    absent: input.data === null,
    failure:
      input.outcome === "failed-first-load" ? FIRST_LOAD[input.request] : null,
    keepsResolvedResult: input.data !== undefined,
    outcome: input.outcome,
    refreshFailure:
      input.outcome === "refresh-failed" ? REFRESH[input.request] : null,
  };
}

describe("Investigate request resolution", () => {
  it("distinguishes every request outcome, including a cached null", () => {
    const rows = investigateRequestNames.flatMap((request) =>
      QUERY_SAMPLES.map((sample) => ({
        request,
        sample: sample.outcome,
        resolved:
          sample.data === null
            ? "null"
            : sample.data === undefined
              ? "undefined"
              : "value",
        ...investigateRequestDisclosure({
          data: sample.data,
          isError: sample.isError,
          request,
        }),
        classified: investigateQueryOutcome({
          data: sample.data,
          isError: sample.isError,
        }),
      }))
    );
    const countyContract = investigateRequestDisclosure({
      data: undefined,
      error: new InvestigateContractError(
        "County record does not match the requested county.",
        "identity_mismatch"
      ),
      isError: true,
      request: "county-record",
    });
    const metadataRelease = investigateRequestDisclosure({
      data: undefined,
      error: new AtlasApiError(
        "Release is not available.",
        "/v1/atlas/metadata",
        404,
        null
      ),
      isError: true,
      request: "metadata",
      requestedDataset: "missing-release",
    });
    expect({ countyContract, metadataRelease, rows }).toStrictEqual({
      countyContract: {
        absent: false,
        failure:
          "The published county record did not match this county and release, so it was not shown.",
        keepsResolvedResult: false,
        outcome: "failed-first-load",
        refreshFailure: null,
      },
      metadataRelease: {
        absent: false,
        failure:
          'The requested release "missing-release" is not available. Release is not available.',
        keepsResolvedResult: false,
        outcome: "failed-first-load",
        refreshFailure: null,
      },
      rows: investigateRequestNames.flatMap((request) =>
        QUERY_SAMPLES.map((sample) => ({
          request,
          sample: sample.outcome,
          resolved:
            sample.data === null
              ? "null"
              : sample.data === undefined
                ? "undefined"
                : "value",
          ...expectedDisclosure({
            data: sample.data,
            outcome: sample.outcome,
            request,
          }),
          classified: sample.outcome,
        }))
      ),
    });
  });

  it("keeps the indicator id fallback and still reports the request failure", () => {
    const disclosure = investigateRequestDisclosure({
      data: undefined,
      isError: true,
      request: "indicators",
    });
    expect({
      disclosure,
      family: evidenceFamilyForMeasure({
        domain: null,
        domainsRequestFailed: true,
        indicatorId: "human_disease_burden",
      }),
      publication: investigateFamilyPublication({
        domainsRequestFailed: true,
        failedMeasureIds: new Set<string>(),
        hasUnclassifiedMeasures: false,
        measureIds: ["reported-cases"],
        observationCount: 1,
        unsupportedMeasureIds: new Set<string>(),
      }),
    }).toStrictEqual({
      disclosure: {
        absent: false,
        failure: FIRST_LOAD.indicators,
        keepsResolvedResult: false,
        outcome: "failed-first-load",
        refreshFailure: null,
      },
      family: "human",
      publication: "assigned",
    });
  });
});
