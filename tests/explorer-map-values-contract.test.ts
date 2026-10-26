import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GetAtlasMapValuesResponse } from "@/generated/zod/atlas";
import { validateApiResponse } from "@/lib/api-response-validation";

/**
 * Body of GET https://api.carawaylabs.com/v1/atlas/map-values captured
 * 2026-10-25. The same bytes are served by https://api.onehealthatlas.org.
 * Release governed-2026-10-15-january-climate-prod, 3144 counties.
 */
const productionMapValues = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/map-values-production.json"),
    "utf-8"
  )
);

describe("production map-values contract", () => {
  it("parses the live production map-values body", () => {
    const parsed = validateApiResponse(
      "Atlas map values",
      GetAtlasMapValuesResponse,
      productionMapValues
    );
    expect({
      counties: parsed.counties.length,
      missingIncidence: parsed.counties.some(
        (county) => county.incidence_floor_2023 === null
      ),
      release: parsed.release_id,
      zeroSvi: parsed.counties.some((county) => county.svi_percentile === 0),
      zeroUninsured: parsed.counties.some(
        (county) => county.uninsured_percent === 0
      ),
    }).toStrictEqual({
      counties: 3144,
      missingIncidence: true,
      release: "governed-2026-10-15-january-climate-prod",
      zeroSvi: true,
      zeroUninsured: true,
    });
  });
});
