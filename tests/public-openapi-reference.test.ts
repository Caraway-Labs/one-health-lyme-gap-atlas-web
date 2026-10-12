import { spawnSync } from "node:child_process";
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

  it("renders Retry-After, descriptions, and examples for 429 and 503", () => {
    const pages = renderPublicApiReference(
      readAndLoadPublicOpenApiContract(process.cwd())
    );
    const sections = ["429", "503"].flatMap((status) =>
      [...pages.entries()]
        .filter(([name]) => name.endsWith(".mdx"))
        .flatMap(([name, contents]) =>
          responseSections(contents, status).map((body) => ({
            body,
            name,
            status,
          }))
        )
    );
    const incomplete = sections
      .filter((section) =>
        [
          "###### Retry-After",
          "Seconds before retry when supplied by the service.",
          "Type: `string`",
          "application/problem+json",
          "Synthetic error example",
        ].some((phrase) => !section.body.includes(phrase))
      )
      .map((section) => `${section.name} ${section.status}`);

    expect(sections).toHaveLength(36);
    expect(incomplete).toStrictEqual([]);
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

  it("renders inline responses and dereferenced reusable component responses", () => {
    const pinned = pin(documentWithReusableComponents());
    const page = requiredFile(
      renderPublicApiReference(
        loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
      ),
      "discovery.mdx"
    );
    const referenced = between(page, "#### 200", "#### 304");
    const empty = between(page, "#### 304", "## Submit an indicator");
    const submitted = page.slice(page.indexOf("## Submit an indicator"));

    expect(
      missingPhrases(page, [
        "Reusable indicators.",
        "human_disease_burden",
        "[Indicator](/docs/api-reference/schemas#schema-indicator)",
        "county_fips",
        "08001",
        "Synthetic lower-48 indicator.",
        "###### Again",
        "Read the indicator again.",
      ])
    ).toStrictEqual([]);
    expect(
      referenced.includes("This response does not declare a body.")
    ).toBeFalsy();
    expect(
      missingPhrases(empty, [
        "This response does not declare a body.",
        "###### ETag",
        "Required: yes",
        "Entity tag.",
        "Type: `string`",
        "example-etag",
      ])
    ).toStrictEqual([]);
    expect(
      missingPhrases(submitted, [
        "Inline indicators.",
        "case_count_floor_2023",
        "lower-48",
        "Reusable body.",
        "Required: yes",
      ])
    ).toStrictEqual([]);
    expect(
      submitted.includes("This request body does not declare a media type.")
    ).toBeFalsy();
  });

  it("fails the reference check for a missing or circular reusable component", () => {
    expect(failureCode(() => checkDocument(missingResponseRef()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(circularResponseRefs()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(missingParameterRef()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(circularHeaderRefs()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(missingExampleRef()))).toBe(
      "malformed"
    );
  });

  it("fails the reference check for circular request bodies and examples", () => {
    expect(failureCode(() => checkDocument(circularRequestBodyRefs()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(circularExampleRefs()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(nonObjectResponseRef()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(missingLinkRef()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(circularLinkRefs()))).toBe(
      "malformed"
    );
  });

  it("rejects malformed contracts that cannot be rendered", () => {
    expect(failureCode(() => checkDocument(openapi2Document()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(duplicateOperationIds()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(parameterWithoutName()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(headersNotAnObject()))).toBe(
      "malformed"
    );
    expect(failureCode(() => checkDocument(externalSchemaRef()))).toBe(
      "malformed"
    );
  });

  it("renders empty request bodies and colliding schema anchors", () => {
    const pinned = pin(documentWithCollidingSchemas());
    const pages = renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );

    expect(
      missingPhrases(requiredFile(pages, "discovery-2.mdx"), [
        "This request body does not declare a media type.",
        "indicators_post",
      ])
    ).toStrictEqual([]);
    expect(requiredFile(pages, "schemas.mdx")).toContain("[#schema-a-b-2]");
  });

  it("checks the pinned contract from the command line", () => {
    const success = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "src/lib/public-openapi-reference.ts",
        "--check",
      ],
      { cwd: process.cwd(), encoding: "utf-8" }
    );
    const root = makeRoot();
    const failure = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        path.join(process.cwd(), "src/lib/public-openapi-reference.ts"),
        "--check",
      ],
      { cwd: root, encoding: "utf-8" }
    );

    expect(success.status).toBe(0);
    expect(success.stdout).toContain("matches the pinned contract");
    expect(failure.status).toBe(1);
    expect(failure.stderr).toContain("unavailable");
  });

  it("treats a generated page that dropped a dereferenced response body as stale", () => {
    const pinned = pin(documentWithReusableComponents());
    const root = makeRoot();
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_RELATIVE_PATH),
      pinned.specBytes
    );
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH),
      pinned.manifestText
    );
    syncPublicApiReference({ check: false, root });
    const pagePath = path.join(
      root,
      API_REFERENCE_RELATIVE_DIR,
      "discovery.mdx"
    );
    const page = readFileSync(pagePath, "utf-8");

    expect(page).toContain("Reusable indicators.");
    writeFileSync(
      pagePath,
      page.replace(
        "Reusable indicators.",
        "This response does not declare a body."
      )
    );
    expect(
      failureCode(() => syncPublicApiReference({ check: true, root }))
    ).toBe("stale_reference");
  });

  it("renders referenced path items, servers, and security", () => {
    const pinned = pin(documentWithPathItemReference());
    const pages = renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const page = requiredFile(pages, "discovery.mdx");
    const indicators = between(page, "## Referenced indicators", "## Health");
    const health = between(page, "## Health", "## Read measures");
    const measures = between(page, "## Read measures", "## Submit measures");

    expect(
      missingPhrases(indicators, [
        "indicators_v1_indicators_get",
        "Alias summary",
        "Alias path.",
        "Outer county.",
        "county_fips",
        "08001",
        "Local indicators.",
        "Public edge",
        "X-Atlas-Key",
        "Public key",
        "[Indicator](/docs/api-reference/schemas#schema-indicator)",
      ])
    ).toStrictEqual([]);
    expect(
      indicators.includes("#### limit") ||
        indicators.includes("Reusable indicators.") ||
        indicators.includes("Upstream origin") ||
        indicators.includes("Colorado county.") ||
        indicators.includes("Origin key")
    ).toBeFalsy();
    expect(missingPhrases(health, ["health_get", "Ready."])).toStrictEqual([]);
    expect(health.includes("Hidden path server")).toBeFalsy();
    expect(
      missingPhrases(measures, [
        "https://measures.onehealthatlas.org",
        "Operation server",
      ])
    ).toStrictEqual([]);
  });

  it("uses path-item security and servers only when the operation omits them", () => {
    const pinned = pin(documentWithPathItemReference());
    const pages = renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const page = requiredFile(pages, "discovery.mdx");
    const measures = between(page, "## Read measures", "## Submit measures");
    const submitted = between(page, "## Submit measures", "\n## ");

    expect(measures.includes("X-Atlas-Key")).toBeFalsy();
    expect(measures.includes("Path server")).toBeFalsy();
    expect(
      missingPhrases(submitted, [
        "measures_post",
        "Measure county.",
        "Path server",
        "X-Atlas-Key",
        "Public key",
      ])
    ).toStrictEqual([]);
    expect(
      missingPhrases(requiredFile(pages, "index.mdx"), [
        "`https://api.onehealthatlas.org/` (Public edge)",
      ])
    ).toStrictEqual([]);
    expect(
      requiredFile(pages, "index.mdx").includes("Upstream origin")
    ).toBeFalsy();
  });

  it("lets a path-item sibling operation override the referenced operation", () => {
    const document = documentWithPathItemReference();
    const paths = document.paths as {
      "/v1/indicators": Record<string, unknown>;
    };
    paths["/v1/indicators"].get = {
      operationId: "outer_indicators_get",
      responses: { "204": { description: "Outer operation." } },
      summary: "Outer indicators",
      tags: ["discovery"],
    };
    const pinned = pin(document);
    const page = requiredFile(
      renderPublicApiReference(
        loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
      ),
      "discovery.mdx"
    );

    expect(page).toContain("outer_indicators_get");
    expect(page).toContain("Outer operation.");
    expect(page.includes("indicators_v1_indicators_get")).toBeFalsy();
  });

  it("treats a dropped path-item operation as a stale reference", () => {
    const pinned = pin(documentWithPathItemReference());
    const root = makeRoot();
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_RELATIVE_PATH),
      pinned.specBytes
    );
    writeFileSync(
      path.join(root, PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH),
      pinned.manifestText
    );
    syncPublicApiReference({ check: false, root });
    const pagePath = path.join(
      root,
      API_REFERENCE_RELATIVE_DIR,
      "discovery.mdx"
    );
    const page = readFileSync(pagePath, "utf-8");

    expect(
      failureCode(() => syncPublicApiReference({ check: true, root }))
    ).toBe("did-not-fail");
    expect(page).toContain("indicators_v1_indicators_get");
    expect(page).toContain("health_get");
    writeFileSync(
      pagePath,
      page.replace("indicators_v1_indicators_get", "omitted_operation")
    );
    expect(
      failureCode(() => syncPublicApiReference({ check: true, root }))
    ).toBe("stale_reference");
  });

  it("fails the reference check for a bad path item or callback reference", () => {
    expect(failureText(() => checkDocument(missingPathItemRef()))).toContain(
      "Unresolved OpenAPI reference #/components/pathItems/Missing"
    );
    expect(failureText(() => checkDocument(circularPathItemRefs()))).toContain(
      "Circular OpenAPI reference"
    );
    expect(failureText(() => checkDocument(nonObjectPathItemRef()))).toContain(
      "must point to an object"
    );
    expect(failureText(() => checkDocument(schemaPathItemRef()))).toContain(
      "must point to components.pathItems"
    );
    expect(
      failureText(() => checkDocument(documentWithCallbackRef()))
    ).toContain("callbacks are not rendered");
  });

  it("fails the reference check for webhooks and unresolved server references", () => {
    expect(failureText(() => checkDocument(documentWithWebhooks()))).toContain(
      "webhooks are not rendered"
    );
    expect(failureText(() => checkDocument(missingServerRef()))).toContain(
      "Unresolved OpenAPI reference #/components/servers/Missing"
    );
    expect(failureText(() => checkDocument(circularServerRefs()))).toContain(
      "Circular OpenAPI reference"
    );
    expect(failureText(() => checkDocument(schemaServerRef()))).toContain(
      "must point to components.servers"
    );
    expect(
      failureText(() => checkDocument(securityRequirementRef()))
    ).toContain("security requirements must be objects");
  });

  it("fails the reference check for security schemes and server shape", () => {
    expect(failureText(() => checkDocument(missingSecurityScheme()))).toContain(
      "Unresolved OpenAPI reference #/components/securitySchemes/Missing"
    );
    expect(
      failureText(() => checkDocument(circularSecuritySchemes()))
    ).toContain("Circular OpenAPI reference");
    expect(
      failureText(() => checkDocument(operationServersNotAnArray()))
    ).toContain("servers must be an array");
    expect(failureText(() => checkDocument(serverMissingUrl()))).toContain(
      "is missing a url"
    );
    expect(failureText(() => checkDocument(httpServerDocument()))).toContain(
      "source_mismatch: Public OpenAPI server URL must be HTTPS"
    );
  });

  it("rejects cross-type references instead of rendering them as empty fields", () => {
    expect(failureText(() => checkDocument(numericResponseRef()))).toContain(
      "OpenAPI $ref must be a non-empty string"
    );
    expect(failureText(() => checkDocument(schemaExampleRef()))).toContain(
      "Unsupported OpenAPI reference #/components/schemas/Indicator"
    );
    expect(failureText(() => checkDocument(parameterHeaderRef()))).toContain(
      "Unsupported OpenAPI reference #/components/parameters/County"
    );
    expect(failureText(() => checkDocument(securityNotAnArray()))).toContain(
      "security must be an array"
    );
    expect(failureText(() => checkDocument(nonObjectServerRef()))).toContain(
      "must point to an object"
    );
  });

  it("rejects empty refs, empty server lists, and non-object components", () => {
    expect(failureText(() => checkDocument(blankServerRef()))).toContain(
      "OpenAPI $ref must be a non-empty string"
    );
    expect(failureText(() => checkDocument(serverDocument([])))).toContain(
      "must declare an HTTPS server"
    );
    expect(
      failureText(() =>
        checkDocument(serverDocument({ url: "https://api.onehealthatlas.org" }))
      )
    ).toContain("must declare an HTTPS server");
    expect(
      failureText(() =>
        checkDocument(serverDocument(["https://api.onehealthatlas.org"]))
      )
    ).toContain("Document server 1 must be an object");
    expect(
      failureText(() => checkDocument(inlineNonObjectResponse()))
    ).toContain("response 200 must be an object");
  });

  it("rejects a security scheme reference that is not a security scheme", () => {
    expect(failureText(() => checkDocument(schemaSecurityScheme()))).toContain(
      "must point to components.securitySchemes"
    );
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

function failureText(action: () => void): string {
  try {
    action();
  } catch (error) {
    if (error instanceof PublicOpenApiContractError) {
      return `${error.code}: ${error.message}`;
    }
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

function responseSections(contents: string, status: string): string[] {
  const marker = `\n#### ${status}\n`;
  return contents
    .split(marker)
    .slice(1)
    .map((piece) => {
      const next = piece.indexOf("\n#### ");
      return next === -1 ? piece : piece.slice(0, next);
    });
}

function between(contents: string, start: string, end: string): string {
  const startIndex = contents.indexOf(start);
  if (startIndex === -1) return "";
  const endIndex = contents.indexOf(end, startIndex + start.length);
  return contents.slice(startIndex, endIndex === -1 ? undefined : endIndex);
}

function checkDocument(document: unknown): void {
  const pinned = pin(document);
  const root = makeRoot();
  writeFileSync(
    path.join(root, PUBLIC_OPENAPI_RELATIVE_PATH),
    pinned.specBytes
  );
  writeFileSync(
    path.join(root, PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH),
    pinned.manifestText
  );
  syncPublicApiReference({ check: true, root });
}

function documentWithReusableComponents(): Record<string, unknown> {
  return {
    ...minimalDocument(),
    components: {
      examples: {
        IndicatorSample: {
          description: "Synthetic lower-48 indicator.",
          summary: "Synthetic indicator",
          value: { indicator_id: "human_disease_burden" },
        },
      },
      headers: {
        ETag: {
          description: "Entity tag.",
          required: true,
          schema: { example: "example-etag", type: "string" },
        },
      },
      links: {
        ReadIndicator: {
          description: "Read the indicator again.",
          operationId: "indicators_v1_indicators_get",
        },
      },
      parameters: {
        County: {
          description: "Colorado county.",
          in: "query",
          name: "county_fips",
          required: true,
          schema: { example: "08001", type: "string" },
        },
      },
      requestBodies: {
        IndicatorBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Indicator" },
            },
          },
          description: "Reusable body.",
          required: true,
        },
      },
      responses: {
        IndicatorAlias: { $ref: "#/components/responses/IndicatorOk" },
        IndicatorOk: {
          content: {
            "application/json": {
              examples: {
                sample: { $ref: "#/components/examples/IndicatorSample" },
              },
              schema: { $ref: "#/components/schemas/Indicator" },
            },
          },
          description: "Reusable indicators.",
          links: {
            Again: { $ref: "#/components/links/ReadIndicator" },
          },
        },
      },
      schemas: {
        Indicator: {
          properties: { indicator_id: { type: "string" } },
          type: "object",
        },
      },
    },
    paths: {
      "/v1/indicators": {
        get: {
          operationId: "indicators_v1_indicators_get",
          parameters: [{ $ref: "#/components/parameters/County" }],
          responses: {
            "200": { $ref: "#/components/responses/IndicatorAlias" },
            "304": {
              description: "Not modified.",
              headers: { ETag: { $ref: "#/components/headers/ETag" } },
            },
          },
          summary: "Discover indicators",
          tags: ["discovery"],
        },
        post: {
          operationId: "indicators_post",
          requestBody: { $ref: "#/components/requestBodies/IndicatorBody" },
          responses: {
            "200": {
              content: {
                "application/json": {
                  example: { indicator_id: "case_count_floor_2023" },
                  examples: { note: "lower-48" },
                  schema: {
                    items: { $ref: "#/components/schemas/Indicator" },
                    type: "array",
                  },
                },
              },
              description: "Inline indicators.",
            },
          },
          summary: "Submit an indicator",
          tags: ["discovery"],
        },
      },
    },
  };
}

function missingResponseRef(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const paths = document.paths as {
    "/v1/indicators": { get: { responses: Record<string, unknown> } };
  };
  paths["/v1/indicators"].get.responses["200"] = {
    $ref: "#/components/responses/Missing",
  };
  return document;
}

function circularResponseRefs(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    responses: Record<string, unknown>;
  };
  components.responses = {
    LoopA: { $ref: "#/components/responses/LoopB" },
    LoopB: { $ref: "#/components/responses/LoopA" },
  };
  return document;
}

function missingParameterRef(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const paths = document.paths as {
    "/v1/indicators": { get: { parameters: unknown[] } };
  };
  paths["/v1/indicators"].get.parameters = [
    { $ref: "#/components/parameters/Missing" },
  ];
  return document;
}

function circularHeaderRefs(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    headers: Record<string, unknown>;
  };
  components.headers = {
    LoopA: { $ref: "#/components/headers/LoopB" },
    LoopB: { $ref: "#/components/headers/LoopA" },
  };
  const paths = document.paths as {
    "/v1/indicators": {
      get: { responses: { "304": { headers: Record<string, unknown> } } };
    };
  };
  paths["/v1/indicators"].get.responses["304"].headers = {
    ETag: { $ref: "#/components/headers/LoopA" },
  };
  return document;
}

function missingExampleRef(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    responses: {
      IndicatorOk: {
        content: {
          "application/json": { examples: Record<string, unknown> };
        };
      };
    };
  };
  components.responses.IndicatorOk.content["application/json"].examples = {
    sample: { $ref: "#/components/examples/Missing" },
  };
  return document;
}

