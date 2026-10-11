import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  API_REFERENCE_RELATIVE_DIR,
  type PublicOpenApiFailureCode,
  PublicOpenApiContractError,
  PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH,
  PUBLIC_OPENAPI_RELATIVE_PATH,
  loadPublicOpenApiContract,
  readAndLoadPublicOpenApiContract,
  renderPublicApiReference,
  syncPublicApiReference,
} from "@/lib/public-openapi-reference";

const temporaryRoots: string[] = [];

describe("public OpenAPI reference", () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("labels the pinned spec version, source, and raw schema", () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const index = requiredFile(renderPublicApiReference(contract), "index.mdx");

    expect(contract.provenance).toMatchObject({
      applicationVersion: "0.1.0",
      httpContract: "/v1",
      openapiVersion: "3.1.0",
      sourcePath: "openapi.json",
      sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
      sourceUrl: "https://api.onehealthatlas.org/openapi.json",
    });
    expect(contract.provenance.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(contract.provenance.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(
      missingPhrases(index, [
        "OpenAPI version",
        "`0.1.0`",
        "`/v1`",
        contract.provenance.sourceCommit,
        contract.provenance.sha256,
        "[OpenAPI schema](https://api.onehealthatlas.org/openapi.json)",
      ])
    ).toStrictEqual([]);
    expect(index.includes("Alaska") || index.includes("Hawaii")).toBeFalsy();
  });

  it("renders the observations operation once with its example, schema, and error", () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const pages = renderPublicApiReference(contract);
    const observations = requiredFile(pages, "observations.mdx");

    expect(
      missingPhrases(observations, [
        "[#observations_v1_observations_get]",
        "`GET /v1/observations`",
        "Operation ID: `observations_v1_observations_get`",
        "case_count_floor_2023",
        "application/problem+json",
        "#### 400",
        "[ProblemDetails](/docs/api-reference/schemas#schema-problemdetails)",
      ])
    ).toStrictEqual([]);
    expect(headingCount(pages, "[#observations_v1_observations_get]")).toBe(1);
    const schemaPage = requiredFile(pages, "schemas.mdx");
    const schemaCount = schemaPage.match(/^## /gm)?.length ?? 0;
    expect(
      [
        schemaPage.includes("## ProblemDetails"),
        schemaCount > 0,
        requiredFile(pages, "index.mdx").includes(
          `Component schemas: [Schemas](/docs/api-reference/schemas) (${schemaCount}).`
        ),
      ].every(Boolean)
    ).toBeTruthy();
    expect(requiredFile(pages, "discovery.mdx")).toContain(
      "This response does not declare a body."
    );
    expect(fileMap(pages)).toStrictEqual(
      fileMap(renderPublicApiReference(contract))
    );
  });

  it("renders each operation id once and keeps authored guides free of that catalog", () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const pages = renderPublicApiReference(contract);
    const operationIds = contract.tags.flatMap((tag) =>
      tag.operations.map((operation) => operation.operationId)
    );
    const authored = readFileSync(
      path.join(process.cwd(), "content/docs/api-mcp-and-access.mdx"),
      "utf-8"
    );

    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(
      operationIds.filter(
        (operationId) => headingCount(pages, `[#${operationId}]`) !== 1
      )
    ).toStrictEqual([]);
    expect(
      operationIds.filter((operationId) => authored.includes(operationId))
    ).toStrictEqual([]);
  });

  it("fails visibly when the contract is unavailable, malformed, or empty", () => {
    const empty = pin({ ...minimalDocument(), paths: {} });

    expect(
      failureCode(() => readAndLoadPublicOpenApiContract(makeRoot()))
    ).toBe("unavailable");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(Buffer.from("{"), manifestMatching("{"))
      )
    ).toBe("malformed");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(Buffer.from("[]"), manifestMatching("[]"))
      )
    ).toBe("malformed");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(empty.specBytes, empty.manifestText)
      )
    ).toBe("empty");
  });

  it("fails visibly for checksum, version, source, and first-party mismatches", () => {
    const valid = pin(minimalDocument());
    const flipped = Buffer.from(valid.specBytes);
    const lastByte = flipped.at(-2) ?? 0;
    flipped[flipped.length - 2] = lastByte === 125 ? 126 : 125;
    const wrongApplicationVersion = pin(minimalDocument(), {
      infoVersion: "9.9.9",
    });
    const wrongOpenApiVersion = pin(minimalDocument(), { openapi: "3.0.3" });
    const wrongSource = pin(minimalDocument(), {
      sourceUrl: "https://example.com/openapi.json",
    });

    expect(
      failureCode(() => loadPublicOpenApiContract(flipped, valid.manifestText))
    ).toBe("checksum_mismatch");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongApplicationVersion.specBytes,
          wrongApplicationVersion.manifestText
        )
      )
    ).toBe("version_mismatch");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongOpenApiVersion.specBytes,
          wrongOpenApiVersion.manifestText
        )
      )
    ).toBe("version_mismatch");
    expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongSource.specBytes,
          wrongSource.manifestText
        )
      )
    ).toBe("source_mismatch");
    expect(failureCode(() => loadFirstPartyContract())).toBe(
      "not_public_contract"
    );
  });

  it("renders declared request bodies and refuses a stale generated page", () => {
    const withBody = pin(documentWithRequestBody());
    const page = requiredFile(
      renderPublicApiReference(
        loadPublicOpenApiContract(withBody.specBytes, withBody.manifestText)
      ),
      "discovery.mdx"
    );
    const root = makeRoot();
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_RELATIVE_PATH),
      withBody.specBytes
    );
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH),
      withBody.manifestText
    );
    syncPublicApiReference({ check: false, root });
    const generated = path.join(root, API_REFERENCE_RELATIVE_DIR);
    const removedPage = path.join(generated, "removed-operation.mdx");
    writeFileSync(path.join(generated, "discovery.mdx"), "stale catalog\n");
    writeFileSync(removedPage, "old endpoint\n");

    expect(
      missingPhrases(page, [
        "### Request body",
        "Required: yes",
        "human_disease_burden",
        "### Security",
        "This response does not declare a body.",
      ])
    ).toStrictEqual([]);
    expect(
      failureCode(() => syncPublicApiReference({ check: true, root }))
    ).toBe("stale_reference");

    syncPublicApiReference({ check: false, root });
    expect(
      readFileSync(path.join(generated, "discovery.mdx"), "utf-8")
    ).toContain("indicators_post");
    expect(existsSync(removedPage)).toBeFalsy();
    expect(
      failureCode(() => syncPublicApiReference({ check: true, root }))
    ).toBe("did-not-fail");
  });
});

