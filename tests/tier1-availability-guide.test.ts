import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ProblemDetails } from "@/generated/zod/problemDetails.zod";
import { Tier1CountyPriority } from "@/generated/zod/tier1CountyPriority.zod";
import { Tier1CountyPriorityAvailability } from "@/generated/zod/tier1CountyPriorityAvailability.zod";

const guidePath = path.join(
  process.cwd(),
  "content",
  "docs",
  "develop",
  "tier1-availability.mdx"
);

function readGuide(): string {
  return fs.readFileSync(guidePath, "utf-8");
}

function jsonBlocks(guide: string): unknown[] {
  const blocks: unknown[] = [];
  for (const match of guide.matchAll(/```json\n(?<body>[\s\S]*?)```/gu)) {
    const body = match.groups?.body;
    if (!body) {
      continue;
    }
    blocks.push(JSON.parse(body));
  }
  return blocks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function availabilityReading(value: unknown): {
  availability: unknown;
  countyFips: unknown;
  geographyReleaseId: unknown;
  priorityTier: unknown;
  reason: unknown;
  releaseId: unknown;
  sufficiency: unknown;
} | null {
  if (!isRecord(value) || !isRecord(value.data)) {
    return null;
  }
  return {
    availability: value.availability,
    countyFips: value.data.county_fips,
    geographyReleaseId: value.geography_release_id,
    priorityTier: value.data.priority_tier,
    reason: value.reason,
    releaseId: value.data.release_id,
    sufficiency: value.data.evidence_sufficiency,
  };
}

describe("Tier 1 availability guide", () => {
  const guide = readGuide();
  const blocks = jsonBlocks(guide);
  const [
    sufficient,
    insufficient,
    priority,
    unknownAvailability,
    unknownPriority,
  ] = blocks;

  it("validates the captured bodies against the pinned contract", () => {
    expect({
      count: blocks.length,
      insufficient:
        Tier1CountyPriorityAvailability.safeParse(insufficient).success,
      priority: Tier1CountyPriority.safeParse(priority).success,
      sufficient: Tier1CountyPriorityAvailability.safeParse(sufficient).success,
      unknownAvailability:
        ProblemDetails.safeParse(unknownAvailability).success,
      unknownPriority: ProblemDetails.safeParse(unknownPriority).success,
    }).toStrictEqual({
      count: 5,
      insufficient: true,
      priority: true,
      sufficient: true,
      unknownAvailability: true,
      unknownPriority: true,
    });
  });

  it("keeps sufficient and insufficient results inside an availability envelope", () => {
    const sufficientReading = availabilityReading(sufficient);
    const insufficientReading = availabilityReading(insufficient);
    expect({
      insufficient: insufficientReading,
      priorityMatchesInsufficientData:
        isRecord(insufficient) &&
        JSON.stringify(priority) === JSON.stringify(insufficient.data),
      releasesDiffer:
        sufficientReading !== null &&
        sufficientReading.geographyReleaseId !== sufficientReading.releaseId,
      sufficient: sufficientReading,
    }).toStrictEqual({
      insufficient: {
        availability: "AVAILABLE",
        countyFips: "01001",
        geographyReleaseId: sufficientReading?.geographyReleaseId,
        priorityTier: "LOW",
        reason: null,
        releaseId: sufficientReading?.releaseId,
        sufficiency: "INSUFFICIENT",
      },
      priorityMatchesInsufficientData: true,
      releasesDiffer: true,
      sufficient: {
        availability: "AVAILABLE",
        countyFips: "09110",
        geographyReleaseId: sufficientReading?.geographyReleaseId,
        priorityTier: "HIGH",
        reason: null,
        releaseId: sufficientReading?.releaseId,
        sufficiency: "SUFFICIENT",
      },
    });
  });

  it("records the unknown-FIPS problems and no invented model state", () => {
    const serialized = JSON.stringify(blocks);
    expect({
      inventedNoPublishedModel: serialized.includes("NO_PUBLISHED_MODEL"),
      inventedNotEstimable: serialized.includes("NOT_ESTIMABLE"),
      inventedUnavailable: serialized.includes("UNAVAILABLE"),
      unknownAvailability,
      unknownPriorityHasCode:
        isRecord(unknownPriority) && Object.hasOwn(unknownPriority, "code"),
    }).toStrictEqual({
      inventedNoPublishedModel: false,
      inventedNotEstimable: false,
      inventedUnavailable: false,
      unknownAvailability: {
        code: "RESOURCE_NOT_FOUND",
        detail: "County is not in the current geography release.",
        errors: null,
        instance: "/v1/counties/99999/tier1-surveillance-priority/availability",
        request_id: "91af7989-a353-48e6-af9b-812727c66747",
        status: 404,
        title: "Invalid public query",
        type: "https://onehealthatlas.org/problems/resource-not-found",
      },
      unknownPriorityHasCode: false,
    });
  });

  it("keeps surveillance review priority distinct from clinical risk", () => {
    expect({
      absence: guide.includes("not evidence of absence"),
      abstention: guide.includes("There is no retrieved abstention payload"),
      carawaylabs: guide.includes("carawaylabs.com"),
      clinicalDiagnosis: /clinical diagnosis/iu.test(guide),
      clinicalRisk: guide.match(/clinical risk/gu)?.length ?? 0,
      highRisk: guide.match(/high risk/giu),
      individualRisk: /individual risk/iu.test(guide),
      nullData: guide.includes("A null `data` value is not low priority."),
      predictedIncidence:
        guide.replaceAll(/\s+/g, " ").match(/predicted incidence/gu)?.length ??
        0,
      unpublished: guide.includes(
        "There is no retrieved `NO_PUBLISHED_MODEL` payload"
      ),
      nationalInventory: guide.includes(
        "This was a national API inventory, outside the lower-48-and-DC scope used by the geography guide. Keep that geography scope when you select counties. `AVAILABLE` reports a published result, not product-scope eligibility."
      ),
      geographyGuide: guide.includes("](/docs/develop/geography)"),
      outsideProductGeography: /Alaska|Hawaii|\b(?:AK|HI)\b/u.test(guide),
    }).toStrictEqual({
      absence: true,
      abstention: true,
      carawaylabs: false,
      clinicalDiagnosis: false,
      clinicalRisk: 1,
      highRisk: ["high risk"],
      individualRisk: false,
      nullData: true,
      predictedIncidence: 1,
      unpublished: true,
      nationalInventory: true,
      geographyGuide: true,
      outsideProductGeography: false,
    });
  });
});