function circularRequestBodyRefs(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    requestBodies: Record<string, unknown>;
  };
  components.requestBodies = {
    LoopA: { $ref: "#/components/requestBodies/LoopB" },
    LoopB: { $ref: "#/components/requestBodies/LoopA" },
  };
  return document;
}

function circularExampleRefs(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    examples: Record<string, unknown>;
  };
  components.examples = {
    LoopA: { $ref: "#/components/examples/LoopB" },
    LoopB: { $ref: "#/components/examples/LoopA" },
  };
  return document;
}

function missingLinkRef(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    responses: { IndicatorOk: { links: Record<string, unknown> } };
  };
  components.responses.IndicatorOk.links = {
    Again: { $ref: "#/components/links/Missing" },
  };
  return document;
}

function circularLinkRefs(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    links: Record<string, unknown>;
    responses: { IndicatorOk: { links: Record<string, unknown> } };
  };
  components.links = {
    LoopA: { $ref: "#/components/links/LoopB" },
    LoopB: { $ref: "#/components/links/LoopA" },
  };
  components.responses.IndicatorOk.links = {
    Again: { $ref: "#/components/links/LoopA" },
  };
  return document;
}

function nonObjectResponseRef(): Record<string, unknown> {
  const document = documentWithReusableComponents();
  const components = document.components as {
    responses: Record<string, unknown>;
  };
  components.responses.Broken = "not-an-object";
  const paths = document.paths as {
    "/v1/indicators": { get: { responses: Record<string, unknown> } };
  };
  paths["/v1/indicators"].get.responses["200"] = {
    $ref: "#/components/responses/Broken",
  };
  return document;
}

