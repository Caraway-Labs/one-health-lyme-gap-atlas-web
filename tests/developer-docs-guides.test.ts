import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getDocsUrl,
  getPublishedApiOrigin,
  getSiteOrigin,
} from "../src/lib/public-origins";

const docsRoot = path.join(process.cwd(), "content", "docs");
const developRoot = path.join(docsRoot, "develop");

const developPages = [
  "index",
  "quickstart",
  "rest",
  "geography",
  "resources",
  "provenance",
  "workflows",
  "mcp-clients",
  "support",
] as const;

function readPage(slug: string): string {
  return fs.readFileSync(path.join(developRoot, `${slug}.mdx`), "utf-8");
}

const developText = developPages.map((slug) => readPage(slug)).join("\n");

describe("developer documentation guides", () => {
  it("lists the MVP guide order in the developers folder", () => {
    const folderNavigation = JSON.parse(
      fs.readFileSync(path.join(developRoot, "meta.json"), "utf-8")
    ) as { title?: string; pages?: string[] };
    const rootNavigation = JSON.parse(
      fs.readFileSync(path.join(docsRoot, "meta.json"), "utf-8")
    ) as { pages?: string[] };

    expect(folderNavigation.title).toBe("Developers");
    expect(folderNavigation.pages).toStrictEqual([...developPages]);
    expect(rootNavigation.pages).toContain("develop");
  });

  it("gives every guide a title and description", () => {
    const missingFrontmatter = developPages.filter((slug) => {
      const content = readPage(slug);
      return !(
        content.startsWith("---\n") &&
        /^title:\s+\S.+$/m.test(content) &&
        /^description:\s+\S.+$/m.test(content)
      );
    });

    expect(missingFrontmatter).toStrictEqual([]);
  });

  it("keeps public reads anonymous and inside the published contract", () => {
    const requiredPhrases = [
      "https://api.onehealthatlas.org",
      "https://api.onehealthatlas.org/openapi.json",
      "/docs/api-reference",
      "case_count_floor_2023",
      "geography_id=36061",
      "RATE_LIMITED",
      "Retry-After",
      "RESOURCE_NOT_FOUND",
      "UNSUPPORTED_FILTER",
      "UNSUPPORTED_STRATIFICATION",
      "QUERY_TOO_BROAD",
      "CANONICAL_DATA_UNAVAILABLE",
      "environmental_context",
      "no API key",
      "OBSERVED",
      "ZERO",
      "MISSING",
      "SUPPRESSED",
      "UNAVAILABLE",
      "NO_COUNTY_LINKED_RECORD",
      "NO_RECORDS",
      "413",
      "414",
      "surveillance_context",
      "10,000",
      "not truncation",
      "county-v1",
      "county-v2",
      "Observation context requires county-v2.",
      "county-v2 requires release, exact period and distinct measures.",
      "The requested county report template is not available.",
      "Cache-Control: public, max-age=300, must-revalidate",
      "Cache-Control: no-store",
      "lower 48 states",
      "District of Columbia",
      getPublishedApiOrigin({}),
      getDocsUrl({}),
      `${getSiteOrigin({})}/problems/http-422`,
    ];
    const missingPhrases = requiredPhrases.filter(
      (phrase) => !developText.includes(phrase)
    );

    const referenceLinks = [
      "](/docs/api-reference)",
      "](/docs/api-reference/discovery)",
      "](/docs/api-reference/observations)",
      "](/docs/api-reference/provenance)",
      "](/docs/api-reference/geographies)",
      "](/docs/api-reference/atlas)",
      "](/docs/api-reference/counties)",
      "](/docs/api-reference/states)",
      "](/docs/api-reference/schemas)",
    ];
    const missingLinks = referenceLinks.filter(
      (link) => !developText.includes(link)
    );

    expect(missingPhrases).toStrictEqual([]);
    expect(missingLinks).toStrictEqual([]);
    expect(developText).not.toContain("`/docs/api-reference");
  });

  it("does not invent credentials, SDKs, or out-of-scope states", () => {
    const violations = [
      developText.match(/Alaska|Hawaii/)?.[0],
      developText.match(/\b(?<postal>AK|HI)\b/)?.[0],
      developText.includes("60 requests") ? "60 requests" : undefined,
      developText.match(/Bearer |API token|install the SDK/i)?.[0],
      developText.includes("npm install") ? "npm install" : undefined,
      developText.includes("contracts/openapi.json")
        ? "contracts/openapi.json"
        : undefined,
    ].filter((violation) => violation !== undefined);

    expect(violations).toStrictEqual([]);
  });
});

