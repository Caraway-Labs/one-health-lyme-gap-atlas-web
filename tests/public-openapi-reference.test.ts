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
import { parse } from "yaml";

import { GEOGRAPHY_IDENTITY_PATH } from "@/lib/endpoint-delivery";
import {
  API_REFERENCE_RELATIVE_DIR,
  type PublicOpenApiFailureCode,
  PublicOpenApiContractError,
  PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH,
  PUBLIC_OPENAPI_RELATIVE_PATH,
  compareAuthoritativeOpenApiChecksum,
  loadPublicOpenApiContract,
  readAndLoadPublicOpenApiContract,
  renderPublicApiReference,
  syncPublicApiReference,
} from "@/lib/public-openapi-reference";
import {
  getDocsUrl,
  getPublishedApiOrigin,
  getSiteOrigin,
} from "@/lib/public-origins";

const temporaryRoots: string[] = [];

describe("public OpenAPI reference", () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("labels the pinned spec version, source, and raw schema", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const index = requiredFile(
      await renderPublicApiReference(contract),
      "index.mdx"
    );

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
        "[Atlas documentation and developer guides](https://onehealthatlas.org/docs)",
      ])
    ).toStrictEqual([]);
    expect(index.includes("Alaska") || index.includes("Hawaii")).toBeFalsy();
  });

  it("renders the observations operation once with its example, schema, and error", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const pages = await renderPublicApiReference(contract);
    const observations = operationPage(
      pages,
      "observations_v1_observations_get"
    );

    expect(
      missingPhrases(observations, [
        "<OpenAPIPage",
        '"path":"/v1/observations"',
        '"method":"get"',
        "case_count_floor_2023",
        "application/problem+json",
        "measure_id",
        "#/components/schemas/ProblemDetails",
      ])
    ).toStrictEqual([]);
    const schemaPage = requiredFile(pages, "schemas.mdx");
    const schemaCount = schemaPage.match(/^## /gm)?.length ?? 0;
    expect({
      heading: headingCount(pages, "[#observations_v1_observations_get]"),
      index: requiredFile(pages, "index.mdx").includes(
        `Component schemas: [Schemas](/docs/api-reference/schemas) (${schemaCount}).`
      ),
      indicators: operationPage(pages, "indicators_v1_indicators_get").includes(
        "<OpenAPIPage"
      ),
      observationsIndex: requiredFile(pages, "observations/index.mdx").includes(
        "[#observations_v1_observations_get]"
      ),
      problemDetails: schemaPage.includes("## ProblemDetails"),
      schemaCount: schemaCount > 0,
    }).toStrictEqual({
      heading: 1,
      index: true,
      indicators: true,
      observationsIndex: true,
      problemDetails: true,
      schemaCount: true,
    });
    expect(fileMap(pages)).toStrictEqual(
      fileMap(await renderPublicApiReference(contract))
    );
  });

  it("renders county report template tabs from the pinned contract", async () => {
    const pages = await renderPublicApiReference(
      readAndLoadPublicOpenApiContract(process.cwd())
    );
    const counties = requiredFile(pages, "counties/index.mdx");
    expect(counties).toContain(
      'import { Tab, Tabs } from "fumadocs-ui/components/tabs";'
    );
    expect(
      missingPhrases(counties, [
        'items={["county-v1 scoring","county-v2 evidence"]}',
        'value="county-v1 scoring"',
        'value="county-v2 evidence"',
        "Observation context requires county-v2.",
        "county-v2 requires release, exact period and distinct measures.",
        "The requested county report template is not available.",
        "Cache-Control: public, max-age=300, must-revalidate",
        "Cache-Control: no-store",
        "lower 48 states",
        "District of Columbia",
        `${getPublishedApiOrigin({})}/v1/counties/36061/report.pdf?template=county-v1`,
        `${getSiteOrigin({})}/problems/http-422`,
        getDocsUrl({}),
        "| `ecological_share` | 65 | 40–85, multiple of 5 |",
        "| `low_incidence_breakpoint` | 10 | 5–25 |",
        "| `missing_human_weakness` | 75 | 40–90, multiple of 5 |",
      ])
    ).toStrictEqual([]);
    expect(
      counties.includes("Alaska") || counties.includes("Hawaii")
    ).toBeFalsy();
    const states = requiredFile(pages, "states/index.mdx");
    expect(states).not.toContain("fumadocs-ui/components/tabs");
  });

  it("badges the geography identity route as a dated production check", async () => {
    const pages = await renderPublicApiReference(
      readAndLoadPublicOpenApiContract(process.cwd())
    );
    const badge = "<EndpointDeliveryBadge />";
    const badgeImport =
      'import { EndpointDeliveryBadge } from "@/features/docs/endpoint-delivery-badge";';
    const identity = operationPage(
      pages,
      "geography_v1_geographies__geography_type___geography_id__get"
    );
    const geographies = requiredFile(pages, "geographies/index.mdx");
    const index = requiredFile(pages, "index.mdx");
    expect({
      atlas: requiredFile(
        pages,
        "atlas/geometry_v1_atlas_geometry_get.mdx"
      ).includes("EndpointDeliveryBadge"),
      availability: operationPage(
        pages,
        "canonicalGeographyAvailability"
      ).includes(badge),
      geographyBadge: geographies.includes(badge),
      geographyImport: geographies.includes(badgeImport),
      geographyRoute: geographies.includes(
        `\`GET ${GEOGRAPHY_IDENTITY_PATH}\``
      ),
      identityBadge: identity.includes(badge),
      identityImport: identity.includes(badgeImport),
      indexBadge: index.includes(badge),
      indexImport: index.includes(badgeImport),
      indexTabs: index.includes("fumadocs-ui/components/tabs"),
      provenance: requiredFile(
        pages,
        "provenance/source_v1_sources__source_id__get.mdx"
      ).includes("EndpointDeliveryBadge"),
    }).toStrictEqual({
      atlas: false,
      availability: false,
      geographyBadge: true,
      geographyImport: true,
      geographyRoute: true,
      identityBadge: true,
      identityImport: true,
      indexBadge: true,
      indexImport: true,
      indexTabs: false,
      provenance: false,
    });
  });

  it("renders Retry-After, descriptions, and examples for 429 and 503", async () => {
    const pages = await renderPublicApiReference(
      readAndLoadPublicOpenApiContract(process.cwd())
    );
    const operationFiles = [...pages.entries()].filter(([name]) =>
      /\/(?!index\.mdx$)[^/]+\.mdx$/.test(name)
    );
    const incomplete = operationFiles
      .filter(([, contents]) =>
        ["429", "503"].some(
          (status) =>
            contents.includes(`${status} `) &&
            [
              "Retry-After",
              "Seconds before retry when supplied by the service.",
              "application/problem+json",
            ].some((phrase) => !contents.includes(phrase))
        )
      )
      .map(([name]) => name);

    expect(operationFiles.length).toBeGreaterThan(0);
    expect(
      operationFiles.filter(([, contents]) => contents.includes("429 "))
    ).toHaveLength(operationFiles.length);
    expect(incomplete).toStrictEqual([]);
  });

  it("keeps each operation description in page metadata and out of the native renderer", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const pages = await renderPublicApiReference(contract);
    const problems: string[] = [];

    for (const tag of contract.tags) {
      for (const operation of tag.operations) {
        const page = operationPage(pages, operation.operationId);
        const split =
          /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/.exec(page);
        const frontmatter = split?.groups?.frontmatter;
        const body = split?.groups?.body ?? "";
        const parsed: unknown = frontmatter ? parse(frontmatter) : undefined;
        const description =
          parsed &&
          typeof parsed === "object" &&
          "description" in parsed &&
          typeof parsed.description === "string"
            ? parsed.description
            : undefined;
        const expected = operation.description.replaceAll(/\s+/g, " ").trim();
        const visibleCopies = expected ? body.split(expected).length - 1 : 0;
        if (description !== expected) {
          problems.push(`${operation.operationId} metadata`);
        }
        if (body.includes("showDescription") || visibleCopies !== 0) {
          problems.push(
            `${operation.operationId} rendered ${visibleCopies} time(s)`
          );
        }
      }
    }

    expect(problems).toStrictEqual([]);
  });

  it("renders each operation id once and keeps authored guides free of that catalog", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const pages = await renderPublicApiReference(contract);
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

  it("fails visibly when the contract is unavailable, malformed, or empty", async () => {
    const empty = pin({ ...minimalDocument(), paths: {} });

    await expect(
      failureCode(() => readAndLoadPublicOpenApiContract(makeRoot()))
    ).resolves.toBe("unavailable");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(Buffer.from("{"), manifestMatching("{"))
      )
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(Buffer.from("[]"), manifestMatching("[]"))
      )
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(empty.specBytes, empty.manifestText)
      )
    ).resolves.toBe("empty");
  });

  it("fails visibly for checksum, version, source, and first-party mismatches", async () => {
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

    await expect(
      failureCode(() => loadPublicOpenApiContract(flipped, valid.manifestText))
    ).resolves.toBe("checksum_mismatch");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongApplicationVersion.specBytes,
          wrongApplicationVersion.manifestText
        )
      )
    ).resolves.toBe("version_mismatch");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongOpenApiVersion.specBytes,
          wrongOpenApiVersion.manifestText
        )
      )
    ).resolves.toBe("version_mismatch");
    await expect(
      failureCode(() =>
        loadPublicOpenApiContract(
          wrongSource.specBytes,
          wrongSource.manifestText
        )
      )
    ).resolves.toBe("source_mismatch");
    await expect(failureCode(() => loadFirstPartyContract())).resolves.toBe(
      "not_public_contract"
    );
  });

  it("renders declared request bodies and refuses a stale generated page", async () => {
    const withBody = pin(documentWithRequestBody());
    const page = operationPage(
      await renderPublicApiReference(
        loadPublicOpenApiContract(withBody.specBytes, withBody.manifestText)
      ),
      "indicators_post"
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
    await syncPublicApiReference({ check: false, root });
    const generated = path.join(root, API_REFERENCE_RELATIVE_DIR);
    const removedPage = path.join(generated, "removed-operation.mdx");
    writeFileSync(
      path.join(generated, "discovery/indicators_post.mdx"),
      "stale catalog\n"
    );
    writeFileSync(removedPage, "old endpoint\n");

    expect(
      missingPhrases(page, [
        "<OpenAPIPage",
        "human_disease_burden",
        "Create is not a public read.",
        "No content.",
      ])
    ).toStrictEqual([]);
    await expect(
      failureCode(
        async () => await syncPublicApiReference({ check: true, root })
      )
    ).resolves.toBe("stale_reference");

    await syncPublicApiReference({ check: false, root });
    expect(
      readFileSync(
        path.join(generated, "discovery/indicators_post.mdx"),
        "utf-8"
      )
    ).toContain("indicators_post");
    expect(existsSync(removedPage)).toBeFalsy();
    await expect(
      failureCode(
        async () => await syncPublicApiReference({ check: true, root })
      )
    ).resolves.toBe("did-not-fail");
  });

  it("renders inline responses and dereferenced reusable component responses", async () => {
    const pinned = pin(documentWithReusableComponents());
    const pages = await renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const indicators = operationPage(pages, "indicators_v1_indicators_get");
    const submitted = operationPage(pages, "indicators_post");

    expect(
      missingPhrases(indicators, [
        "Reusable indicators.",
        "human_disease_burden",
        "#/components/schemas/Indicator",
        "county_fips",
        "08001",
        "Synthetic lower-48 indicator.",
        "Read the indicator again.",
        "Entity tag.",
      ])
    ).toStrictEqual([]);
    expect(
      missingPhrases(submitted, [
        "Inline indicators.",
        "case_count_floor_2023",
        "lower-48",
        "Reusable body.",
      ])
    ).toStrictEqual([]);
  });

  it("fails the reference check for a missing or circular reusable component", async () => {
    await expect(
      failureCode(() => checkDocument(missingResponseRef()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(circularResponseRefs()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(missingParameterRef()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(circularHeaderRefs()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(missingExampleRef()))
    ).resolves.toBe("malformed");
  });

  it("fails the reference check for circular request bodies and examples", async () => {
    await expect(
      failureCode(() => checkDocument(circularRequestBodyRefs()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(circularExampleRefs()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(nonObjectResponseRef()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(missingLinkRef()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(circularLinkRefs()))
    ).resolves.toBe("malformed");
  });

  it("rejects malformed contracts that cannot be rendered", async () => {
    await expect(
      failureCode(() => checkDocument(openapi2Document()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(duplicateOperationIds()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(parameterWithoutName()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(headersNotAnObject()))
    ).resolves.toBe("malformed");
    await expect(
      failureCode(() => checkDocument(externalSchemaRef()))
    ).resolves.toBe("malformed");
  });

  it("renders empty request bodies and colliding schema anchors", async () => {
    const pinned = pin(documentWithCollidingSchemas());
    const pages = await renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );

    expect(
      missingPhrases(operationPage(pages, "indicators_post"), [
        "Bare body.",
        "indicators_post",
      ])
    ).toStrictEqual([]);
    expect(requiredFile(pages, "schemas.mdx")).toContain("[#schema-a-b-2]");
  });

  it("checks the pinned contract from the command line", async () => {
    const registerTsExtension = path.join(
      process.cwd(),
      "scripts/register-ts-extension.mjs"
    );
    const success = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        "--import",
        registerTsExtension,
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
        "--import",
        registerTsExtension,
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

  it("treats a generated page that dropped a dereferenced response body as stale", async () => {
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
    await syncPublicApiReference({ check: false, root });
    const pagePath = path.join(
      root,
      API_REFERENCE_RELATIVE_DIR,
      "discovery/indicators_v1_indicators_get.mdx"
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
    await expect(
      failureCode(
        async () => await syncPublicApiReference({ check: true, root })
      )
    ).resolves.toBe("stale_reference");
  });

  it("renders referenced path items, servers, and security", async () => {
    const pinned = pin(documentWithPathItemReference());
    const pages = await renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const indicators = operationPage(pages, "indicators_v1_indicators_get");
    const health = operationPage(pages, "health_get");
    const measures = operationPage(pages, "measures_get");

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
        "#/components/schemas/Indicator",
      ])
    ).toStrictEqual([]);
    expect(
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

  it("uses path-item security and servers only when the operation omits them", async () => {
    const pinned = pin(documentWithPathItemReference());
    const pages = await renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const measures = operationPage(pages, "measures_get");
    const submitted = operationPage(pages, "measures_post");

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

  it("lets a path-item sibling operation override the referenced operation", async () => {
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
    const page = operationPage(
      await renderPublicApiReference(
        loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
      ),
      "outer_indicators_get"
    );

    expect(page).toContain("outer_indicators_get");
    expect(page).toContain("Outer operation.");
    expect(page.includes("indicators_v1_indicators_get")).toBeFalsy();
  });

  it("treats a dropped path-item operation as a stale reference", async () => {
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
    await syncPublicApiReference({ check: false, root });
    const pagePath = path.join(
      root,
      API_REFERENCE_RELATIVE_DIR,
      "discovery/index.mdx"
    );
    const page = readFileSync(pagePath, "utf-8");

    await expect(
      failureCode(
        async () => await syncPublicApiReference({ check: true, root })
      )
    ).resolves.toBe("did-not-fail");
    expect(page).toContain("indicators_v1_indicators_get");
    expect(page).toContain("health_get");
    writeFileSync(
      pagePath,
      page.replace("indicators_v1_indicators_get", "omitted_operation")
    );
    await expect(
      failureCode(
        async () => await syncPublicApiReference({ check: true, root })
      )
    ).resolves.toBe("stale_reference");
  });

  it("fails the reference check for a bad path item or callback reference", async () => {
    await expect(
      failureText(() => checkDocument(missingPathItemRef()))
    ).resolves.toContain(
      "Unresolved OpenAPI reference #/components/pathItems/Missing"
    );
    await expect(
      failureText(() => checkDocument(circularPathItemRefs()))
    ).resolves.toContain("Circular OpenAPI reference");
    await expect(
      failureText(() => checkDocument(nonObjectPathItemRef()))
    ).resolves.toContain("must point to an object");
    await expect(
      failureText(() => checkDocument(schemaPathItemRef()))
    ).resolves.toContain("must point to components.pathItems");
    await expect(
      failureText(() => checkDocument(documentWithCallbackRef()))
    ).resolves.toContain("callbacks are not rendered");
  });

  it("fails the reference check for webhooks and unresolved server references", async () => {
    await expect(
      failureText(() => checkDocument(documentWithWebhooks()))
    ).resolves.toContain("webhooks are not rendered");
    await expect(
      failureText(() => checkDocument(missingServerRef()))
    ).resolves.toContain(
      "Unresolved OpenAPI reference #/components/servers/Missing"
    );
    await expect(
      failureText(() => checkDocument(circularServerRefs()))
    ).resolves.toContain("Circular OpenAPI reference");
    await expect(
      failureText(() => checkDocument(schemaServerRef()))
    ).resolves.toContain("must point to components.servers");
    await expect(
      failureText(() => checkDocument(securityRequirementRef()))
    ).resolves.toContain("security requirements must be objects");
  });

  it("fails the reference check for security schemes and server shape", async () => {
    await expect(
      failureText(() => checkDocument(missingSecurityScheme()))
    ).resolves.toContain(
      "Unresolved OpenAPI reference #/components/securitySchemes/Missing"
    );
    await expect(
      failureText(() => checkDocument(circularSecuritySchemes()))
    ).resolves.toContain("Circular OpenAPI reference");
    await expect(
      failureText(() => checkDocument(operationServersNotAnArray()))
    ).resolves.toContain("servers must be an array");
    await expect(
      failureText(() => checkDocument(serverMissingUrl()))
    ).resolves.toContain("is missing a url");
    await expect(
      failureText(() => checkDocument(httpServerDocument()))
    ).resolves.toContain(
      "source_mismatch: Public OpenAPI server URL must be HTTPS"
    );
  });

  it("rejects cross-type references instead of rendering them as empty fields", async () => {
    await expect(
      failureText(() => checkDocument(numericResponseRef()))
    ).resolves.toContain("OpenAPI $ref must be a non-empty string");
    await expect(
      failureText(() => checkDocument(schemaExampleRef()))
    ).resolves.toContain(
      "Unsupported OpenAPI reference #/components/schemas/Indicator"
    );
    await expect(
      failureText(() => checkDocument(parameterHeaderRef()))
    ).resolves.toContain(
      "Unsupported OpenAPI reference #/components/parameters/County"
    );
    await expect(
      failureText(() => checkDocument(securityNotAnArray()))
    ).resolves.toContain("security must be an array");
    await expect(
      failureText(() => checkDocument(nonObjectServerRef()))
    ).resolves.toContain("must point to an object");
  });

  it("rejects empty refs, empty server lists, and non-object components", async () => {
    await expect(
      failureText(() => checkDocument(blankServerRef()))
    ).resolves.toContain("OpenAPI $ref must be a non-empty string");
    await expect(
      failureText(() => checkDocument(serverDocument([])))
    ).resolves.toContain("must declare an HTTPS server");
    await expect(
      failureText(() =>
        checkDocument(serverDocument({ url: "https://api.onehealthatlas.org" }))
      )
    ).resolves.toContain("must declare an HTTPS server");
    await expect(
      failureText(() =>
        checkDocument(serverDocument(["https://api.onehealthatlas.org"]))
      )
    ).resolves.toContain("Document server 1 must be an object");
    await expect(
      failureText(() => checkDocument(inlineNonObjectResponse()))
    ).resolves.toContain("response 200 must be an object");
  });

  it("rejects a security scheme reference that is not a security scheme", async () => {
    await expect(
      failureText(() => checkDocument(schemaSecurityScheme()))
    ).resolves.toContain("must point to components.securitySchemes");
  });

  it("inherits document security and renders content parameters and schemaless media", async () => {
    const pinned = pin(documentWithInheritedSecurityAndContent());
    const pages = await renderPublicApiReference(
      loadPublicOpenApiContract(pinned.specBytes, pinned.manifestText)
    );
    const inherited = operationPage(pages, "indicators_v1_indicators_get");
    const published = operationPage(pages, "indicators_post");

    expect(
      missingPhrases(inherited, [
        "X-Atlas-Key",
        "Structured filter.",
        "08001",
        "filter deprecated",
        "filter empty values are allowed",
        "filter style form",
        "filter explode yes",
        "filter reserved characters are allowed",
        "https://onehealthatlas.org/docs",
        "human_disease_burden",
        "text/plain",
        "Seconds before retry.",
        "profile",
        "Profile token.",
        "https://api.onehealthatlas.org",
        "Link server",
        "case_count_floor_2023",
      ])
    ).toStrictEqual([]);
    expect(requiredFile(pages, "discovery/index.mdx")).toContain(
      "https://onehealthatlas.org/docs"
    );
    expect(published.includes("X-Atlas-Key")).toBeFalsy();
    expect(published.includes("case_count_floor_2023")).toBeFalsy();
    expect(published).toContain("[]");
  });

  it("rejects parameters and headers that mix or omit schema and content", async () => {
    await expect(
      failureText(() => checkDocument(parameterSchemaAndContent()))
    ).resolves.toContain("must not declare both schema and content");
    await expect(
      failureText(() => checkDocument(parameterWithoutSchemaOrContent()))
    ).resolves.toContain("must declare schema or content");
    await expect(
      failureText(() => checkDocument(parameterContentWithTwoMediaTypes()))
    ).resolves.toContain("content must contain exactly one media type");
    await expect(
      failureText(() => checkDocument(parameterContentWithExample()))
    ).resolves.toContain("with content must not declare example or examples");
    await expect(
      failureText(() => checkDocument(headerWithoutSchemaOrContent()))
    ).resolves.toContain("must declare schema or content");
  });

  it("rejects external documentation and encoding that cannot be rendered", async () => {
    await expect(
      failureText(() => checkDocument(externalDocsWithoutHttpUrl()))
    ).resolves.toContain("externalDocs url must be an HTTP(S) URL");
    await expect(
      failureText(() => checkDocument(encodingNotAnObject()))
    ).resolves.toContain("encoding must be an object");
  });
});

async function failureCode(
  action: () => unknown
): Promise<PublicOpenApiFailureCode | "did-not-fail"> {
  try {
    await action();
  } catch (error) {
    if (error instanceof PublicOpenApiContractError) return error.code;
    throw new Error("Unexpected public OpenAPI failure.", { cause: error });
  }
  return "did-not-fail";
}

async function failureText(action: () => unknown): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof PublicOpenApiContractError) {
      return `${error.code}: ${error.message}`;
    }
    throw new Error("Unexpected public OpenAPI failure.", { cause: error });
  }
  return "did-not-fail";
}

function operationPage(
  files: Map<string, string>,
  operationId: string
): string {
  const match = [...files.entries()].find(([name]) =>
    name.endsWith(`/${operationId}.mdx`)
  );
  if (!match) {
    throw new TypeError(`Missing generated API reference file ${operationId}.`);
  }
  return match[1];
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

async function checkDocument(document: unknown): Promise<void> {
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
  await syncPublicApiReference({ check: true, root });
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

function documentWithInheritedSecurityAndContent(): Record<string, unknown> {
  const base = minimalDocument();
  return {
    ...base,
    components: {
      ...(base.components as Record<string, unknown>),
      securitySchemes: {
        ApiKey: { in: "header", name: "X-Atlas-Key", type: "apiKey" },
      },
    },
    paths: {
      "/v1/indicators": {
        get: {
          externalDocs: {
            description: "Indicator guide",
            url: "https://onehealthatlas.org/docs",
          },
          operationId: "indicators_v1_indicators_get",
          parameters: [
            {
              allowEmptyValue: true,
              allowReserved: true,
              content: {
                "application/json": {
                  example: { county_fips: "08001" },
                  schema: { type: "object" },
                },
              },
              deprecated: true,
              description: "Structured filter.",
              explode: true,
              in: "query",
              name: "filter",
              required: true,
              style: "form",
            },
          ],
          requestBody: {
            content: {
              "application/json": {
                encoding: {
                  profile: {
                    contentType: "application/json",
                    headers: {
                      "X-Profile": {
                        content: {
                          "text/plain": { example: "profile-token" },
                        },
                        description: "Profile token.",
                      },
                    },
                    style: "form",
                  },
                },
                examples: {
                  sample: {
                    value: { indicator_id: "human_disease_burden" },
                  },
                },
              },
            },
            description: "Examples only.",
            required: true,
          },
          responses: {
            "200": {
              content: {
                "text/plain": { example: "case_count_floor_2023" },
              },
              description: "Illustrated indicators.",
              headers: {
                "Retry-After": {
                  content: {
                    "text/plain": { example: "30" },
                  },
                  description: "Seconds before retry.",
                },
              },
              links: {
                Again: {
                  description: "Read again.",
                  operationId: "indicators_v1_indicators_get",
                  server: {
                    description: "Link server",
                    url: "https://api.onehealthatlas.org",
                  },
                },
              },
            },
          },
          summary: "Referenced indicators",
          tags: ["discovery"],
        },
        post: {
          operationId: "indicators_post",
          responses: { "204": { description: "Public write." } },
          security: [],
          summary: "Submit an indicator",
          tags: ["discovery"],
        },
      },
    },
    security: [{ ApiKey: [] }],
    tags: [
      {
        description: "Discovery.",
        externalDocs: {
          description: "Discovery guide",
          url: "https://onehealthatlas.org/docs",
        },
        name: "discovery",
      },
    ],
  };
}

function parameterOnMinimal(
  parameter: Record<string, unknown>
): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": { get: { parameters?: unknown[] } };
  };
  paths["/v1/indicators"].get.parameters = [parameter];
  return document;
}

function parameterSchemaAndContent(): Record<string, unknown> {
  return parameterOnMinimal({
    content: { "application/json": { schema: { type: "object" } } },
    in: "query",
    name: "filter",
    schema: { type: "string" },
  });
}

function parameterWithoutSchemaOrContent(): Record<string, unknown> {
  return parameterOnMinimal({ in: "query", name: "filter" });
}

function parameterContentWithTwoMediaTypes(): Record<string, unknown> {
  return parameterOnMinimal({
    content: {
      "application/json": { schema: { type: "object" } },
      "text/plain": { schema: { type: "string" } },
    },
    in: "query",
    name: "filter",
  });
}

function parameterContentWithExample(): Record<string, unknown> {
  return parameterOnMinimal({
    content: { "application/json": { schema: { type: "object" } } },
    example: "08001",
    in: "query",
    name: "filter",
  });
}

function headerWithoutSchemaOrContent(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": {
      get: { responses: { "200": { headers?: unknown } } };
    };
  };
  paths["/v1/indicators"].get.responses["200"].headers = {
    "X-Trace": { description: "Trace." },
  };
  return document;
}

function externalDocsWithoutHttpUrl(): Record<string, unknown> {
  return {
    ...minimalDocument(),
    externalDocs: { description: "Mail", url: "mailto:docs@example.com" },
  };
}

function encodingNotAnObject(): Record<string, unknown> {
  const document = minimalDocument();
  const paths = document.paths as {
    "/v1/indicators": {
      get: {
        responses: {
          "200": { content: { "application/json": { encoding?: unknown } } };
        };
      };
    };
  };
  paths["/v1/indicators"].get.responses["200"].content[
    "application/json"
  ].encoding = [];
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

describe("public OpenAPI drift", () => {
  it("reports a checksum mismatch without rewriting the pin", async () => {
    const pinnedSha256 = "a".repeat(64);
    const message = await failureText(() => {
      compareAuthoritativeOpenApiChecksum(
        pinnedSha256,
        Buffer.from("different-document")
      );
    });

    expect(message.startsWith("stale_contract:")).toBeTruthy();
    expect(message).toContain(pinnedSha256);
    expect(message).toContain(
      "This check does not rewrite accepted artifacts."
    );
    expect(
      existsSync(path.join(process.cwd(), PUBLIC_OPENAPI_RELATIVE_PATH))
    ).toBeTruthy();
  });

  it("accepts bytes whose checksum matches the pin", async () => {
    const bytes = Buffer.from("accepted-document");
    const pinnedSha256 = createHash("sha256").update(bytes).digest("hex");

    expect(() => {
      compareAuthoritativeOpenApiChecksum(pinnedSha256, bytes);
    }).not.toThrow();
  });

  it("pins the CDC cumulative filter beside an optional year", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const observations = contract.tags
      .flatMap((tag) => tag.operations)
      .find(
        (operation) =>
          operation.operationId === "observations_v1_observations_get"
      );
    const year = observations?.parameters.find(
      (parameter) => parameter.name === "year"
    );
    const vintageYear = observations?.parameters.find(
      (parameter) => parameter.name === "vintage_year"
    );
    const description = observations?.description ?? "";

    expect({
      burgdorferi: description.includes("burgdorferi_status"),
      cumulative: description.includes("CUMULATIVE"),
      cumulativeDate: year?.description.includes(
        "CDC cumulative status rejects year; use start_date=end_date=2025-12-31."
      ),
      scapularis: description.includes("scapularis_status"),
      vintageYear: vintageYear?.name,
      yearRequired: year?.required,
    }).toStrictEqual({
      burgdorferi: true,
      cumulative: true,
      cumulativeDate: true,
      scapularis: true,
      vintageYear: "vintage_year",
      yearRequired: false,
    });
  });

  it("keeps DAY admissible and records the accepted retrieval", async () => {
    const contract = readAndLoadPublicOpenApiContract(process.cwd());
    const temporalGrain = contract.schemas.Observation;
    const grain = isRecord(temporalGrain)
      ? record(
          isRecord(temporalGrain.properties)
            ? temporalGrain.properties
            : undefined,
          "temporal_grain"
        )
      : undefined;

    expect({
      grainEnum: grain?.enum,
      grainType: grain?.type,
      noRecords: JSON.stringify(contract.schemas.ValueState).includes(
        "NO_RECORDS"
      ),
      sha256: contract.provenance.sha256,
      sourceCommit: contract.provenance.sourceCommit,
    }).toStrictEqual({
      grainEnum: undefined,
      grainType: "string",
      noRecords: true,
      sha256:
        "c0a4e2ea4f15a543c3fc1e7705e2e4691cbc7e3ace9910d159b3814d3c049d6a",
      sourceCommit: "d0472707cfc2badae714a797ec54c83d4f7ad79b",
    });
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const child = value[key];
  return isRecord(child) ? child : undefined;
}