function openapi2Document(): Record<string, unknown> {
  return { ...minimalDocument(), openapi: "2.0" };
}

function duplicateOperationIds(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as Record<string, unknown>;
  paths["/v1/measures"] = {
    get: {
      operationId: "indicators_v1_indicators_get",
      responses: { "204": { description: "No content." } },
      summary: "Discover measures",
      tags: ["discovery"],
    },
  };
  return document;
}

function parameterWithoutName(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": { get: { parameters?: unknown[] } };
  };
  paths["/v1/indicators"].get.parameters = [{ in: "query" }];
  return document;
}

function headersNotAnObject(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": {
      get: { responses: { "200": { headers?: unknown } } };
    };
  };
  paths["/v1/indicators"].get.responses["200"].headers = [];
  return document;
}

function externalSchemaRef(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": {
      get: {
        responses: {
          "200": { content: { "application/json": { schema: unknown } } };
        };
      };
    };
  };
  paths["/v1/indicators"].get.responses["200"].content[
    "application/json"
  ].schema = { $ref: "https://example.com/schemas/Indicator" };
  return document;
}

function documentWithCollidingSchemas(): Record<string, unknown> {
  return {
    ...minimalDocument(),
    components: {
      schemas: {
        "A B": { type: "object" },
        "A-B": { type: "object" },
      },
    },
    paths: {
      "/v1/indicators": {
        get: {
          operationId: "indicators_v1_indicators_get",
          responses: {
            "200": {
              content: {
                "application/json": { schema: { type: "object" } },
              },
              description: "Indicators.",
            },
          },
          summary: "Discover indicators",
          tags: ["discovery"],
        },
        post: {
          operationId: "indicators_post",
          requestBody: { description: "Bare body." },
          responses: { "204": { description: "No content." } },
          summary: "Submit an indicator",
          tags: ["Discovery"],
        },
      },
    },
    tags: [
      { description: "Discovery.", name: "discovery" },
      { description: "Also discovery.", name: "Discovery" },
    ],
  };
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

function documentWithPathItemReference(): Record<string, unknown> {
  const base = minimalDocument();
  return {
    ...base,
    components: {
      ...(base.components as Record<string, unknown>),
      parameters: {
        County: {
          description: "Colorado county.",
          in: "query",
          name: "county_fips",
          required: true,
          schema: { example: "08001", type: "string" },
        },
        Limit: {
          in: "query",
          name: "limit",
          schema: { type: "integer" },
        },
      },
      pathItems: {
        Alias: {
          $ref: "#/components/pathItems/Indicators",
          description: "Alias path.",
          summary: "Alias summary",
        },
        Indicators: {
          get: {
            operationId: "indicators_v1_indicators_get",
            responses: {
              "200": {
                $ref: "#/components/responses/IndicatorOk",
                description: "Local indicators.",
              },
            },
            summary: "Referenced indicators",
            tags: ["discovery"],
          },
          parameters: [
            { in: "query", name: "limit", schema: { type: "integer" } },
          ],
        },
      },
      responses: {
        IndicatorOk: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Indicator" },
            },
          },
          description: "Reusable indicators.",
        },
      },
      securitySchemes: {
        Alias: {
          $ref: "#/components/securitySchemes/ApiKey",
          description: "Public key",
        },
        ApiKey: {
          description: "Origin key",
          in: "header",
          name: "X-Atlas-Key",
          type: "apiKey",
        },
      },
      servers: {
        Alias: {
          $ref: "#/components/servers/Production",
          description: "Public edge",
        },
        Production: {
          description: "Upstream origin",
          url: "https://api.onehealthatlas.org/",
        },
      },
    },
    paths: {
      "/v1/indicators": {
        $ref: "#/components/pathItems/Alias",
        parameters: [
          {
            $ref: "#/components/parameters/County",
            description: "Outer county.",
          },
        ],
        security: [{ Alias: [] }],
        servers: [{ $ref: "#/components/servers/Alias" }],
      },
      "/v1/health": {
        get: {
          operationId: "health_get",
          responses: { "204": { description: "Ready." } },
          servers: [],
          summary: "Health",
          tags: ["discovery"],
        },
        servers: [
          {
            description: "Hidden path server",
            url: "https://api.onehealthatlas.org",
          },
        ],
      },
      "/v1/measures": {
        get: {
          operationId: "measures_get",
          responses: { "204": { description: "No content." } },
          security: [],
          servers: [
            {
              description: "Operation server",
              url: "https://measures.onehealthatlas.org",
            },
          ],
          summary: "Read measures",
          tags: ["discovery"],
        },
        parameters: [
          {
            $ref: "#/components/parameters/County",
            description: "Measure county.",
          },
        ],
        post: {
          operationId: "measures_post",
          responses: { "204": { description: "Accepted." } },
          summary: "Submit measures",
          tags: ["discovery"],
        },
        security: [{ Alias: [] }],
        servers: [
          {
            description: "Path server",
            url: "https://api.onehealthatlas.org",
          },
        ],
      },
    },
    servers: [{ $ref: "#/components/servers/Alias" }],
  };
}