type JsonRecord = Record<string, unknown>;

interface ContractVocabulary {
  codes: Set<string>;
  enums: Set<string>;
  exampleIdentifiers: Set<string>;
  headers: Set<string>;
  mediaTypes: Set<string>;
  parameters: Set<string>;
  paths: Set<string>;
  properties: Set<string>;
  schemaNames: Set<string>;
  serialized: string;
  statuses: Set<string>;
}

const headerLiterals = [
  "Cache-Control",
  "ETag",
  "If-None-Match",
  "Retry-After",
] as const;

const liveObservedIdentifiers = new Set([
  "YEAR",
  "aggregation",
  "fraction",
  "human",
  "human_confirmed_probable_case_floor_v1",
  "human_disease_burden",
  "land_cover_context",
  "nlcd_forest_area_share_county_year",
  "sort",
  "tract",
  "county-v1",
  "county-v2",
]);

const referenceSlugs = new Set([
  "atlas",
  "counties",
  "discovery",
  "geographies",
  "observations",
  "provenance",
  "schemas",
  "states",
]);

const cacheDirective = "Cache-Control: public, max-age=60, must-revalidate";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

const publicContractPath = path.join(
  process.cwd(),
  "contracts",
  "public-openapi.json"
);

function readContract(): JsonRecord {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(publicContractPath, "utf-8")
  );
  if (!isRecord(parsed)) {
    throw new Error("Public OpenAPI contract must be an object");
  }
  return parsed;
}

function schemaPropertyNames(spec: JsonRecord, schemaName: string): string[] {
  const components = isRecord(spec.components) ? spec.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const schema = schemas[schemaName];
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    return [];
  }
  return Object.keys(schema.properties);
}

function walkSchema(node: unknown, vocab: ContractVocabulary): void {
  if (!isRecord(node)) {
    return;
  }
  collectCodesFromText(node.description, vocab);
  for (const enumValue of stringArray(node.enum)) {
    vocab.enums.add(enumValue);
  }
  if (isRecord(node.properties)) {
    for (const [propertyName, propertySchema] of Object.entries(
      node.properties
    )) {
      vocab.properties.add(propertyName);
      walkSchema(propertySchema, vocab);
    }
  }
  walkSchema(node.items, vocab);
  walkSchema(node.additionalProperties, vocab);
  for (const combiner of ["allOf", "anyOf", "oneOf"] as const) {
    const branches = node[combiner];
    if (Array.isArray(branches)) {
      for (const branch of branches) {
        walkSchema(branch, vocab);
      }
    }
  }
}

function collectCodesFromText(value: unknown, vocab: ContractVocabulary): void {
  if (typeof value !== "string") {
    return;
  }
  for (const match of value.matchAll(/\b(?<code>[A-Z][A-Z0-9_]{2,})\b/gu)) {
    const code = match.groups?.code;
    if (code) {
      vocab.codes.add(code);
    }
  }
  for (const match of value.matchAll(
    /\b(?<literal>[a-z][a-z0-9]*_[a-z0-9_]*)\b/gu
  )) {
    const literal = match.groups?.literal;
    if (literal) {
      vocab.exampleIdentifiers.add(literal);
    }
  }
}

