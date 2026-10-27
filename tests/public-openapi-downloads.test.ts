// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PINNED_OPENAPI_DOWNLOAD_NAME,
  PINNED_OPENAPI_PROVENANCE_NAME,
  POSTMAN_COLLECTION_DOWNLOAD_NAME,
  renderPublicClientDownloads,
} from "@/lib/public-openapi-downloads";
import { readAndLoadPublicOpenApiContract } from "@/lib/public-openapi-reference";

describe("public OpenAPI client downloads", () => {
  it("publishes the pinned bytes with their checksum", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const specBytes = readFileSync("contracts/public-openapi.json");
    const downloads = await renderPublicClientDownloads({
      provenance: contract.provenance,
      specBytes,
    });
    expect(downloads.get(PINNED_OPENAPI_DOWNLOAD_NAME)).toBe(
      specBytes.toString("utf-8")
    );
    expect(createHash("sha256").update(specBytes).digest("hex")).toBe(
      contract.provenance.sha256
    );
    const provenance = JSON.parse(
      downloads.get(PINNED_OPENAPI_PROVENANCE_NAME) ?? ""
    ) as { sha256: string; sourceCommit: string };
    expect(provenance).toMatchObject({
      sha256: contract.provenance.sha256,
      sourceCommit: contract.provenance.sourceCommit,
    });
  }, 30_000);

  it("builds a stable Postman collection for the public server", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const specBytes = readFileSync("contracts/public-openapi.json");
    const downloads = await renderPublicClientDownloads({
      provenance: contract.provenance,
      specBytes,
    });
    const collectionText = downloads.get(POSTMAN_COLLECTION_DOWNLOAD_NAME);
    const collection = JSON.parse(collectionText ?? "") as {
      info: { schema: string };
      item: unknown[];
      variable: { key: string; type: string; value: string }[];
    };
    expect(collection.info.schema).toBe(
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    );
    expect(collection.item.length).toBeGreaterThan(0);
    expect(collection.variable).toContainEqual({
      key: "baseUrl",
      type: "string",
      value: "https://api.onehealthatlas.org",
    });
    expect(countyReportPeriods(collection)).toStrictEqual({
      period_end: "2011-11-18",
      period_start: "1992-02-14",
    });
    const again = await renderPublicClientDownloads({
      provenance: contract.provenance,
      specBytes,
    });
    expect(again.get(POSTMAN_COLLECTION_DOWNLOAD_NAME)).toBe(collectionText);
  }, 30_000);

  it("keeps the default observation request on year 2023", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const specBytes = readFileSync("contracts/public-openapi.json");
    const downloads = await renderPublicClientDownloads({
      provenance: contract.provenance,
      specBytes,
    });
    const collection = JSON.parse(
      downloads.get(POSTMAN_COLLECTION_DOWNLOAD_NAME) ?? ""
    ) as { item?: unknown };
    const request = observationRequest(collection);
    const query = requestQuery(request);
    const enabled = query
      .filter((param) => param.disabled !== true)
      .map((param) => [param.key, param.value]);
    const disabled = query
      .filter((param) => param.disabled === true)
      .map((param) => param.key);
    expect(enabled).toStrictEqual([
      ["measure_id", "case_count_floor_2023"],
      ["geography_type", "county"],
      ["geography_id", "08001"],
      ["year", "2023"],
      ["page_size", "100"],
    ]);
    expect(disabled).toStrictEqual([
      "vintage_year",
      "start_date",
      "end_date",
      "stratification",
      "stratification",
      "page_token",
    ]);
  }, 30_000);
});

type ObservationQueryParam = {
  disabled?: boolean;
  key?: string;
  value?: string;
};

function countyReportPeriods(collection: { item?: unknown }): {
  period_end?: string;
  period_start?: string;
} {
  const request = findNamedRequest(collection, "Download a county report");
  if (!request) {
    throw new Error("Download a county report is missing.");
  }
  const periods: { period_end?: string; period_start?: string } = {};
  for (const param of requestQuery(request)) {
    if (param.key === "period_start" || param.key === "period_end") {
      periods[param.key] = param.value;
    }
  }
  return periods;
}

function observationRequest(collection: { item?: unknown }): {
  url?: { query?: unknown };
} {
  const found = findObservationRequest(collection);
  if (!found) {
    throw new Error("Query county observations is missing.");
  }
  return found;
}

function findObservationRequest(
  node: unknown
): { url?: { query?: unknown } } | undefined {
  return findNamedRequest(node, "Query county observations");
}

function findNamedRequest(
  node: unknown,
  name: string
): { url?: { query?: unknown } } | undefined {
  if (!isRecord(node)) return undefined;
  if (node.name === name && isRecord(node.request)) {
    return node.request;
  }
  if (!Array.isArray(node.item)) return undefined;
  for (const child of node.item) {
    const found = findNamedRequest(child, name);
    if (found) return found;
  }
  return undefined;
}

function requestQuery(request: {
  url?: { query?: unknown };
}): ObservationQueryParam[] {
  const query = request.url?.query;
  if (!Array.isArray(query)) {
    throw new TypeError("Request has no query parameters.");
  }
  return query.filter(isObservationQueryParam);
}

function isObservationQueryParam(
  value: unknown
): value is ObservationQueryParam {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