function documentWithCallbackRef(): Record<string, unknown> {
  const document = documentWithPathItemReference();
  const components = document.components as {
    callbacks?: Record<string, unknown>;
    pathItems: { Indicators: { get: Record<string, unknown> } };
  };
  components.callbacks = {
    OnData: {
      "{$request.query.callbackUrl}": {
        post: {
          operationId: "callback_post",
          responses: { "200": { description: "Ack." } },
        },
      },
    },
  };
  components.pathItems.Indicators.get.callbacks = {
    onData: { $ref: "#/components/callbacks/OnData" },
  };
  return document;
}

function documentWithWebhooks(): Record<string, unknown> {
  return {
    ...minimalDocument(),
    webhooks: {
      indicatorReady: {
        post: {
          operationId: "indicator_ready",
          responses: { "200": { description: "Ack." } },
        },
      },
    },
  };
}

function pathItemDocument(
  pathItems: Record<string, unknown>,
  ref: string
): Record<string, unknown> {
  const document = documentWithPathItemReference();
  const components = document.components as {
    pathItems: Record<string, unknown>;
  };
  components.pathItems = pathItems;
  const paths = document.paths as Record<string, unknown>;
  paths["/v1/indicators"] = { $ref: ref };
  return document;
}

function missingPathItemRef(): Record<string, unknown> {
  return pathItemDocument({}, "#/components/pathItems/Missing");
}

