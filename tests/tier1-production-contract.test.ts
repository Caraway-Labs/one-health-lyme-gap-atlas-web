import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { mapCountySurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import { explorerMlListClassification } from "@/features/ux-reset/surveillance-priority/explorer-list-classification";
import {
  presentTier1SurveillancePriority,
  type Tier1SurveillancePriorityView,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";
import { GetCountyTier1PriorityResponse } from "@/generated/zod/atlas";
import { ProblemDetails } from "@/generated/zod/problemDetails.zod";
import { validateApiResponse } from "@/lib/api-response-validation";

const CAPTURED_RELEASE = "governed-2026-09-18-unknown-coverage";

function captured(name: string): unknown {
  return JSON.parse(
    readFileSync(
      path.join(process.cwd(), "tests/fixtures/prod-tier1", name),
      "utf-8"
    )
  );
}

function verifiedTier1(name: string): Tier1CountyPriority {
  return validateApiResponse(
    "Tier 1 surveillance priority",
    GetCountyTier1PriorityResponse,
    captured(name)
  );
}

function surfaces(result: Tier1CountyPriority) {
  const presented = presentTier1SurveillancePriority({
    errorStatus: null,
    requestedFips: result.county_fips,
    result,
    status: "success",
  });
  const intelligence = mapCountySurveillanceIntelligence({
    fips: result.county_fips,
    gapScore: {
      phase: "idle",
      release: { status: "unknown" },
      result: null,
    },
    situations: { errorStatus: null, phase: "idle", result: null },
    tier1: { errorStatus: null, phase: "success", result },
  })[1];
  const list = explorerMlListClassification({
    errorStatus: null,
    inLower48: true,
    requestedFips: result.county_fips,
    result,
    status: "success",
  });
  return { intelligence, list, presented };
}

function expectScored(
  presented: Tier1SurveillancePriorityView,
  result: Tier1CountyPriority,
  tier: "HIGH" | "LOW",
  sufficiency: "INSUFFICIENT" | "SUFFICIENT"
) {
  expect(presented.kind).toBe("result");
  if (presented.kind !== "result") {
    return;
  }
  expect(presented.tier).toBe(tier);
  expect(presented.sufficiency).toBe(sufficiency);
  expect(presented.details.percentileLabel).toBe(
    String(result.priority_percentile)
  );
  expect(presented.details.releaseId).toBe(CAPTURED_RELEASE);
}

describe("captured production Tier 1 responses", () => {
  it("shows Dutchess 36027 as HIGH / 99.7 / Sufficient on each Tier 1 surface", () => {
    const result = verifiedTier1("36027.json");
    expect(result).toMatchObject({
      county_fips: "36027",
      release_id: CAPTURED_RELEASE,
    });
    const { intelligence, list, presented } = surfaces(result);
    expectScored(presented, result, "HIGH", "SUFFICIENT");
    if (presented.kind !== "result") {
      return;
    }
    expect(presented.reasons.map((reason) => reason.code)).toStrictEqual([
      "PUBLISHED_HUMAN_FLOOR",
      "PATHOGEN_PRESENT",
    ]);
    expect(intelligence).toMatchObject({
      kind: "ready",
      primary: "HIGH",
      sufficiency: "SUFFICIENT",
      supporting: "Percentile 99.7 · Evidence sufficiency Sufficient",
      tier: "HIGH",
    });
    expect({
      list,
      release: intelligence?.disclosure?.some(
        (item) =>
          item.label === "Model input release" &&
          item.value === CAPTURED_RELEASE
      ),
    }).toStrictEqual({
      list: { label: "HIGH", tier: "HIGH" },
      release: true,
    });
  });

  it("shows Ada 16001 as LOW / 41.2 / Insufficient on each Tier 1 surface", () => {
    const result = verifiedTier1("16001.json");
    expect(result).toMatchObject({
      county_fips: "16001",
      release_id: CAPTURED_RELEASE,
    });
    const { intelligence, list, presented } = surfaces(result);
    expectScored(presented, result, "LOW", "INSUFFICIENT");
    if (presented.kind !== "result") {
      return;
    }
    expect(presented.reasons.map((reason) => reason.code)).toStrictEqual([
      "NO_COUNTY_HUMAN_RECORD",
      "PATHOGEN_NO_RECORDS",
      "SVI_CONTEXT_DIFFERENCE",
    ]);
    expect(intelligence).toMatchObject({
      kind: "ready",
      primary: "LOW",
      sufficiency: "INSUFFICIENT",
      supporting: "Percentile 41.2 · Evidence sufficiency Insufficient",
      tier: "LOW",
    });
    expect(list).toStrictEqual({ label: "LOW", tier: "LOW" });
  });

  it("shows a captured lower-48 404 as unavailable and not a tier", () => {
    const problem = validateApiResponse(
      "Tier 1 surveillance priority problem",
      ProblemDetails,
      captured("36000.problem.json")
    );
    expect(problem).toMatchObject({
      instance: expect.stringContaining("36000"),
      status: 404,
    });
    const presented = presentTier1SurveillancePriority({
      errorStatus: 404,
      requestedFips: "36000",
      result: null,
      status: "error",
    });
    const intelligence = mapCountySurveillanceIntelligence({
      fips: "36000",
      gapScore: {
        phase: "idle",
        release: { status: "unknown" },
        result: null,
      },
      situations: { errorStatus: null, phase: "idle", result: null },
      tier1: {
        errorStatus: 404,
        phase: "error",
        result: null,
      },
    })[1];
    const list = explorerMlListClassification({
      errorStatus: 404,
      inLower48: true,
      requestedFips: "36000",
      result: null,
      status: "error",
    });
    expect(presented.kind).toBe("unavailable");
    expect(intelligence).toMatchObject({
      kind: "unavailable",
      primary: "Unavailable",
    });
    expect(list).toStrictEqual({ label: "Not available", tier: "unavailable" });
    expect(JSON.stringify({ intelligence, list, presented })).not.toContain(
      "LOW"
    );
  });

  it("logs an incoherent captured payload as Response could not be verified", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = verifiedTier1("36027.json");
    result.priority_tier = null;
    const presented = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "36027",
      result,
      status: "success",
    });
    const intelligence = mapCountySurveillanceIntelligence({
      fips: "36027",
      gapScore: {
        phase: "idle",
        release: { status: "unknown" },
        result: null,
      },
      situations: { errorStatus: null, phase: "idle", result: null },
      tier1: { errorStatus: null, phase: "success", result },
    })[1];
    expect(presented.kind).toBe("unverified");
    expect(intelligence).toMatchObject({
      kind: "unverified",
      primary: "Response could not be verified",
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "endpoint=/v1/counties/36027/tier1-surveillance-priority"
      )
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("fips=36027")
    );
    errorSpy.mockRestore();
  });
});
