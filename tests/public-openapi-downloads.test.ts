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
    const again = await renderPublicClientDownloads({
      provenance: contract.provenance,
      specBytes,
    });
    expect(again.get(POSTMAN_COLLECTION_DOWNLOAD_NAME)).toBe(collectionText);
  }, 30_000);
});