function circularPathItemRefs(): Record<string, unknown> {
  return pathItemDocument(
    {
      LoopA: { $ref: "#/components/pathItems/LoopB" },
      LoopB: { $ref: "#/components/pathItems/LoopA" },
    },
    "#/components/pathItems/LoopA"
  );
}

function nonObjectPathItemRef(): Record<string, unknown> {
  return pathItemDocument(
    { Broken: "not-an-object" },
    "#/components/pathItems/Broken"
  );
}

function schemaPathItemRef(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as Record<string, unknown>;
  paths["/v1/indicators"] = { $ref: "#/components/schemas/Indicator" };
  return document;
}

function serverDocument(
  servers: unknown,
  componentsServers: Record<string, unknown> = {}
): Record<string, unknown> {
  const document = minimalDocument();
  const components = document.components as Record<string, unknown>;
  components.servers = componentsServers;
  document.servers = servers;
  return document;
}

function missingServerRef(): Record<string, unknown> {
  return serverDocument([{ $ref: "#/components/servers/Missing" }]);
}

function circularServerRefs(): Record<string, unknown> {
  return serverDocument([{ $ref: "#/components/servers/LoopA" }], {
    LoopA: { $ref: "#/components/servers/LoopB" },
    LoopB: { $ref: "#/components/servers/LoopA" },
  });
}