function collectExample(value: unknown, vocab: ContractVocabulary): void {
  if (typeof value === "string" && /^[a-z][a-z0-9_]*$/u.test(value)) {
    vocab.exampleIdentifiers.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      collectExample(child, vocab);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (typeof value.code === "string" && typeof value.request_id === "string") {
    vocab.codes.add(value.code);
  }
  for (const child of Object.values(value)) {
    collectExample(child, vocab);
  }
}

function walkParameter(parameter: unknown, vocab: ContractVocabulary): void {
  if (!isRecord(parameter) || typeof parameter.name !== "string") {
    return;
  }
  vocab.parameters.add(parameter.name);
  if (parameter.in === "header") {
    vocab.headers.add(parameter.name);
  }
  walkSchema(parameter.schema, vocab);
}

function walkMedia(media: unknown, vocab: ContractVocabulary): void {
  if (!isRecord(media)) {
    return;
  }
  walkSchema(media.schema, vocab);
  if (!isRecord(media.examples)) {
    return;
  }
  for (const example of Object.values(media.examples)) {
    if (isRecord(example)) {
      collectExample(example.value, vocab);
    }
  }
}

function walkResponse(response: unknown, vocab: ContractVocabulary): void {
  if (!isRecord(response)) {
    return;
  }
  collectCodesFromText(response.description, vocab);
  if (isRecord(response.headers)) {
    for (const headerName of Object.keys(response.headers)) {
      vocab.headers.add(headerName);
    }
  }
  if (!isRecord(response.content)) {
    return;
  }
  for (const [mediaType, media] of Object.entries(response.content)) {
    vocab.mediaTypes.add(mediaType);
    walkMedia(media, vocab);
  }
}

function walkOperation(operation: unknown, vocab: ContractVocabulary): void {
  if (!isRecord(operation)) {
    return;
  }
  collectCodesFromText(operation.description, vocab);
  if (Array.isArray(operation.parameters)) {
    for (const parameter of operation.parameters) {
      walkParameter(parameter, vocab);
    }
  }
  if (!isRecord(operation.responses)) {
    return;
  }
  for (const [status, response] of Object.entries(operation.responses)) {
    vocab.statuses.add(status);
    walkResponse(response, vocab);
  }
}

function collectVocabulary(spec: JsonRecord): ContractVocabulary {
  const vocab: ContractVocabulary = {
    codes: new Set(),
    enums: new Set(),
    exampleIdentifiers: new Set(),
    headers: new Set(),
    mediaTypes: new Set(),
    parameters: new Set(),
    paths: new Set(),
    properties: new Set(),
    schemaNames: new Set(),
    serialized: JSON.stringify(spec),
    statuses: new Set(),
  };
  const components = isRecord(spec.components) ? spec.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  for (const [name, schema] of Object.entries(schemas)) {
    vocab.schemaNames.add(name);
    walkSchema(schema, vocab);
  }
  const paths = isRecord(spec.paths) ? spec.paths : {};
  for (const [route, pathItem] of Object.entries(paths)) {
    vocab.paths.add(route);
    if (!isRecord(pathItem)) {
      continue;
    }
    if (Array.isArray(pathItem.parameters)) {
      for (const parameter of pathItem.parameters) {
        walkParameter(parameter, vocab);
      }
    }
    for (const operation of Object.values(pathItem)) {
      walkOperation(operation, vocab);
    }
  }
  for (const header of headerLiterals) {
    if (vocab.serialized.includes(header)) {
      vocab.headers.add(header);
    }
  }
  return vocab;
}

function schemaEnum(
  spec: JsonRecord,
  schemaName: string,
  propertyName?: string
): string[] {
  const components = isRecord(spec.components) ? spec.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const schema = schemas[schemaName];
  if (!isRecord(schema)) {
    return [];
  }
  if (!propertyName) {
    return stringArray(schema.enum);
  }
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const property = properties[propertyName];
  return isRecord(property) ? stringArray(property.enum) : [];
}

function responseStatuses(spec: JsonRecord, route: string): string[] {
  const paths = isRecord(spec.paths) ? spec.paths : {};
  const pathItem = paths[route];
  if (
    !isRecord(pathItem) ||
    !isRecord(pathItem.get) ||
    !isRecord(pathItem.get.responses)
  ) {
    return [];
  }
  return Object.keys(pathItem.get.responses);
}

function documentedValueStates(resources: string): string[] {
  const section =
    resources.split("## Read value_state")[1]?.split("\n## ")[0] ?? "";
  const states: string[] = [];
  for (const match of section.matchAll(/^\| `(?<state>[A-Z_]+)` \|/gm)) {
    const state = match.groups?.state;
    if (state) {
      states.push(state);
    }
  }
  return states;
}

function errorTableProblems(rest: string, spec: JsonRecord): string[] {
  const section = rest.split("## Errors")[1]?.split("\n## ")[0] ?? "";
  const rows: { code: string; status: string }[] = [];
  for (const match of section.matchAll(
    /^\| (?<status>\d{3}) \| (?<code>[^|\n]+) \|/gm
  )) {
    const status = match.groups?.status;
    const code = match.groups?.code?.trim();
    if (status && code) {
      rows.push({ code, status });
    }
  }
  const expected = [
    ["400", "`INVALID_REQUEST`"],
    ["400", "`UNSUPPORTED_FILTER`"],
    ["400", "`UNSUPPORTED_STRATIFICATION`"],
    ["400", "`QUERY_TOO_BROAD`"],
    ["404", "`RESOURCE_NOT_FOUND`"],
    ["413", "`INVALID_REQUEST`"],
    ["414", "`INVALID_REQUEST`"],
    ["429", "`RATE_LIMITED`"],
  ] as const;
  const problems = expected
    .filter(
      ([status, code]) =>
        !rows.some((row) => row.status === status && row.code === code)
    )
    .map(([status, code]) => `missing ${status} ${code}`);
  const serviceUnavailable = rows.find((row) => row.status === "503");
  if (!serviceUnavailable?.code.includes("`CANONICAL_DATA_UNAVAILABLE`")) {
    problems.push("503 row must name CANONICAL_DATA_UNAVAILABLE");
  }
  for (const line of section.split("\n")) {
    if (
      line.startsWith("| 400 | `INVALID_REQUEST` |") &&
      /413|414/u.test(line)
    ) {
      problems.push("400 INVALID_REQUEST row mentions 413 or 414");
    }
  }
  const observationStatuses = responseStatuses(spec, "/v1/observations");
  for (const status of ["200", "400", "404", "413", "414", "429", "503"]) {
    if (!observationStatuses.includes(status)) {
      problems.push(`observations operation is missing HTTP ${status}`);
    }
  }
  return problems;
}

function identifierKnown(token: string, vocab: ContractVocabulary): boolean {
  return (
    vocab.enums.has(token) ||
    vocab.codes.has(token) ||
    vocab.properties.has(token) ||
    vocab.parameters.has(token) ||
    vocab.schemaNames.has(token) ||
    vocab.exampleIdentifiers.has(token) ||
    vocab.headers.has(token) ||
    liveObservedIdentifiers.has(token) ||
    referenceSlugs.has(token) ||
    token === "null" ||
    token === "content-type"
  );
}

function operationKnown(token: string, vocab: ContractVocabulary): boolean {
  const route = token.replace(/^(?:GET|POST) /u, "").split("?")[0] ?? "";
  if (route === "/v1") {
    return true;
  }
  if (vocab.paths.has(route)) {
    return true;
  }
  const actualSegments = route
    .split("/")
    .filter((segment) => segment.length > 0);
  for (const template of vocab.paths) {
    const templateSegments = template
      .split("/")
      .filter((segment) => segment.length > 0);
    if (templateSegments.length !== actualSegments.length) {
      continue;
    }
    const matches = templateSegments.every(
      (segment, index) =>
        segment.startsWith("{") || segment === actualSegments[index]
    );
    if (matches) {
      return true;
    }
  }
  return false;
}

function queryKnown(token: string, vocab: ContractVocabulary): boolean {
  const query = token.split("?")[1];
  if (!query) {
    return true;
  }
  return query.split("&").every((pair) => {
    const name = pair.split("=")[0] ?? "";
    return vocab.parameters.has(name);
  });
}

function compoundKnown(token: string, vocab: ContractVocabulary): boolean {
  if (token === "info.version" || token.endsWith(".json")) {
    return true;
  }
  if (token.includes("=")) {
    const [name, rawValue] = token.split("=");
    if (
      !(
        name &&
        (vocab.parameters.has(name) || liveObservedIdentifiers.has(name))
      )
    ) {
      return false;
    }
    if (
      !rawValue ||
      /^\d+$/u.test(rawValue) ||
      liveObservedIdentifiers.has(name)
    ) {
      return true;
    }
    return identifierKnown(rawValue, vocab);
  }
  if (token.includes(".")) {
    return token.split(".").every((part) => identifierKnown(part, vocab));
  }
  return false;
}

function tokenProblem(
  token: string,
  page: string,
  vocab: ContractVocabulary
): string | undefined {
  if (token === cacheDirective) {
    return vocab.serialized.includes(token)
      ? undefined
      : `${page}: cache directive is not in the contract`;
  }
  if (
    token.startsWith("http://") ||
    token.startsWith("https://") ||
    token.startsWith("/docs")
  ) {
    return undefined;
  }
  if (
    token === "/v1" ||
    token.startsWith("/v1/") ||
    token.startsWith("GET ") ||
    token.startsWith("POST ")
  ) {
    return operationKnown(token, vocab) && queryKnown(token, vocab)
      ? undefined
      : `${page}: unknown operation ${token}`;
  }
  if (
    token.includes(" ") ||
    token.startsWith("-") ||
    token === "[]" ||
    token.startsWith("curl")
  ) {
    return undefined;
  }
  if (/^\d+$/u.test(token)) {
    if (token.length !== 3) {
      return undefined;
    }
    return vocab.statuses.has(token) ||
      (token === "504" && page === "geography")
      ? undefined
      : `${page}: HTTP ${token} is not a contract status`;
  }
  if (token.includes("/") && !token.startsWith("/")) {
    return vocab.mediaTypes.has(token)
      ? undefined
      : `${page}: unknown media type ${token}`;
  }
  if (token.includes(".") || token.includes("=")) {
    return compoundKnown(token, vocab)
      ? undefined
      : `${page}: unknown field ${token}`;
  }
  if (/^[A-Za-z][A-Za-z0-9_-]*$/u.test(token)) {
    return identifierKnown(token, vocab)
      ? undefined
      : `${page}: unknown identifier ${token}`;
  }
  return `${page}: unclassified token ${token}`;
}

function contractMismatches(
  spec: JsonRecord,
  vocab: ContractVocabulary
): string[] {
  const mismatches: string[] = [];
  if (!vocab.serialized.includes(cacheDirective)) {
    mismatches.push("contract is missing the documented cache directive");
  }
  if (!vocab.mediaTypes.has("application/problem+json")) {
    mismatches.push("contract is missing application/problem+json");
  }
  for (const status of schemaEnum(
    spec,
    "EnvironmentalContext",
    "coverage_status"
  )) {
    if (!readPage("workflows").includes(`\`${status}\``)) {
      mismatches.push(`workflows omit coverage status ${status}`);
    }
  }
  for (const page of developPages) {
    // MCP recipes cite the production Streamable HTTP transport, not OpenAPI operations.
    if (page === "mcp-clients") {
      continue;
    }
    if (page !== "geography" && readPage(page).includes("`504`")) {
      mismatches.push(
        `${page}: 504 is only the observed geography client status`
      );
    }
    for (const match of readPage(page).matchAll(/`(?<token>[^`\n]+)`/gu)) {
      const token = match.groups?.token;
      if (!token) {
        continue;
      }
      const problem = tokenProblem(token, page, vocab);
      if (problem) {
        mismatches.push(problem);
      }
    }
  }
  return mismatches;
}

describe("developer guides follow the pinned public OpenAPI contract", () => {
  const spec = readContract();
  const vocab = collectVocabulary(spec);

  it("documents the public contract value states in enum order", () => {
    expect(documentedValueStates(readPage("resources"))).toStrictEqual(
      schemaEnum(spec, "ValueState")
    );
  });

  it("lists 413 and 414 apart from HTTP 400", () => {
    expect(errorTableProblems(readPage("rest"), spec)).toStrictEqual([]);
  });

  it("uses only public-contract enums, statuses, codes, headers, and fields", () => {
    expect(contractMismatches(spec, vocab)).toStrictEqual([]);
  });

  it("documents the public result ceiling and surveillance context", () => {
    const info = isRecord(spec.info) ? spec.info : {};
    const description =
      typeof info.description === "string" ? info.description : "";
    const servers = Array.isArray(spec.servers) ? spec.servers : [];
    const server = isRecord(servers[0]) ? servers[0] : {};
    expect({
      clientArtifactDisclaimer: description.includes(
        "Not an external developer contract"
      ),
      ceiling: description.includes(
        "The default pre-execution logical-result ceiling is 10,000, not truncation."
      ),
      guidesCeiling:
        developText.includes("10,000") &&
        developText.includes("not truncation"),
      surveillanceProperty: schemaPropertyNames(spec, "Observation").includes(
        "surveillance_context"
      ),
      guidesSurveillance: developText.includes("`surveillance_context`"),
      server: server.url,
    }).toStrictEqual({
      clientArtifactDisclaimer: false,
      ceiling: true,
      guidesCeiling: true,
      surveillanceProperty: true,
      guidesSurveillance: true,
      server: "https://api.onehealthatlas.org",
    });
  });
});
