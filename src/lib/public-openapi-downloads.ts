import { createHash } from "node:crypto";

import { renderPostmanCollection } from "./render-postman-collection";

export const PUBLIC_DOWNLOADS_RELATIVE_DIR = "public/downloads";
export const PINNED_OPENAPI_DOWNLOAD_NAME = "atlas-public-openapi.json";
export const PINNED_OPENAPI_PROVENANCE_NAME =
  "atlas-public-openapi.provenance.json";
export const POSTMAN_COLLECTION_DOWNLOAD_NAME = "atlas.postman_collection.json";

export type PinnedContractIdentity = {
  sha256: string;
  sourceCommit: string;
  sourcePath: string;
  sourceRepository: string;
  sourceUrl: string;
};

/**
 * Files served from `public/downloads`. The contract bytes stay identical to
 * the pin. The Postman collection is produced by `openapi-to-postmanv2`.
 */
export async function renderPublicClientDownloads(options: {
  provenance: PinnedContractIdentity;
  specBytes: Buffer;
}): Promise<Map<string, string>> {
  const specText = options.specBytes.toString("utf-8");
  if (!options.specBytes.equals(Buffer.from(specText, "utf-8"))) {
    throw new Error("Pinned OpenAPI contract is not valid UTF-8.");
  }
  const sha256 = createHash("sha256").update(options.specBytes).digest("hex");
  if (sha256 !== options.provenance.sha256) {
    throw new Error(
      "Pinned OpenAPI checksum does not match the bytes being published."
    );
  }
  const provenance = {
    filename: PINNED_OPENAPI_DOWNLOAD_NAME,
    sha256,
    sourceCommit: options.provenance.sourceCommit,
    sourcePath: options.provenance.sourcePath,
    sourceRepository: options.provenance.sourceRepository,
    sourceUrl: options.provenance.sourceUrl,
  };
  const collection = renderPostmanCollection(specText);
  const parsed: unknown = JSON.parse(collection);
  if (!collectionIncludesBaseUrl(parsed)) {
    throw new Error("Postman collection is missing a baseUrl variable.");
  }
  return new Map([
    [PINNED_OPENAPI_DOWNLOAD_NAME, specText],
    [
      PINNED_OPENAPI_PROVENANCE_NAME,
      `${JSON.stringify(provenance, null, 2)}\n`,
    ],
    [POSTMAN_COLLECTION_DOWNLOAD_NAME, collection],
  ]);
}

function collectionIncludesBaseUrl(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  if (!("variable" in value)) return false;
  const variables = value.variable;
  if (!Array.isArray(variables)) return false;
  return variables.some(
    (variable) =>
      typeof variable === "object" &&
      variable !== null &&
      "key" in variable &&
      variable.key === "baseUrl" &&
      "value" in variable &&
      typeof variable.value === "string" &&
      variable.value.length > 0
  );
}