function schemaServerRef(): Record<string, unknown> {
  return serverDocument([{ $ref: "#/components/schemas/Indicator" }]);
}

function nonObjectServerRef(): Record<string, unknown> {
  return serverDocument([{ $ref: "#/components/servers/Broken" }], {
    Broken: "not-an-object",
  });
}

function serverMissingUrl(): Record<string, unknown> {
  return serverDocument([{ description: "Production" }]);
}

function httpServerDocument(): Record<string, unknown> {
  return serverDocument([{ url: "http://api.onehealthatlas.org" }]);
}

function operationServersNotAnArray(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": { get: { servers?: unknown } };
  };
  paths["/v1/indicators"].get.servers = {
    url: "https://api.onehealthatlas.org",
  };
  return document;
}

function withSecurity(
  security: unknown,
  schemes: Record<string, unknown> = {}
): Record<string, unknown> {
  const document = minimalDocument();
  const components = document.components as Record<string, unknown>;
  components.securitySchemes = schemes;
  const paths = document.paths as {
    "/v1/indicators": { get: { security?: unknown } };
  };
  paths["/v1/indicators"].get.security = security;
  return document;
}

function securityRequirementRef(): Record<string, unknown> {
  return withSecurity([{ $ref: "#/components/securitySchemes/ApiKey" }], {
    ApiKey: { in: "header", name: "X-Atlas-Key", type: "apiKey" },
  });
}