function failureCode(
  action: () => void
): PublicOpenApiFailureCode | "did-not-fail" {
  try {
    action();
  } catch (error) {
    if (error instanceof PublicOpenApiContractError) return error.code;
    throw new Error("Unexpected public OpenAPI failure.", { cause: error });
  }
  return "did-not-fail";
}

function requiredFile(files: Map<string, string>, name: string): string {
  const contents = files.get(name);
  if (typeof contents !== "string") {
    throw new TypeError(`Missing generated API reference file ${name}.`);
  }
  return contents;
}

function missingPhrases(contents: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => !contents.includes(phrase));
}

function headingCount(files: Map<string, string>, marker: string): number {
  let count = 0;
  for (const contents of files.values()) {
    count += contents.split(marker).length - 1;
  }
  return count;
}

function fileMap(files: Map<string, string>): Record<string, string> {
  return Object.fromEntries(files);
}

function makeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "atlas-openapi-"));
  mkdirSync(path.join(root, "contracts"), { recursive: true });
  temporaryRoots.push(root);
  return root;
}

function pin(
  document: unknown,
  manifestOverrides: Record<string, string> = {}
): { manifestText: string; specBytes: Buffer } {
  const specBytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`);
  const sha256 = createHash("sha256").update(specBytes).digest("hex");
  const manifest = {
    infoVersion: "0.1.0",
    openapi: "3.1.0",
    sha256,
    sourceCommit: "a".repeat(40),
    sourcePath: "openapi.json",
    sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
    sourceUrl: "https://api.onehealthatlas.org/openapi.json",
    ...manifestOverrides,
  };
  if (!("sha256" in manifestOverrides)) manifest.sha256 = sha256;
  return { manifestText: `${JSON.stringify(manifest, null, 2)}\n`, specBytes };
}

function manifestMatching(specText: string): string {
  return `${JSON.stringify(
    {
      infoVersion: "0.1.0",
      openapi: "3.1.0",
      sha256: createHash("sha256").update(Buffer.from(specText)).digest("hex"),
      sourceCommit: "a".repeat(40),
      sourcePath: "openapi.json",
      sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
      sourceUrl: "https://api.onehealthatlas.org/openapi.json",
    },
    null,
    2
  )}\n`;
}

function loadFirstPartyContract(): void {
  const firstPartyBytes = readFileSync(
    path.join(process.cwd(), "contracts/openapi.json")
  );
  const firstParty = JSON.parse(firstPartyBytes.toString("utf-8")) as {
    servers: { url: string }[];
  };
  const serverUrl = firstParty.servers[0]?.url;
  if (!serverUrl) {
    throw new Error("First-party contract is missing a server URL.");
  }
  const pinned = pin(firstParty, {
    sourceUrl: new URL("/openapi.json", serverUrl).href,
  });
  const manifestText = pinned.manifestText.replace(
    /"sha256": "[0-9a-f]+"/,
    `"sha256": "${createHash("sha256").update(firstPartyBytes).digest("hex")}"`
  );
  loadPublicOpenApiContract(firstPartyBytes, manifestText);
}

function documentWithRequestBody(): Record<string, unknown> {
  return {
    ...minimalDocument(),
    paths: {
      "/v1/indicators": {
        post: {
          operationId: "indicators_post",
          requestBody: {
            content: {
              "application/json": {
                examples: {
                  illustrative: {
                    summary: "Synthetic body",
                    value: { indicator_id: "human_disease_burden" },
                  },
                },
                schema: { $ref: "#/components/schemas/Indicator" },
              },
            },
            description: "Create is not a public read.",
            required: true,
          },
          responses: {
            "204": { description: "No content." },
          },
          security: [],
          summary: "Submit an indicator",
          tags: ["discovery"],
        },
      },
    },
  };
}

function minimalDocument(): Record<string, unknown> {
  return {
    components: {
      schemas: {
        Indicator: {
          properties: { indicator_id: { type: "string" } },
          type: "object",
        },
      },
    },
    info: {
      description: "Read-only public Atlas contract.",
      title: "One Health Lyme Gap Atlas API",
      version: "0.1.0",
    },
    openapi: "3.1.0",
    paths: {
      "/v1/indicators": {
        get: {
          operationId: "indicators_v1_indicators_get",
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Indicator" },
                },
              },
              description: "Indicators.",
            },
          },
          summary: "Discover indicators",
          tags: ["discovery"],
        },
      },
    },
    servers: [
      { description: "Production", url: "https://api.onehealthatlas.org" },
    ],
    tags: [{ description: "Discovery.", name: "discovery" }],
  };
}