function missingSecurityScheme(): Record<string, unknown> {
  return withSecurity([{ Missing: [] }]);
}

function circularSecuritySchemes(): Record<string, unknown> {
  return withSecurity([{ LoopA: [] }], {
    LoopA: { $ref: "#/components/securitySchemes/LoopB" },
    LoopB: { $ref: "#/components/securitySchemes/LoopA" },
  });
}

function securityNotAnArray(): Record<string, unknown> {
  return withSecurity(
    { ApiKey: [] },
    {
      ApiKey: { in: "header", name: "X-Atlas-Key", type: "apiKey" },
    }
  );
}

function blankServerRef(): Record<string, unknown> {
  return serverDocument([{ $ref: " " }]);
}

function inlineNonObjectResponse(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": { get: { responses: Record<string, unknown> } };
  };
  paths["/v1/indicators"].get.responses["200"] = "not-an-object";
  return document;
}

function schemaSecurityScheme(): Record<string, unknown> {
  return withSecurity([{ Alias: [] }], {
    Alias: { $ref: "#/components/schemas/Indicator" },
  });
}

function numericResponseRef(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": { get: { responses: Record<string, unknown> } };
  };
  paths["/v1/indicators"].get.responses["200"] = { $ref: 1 };
  return document;
}

function schemaExampleRef(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": {
      get: {
        responses: {
          "200": { content: { "application/json": { examples?: unknown } } };
        };
      };
    };
  };
  paths["/v1/indicators"].get.responses["200"].content[
    "application/json"
  ].examples = { sample: { $ref: "#/components/schemas/Indicator" } };
  return document;
}

function parameterHeaderRef(): Record<string, unknown> {
  const document = minimalDocument();
  const components = document.components as Record<string, unknown>;
  components.parameters = {
    County: {
      in: "query",
      name: "county_fips",
      schema: { type: "string" },
    },
  };
  const paths = document.paths as {
    "/v1/indicators": {
      get: { responses: { "200": { headers?: unknown } } };
    };
  };
  paths["/v1/indicators"].get.responses["200"].headers = {
    ETag: { $ref: "#/components/parameters/County" },
  };
  return document;
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
