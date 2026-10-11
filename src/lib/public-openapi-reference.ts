import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

/**
 * Build-time rendering of the public Atlas OpenAPI contract.
 *
 * The pinned file is the public projection from the API repository, not
 * `contracts/openapi.json` (the unserved first-party Web generator input).
 * Pages are regenerated from that pin. A missing, malformed, empty, or
 * mismatched contract fails the build instead of leaving the previous pages
 * in place as a silent reference.
 */

export const PUBLIC_OPENAPI_RELATIVE_PATH = "contracts/public-openapi.json";
export const PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH =
  "contracts/public-openapi.manifest.json";
export const API_REFERENCE_RELATIVE_DIR = "content/docs/api-reference";

const SOURCE_REPOSITORY = "Caraway-Labs/one-health-lyme-gap-atlas-api";
const SOURCE_PATH = "openapi.json";
const FIRST_PARTY_MARKER = "Not an external developer contract";
const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export type PublicOpenApiFailureCode =
  | "unavailable"
  | "malformed"
  | "empty"
  | "checksum_mismatch"
  | "version_mismatch"
  | "source_mismatch"
  | "not_public_contract"
  | "stale_reference";

export class PublicOpenApiContractError extends Error {
  readonly code: PublicOpenApiFailureCode;

  constructor(code: PublicOpenApiFailureCode, message: string) {
    super(message);
    this.name = "PublicOpenApiContractError";
    this.code = code;
  }
}

export type PublicOpenApiProvenance = {
  applicationVersion: string;
  httpContract: string;
  openapiVersion: string;
  sha256: string;
  sourceCommit: string;
  sourcePath: string;
  sourceRepository: string;
  sourceUrl: string;
};

type JsonRecord = Record<string, unknown>;

type ParameterView = {
  description: string;
  examples: ExampleView[];
  location: string;
  name: string;
  required: boolean;
  schema: unknown;
};

type ExampleView = {
  description?: string;
  name?: string;
  summary?: string;
  value: unknown;
};

type MediaView = {
  examples: ExampleView[];
  mediaType: string;
  schema: unknown;
};

type ResponseView = {
  description: string;
  media: MediaView[];
  status: string;
};

type OperationView = {
  deprecated: boolean;
  description: string;
  method: string;
  operationId: string;
  parameters: ParameterView[];
  path: string;
  requestBody: MediaView[] | undefined;
  requestBodyDescription: string;
  requestBodyRequired: boolean;
  responses: ResponseView[];
  security: unknown;
  summary: string;
  tags: string[];
};

type TagView = {
  description: string;
  name: string;
  operations: OperationView[];
  slug: string;
};

export type LoadedPublicOpenApiContract = {
  description: string;
  document: JsonRecord;
  provenance: PublicOpenApiProvenance;
  schemas: JsonRecord;
  servers: { description: string; url: string }[];
  summary: string;
  tags: TagView[];
  title: string;
};

type Manifest = {
  infoVersion: string;
  openapi: string;
  sha256: string;
  sourceCommit: string;
  sourcePath: string;
  sourceRepository: string;
  sourceUrl: string;
};

export function loadPublicOpenApiContract(
  specBytes: Uint8Array,
  manifestText: string
): LoadedPublicOpenApiContract {
  const manifest = parseManifest(manifestText);
  const actualSha256 = createHash("sha256").update(specBytes).digest("hex");
  if (actualSha256 !== manifest.sha256) {
    throw new PublicOpenApiContractError(
      "checksum_mismatch",
      `Pinned public OpenAPI checksum ${actualSha256} does not match manifest ${manifest.sha256}.`
    );
  }

  const document = parseDocument(specBytes);
  const info = asRecord(document.info, "info");
  if (text(info, "description").includes(FIRST_PARTY_MARKER)) {
    throw new PublicOpenApiContractError(
      "not_public_contract",
      "The first-party Web generator contract cannot be rendered as the public API reference."
    );
  }

  const openapiVersion = requiredString(document, "openapi", "openapi");
  if (!openapiVersion.startsWith("3.")) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Public OpenAPI contract must be OpenAPI 3.x. Received ${openapiVersion}.`
    );
  }
  if (openapiVersion !== manifest.openapi) {
    throw new PublicOpenApiContractError(
      "version_mismatch",
      `OpenAPI version ${openapiVersion} does not match pinned version ${manifest.openapi}.`
    );
  }

  const applicationVersion = requiredString(info, "version", "info.version");
  if (applicationVersion !== manifest.infoVersion) {
    throw new PublicOpenApiContractError(
      "version_mismatch",
      `Application version ${applicationVersion} does not match pinned version ${manifest.infoVersion}.`
    );
  }

  const sourceUrl = rawSpecUrl(document.servers);
  if (sourceUrl !== manifest.sourceUrl) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      `Spec server raw URL ${sourceUrl} does not match pinned source ${manifest.sourceUrl}.`
    );
  }

  assertRefsResolve(document, document);
  const tags = buildTags(document);
  if (tags.every((tag) => tag.operations.length === 0)) {
    throw new PublicOpenApiContractError(
      "empty",
      "Public OpenAPI contract does not declare any operations."
    );
  }

  const operationIds = tags.flatMap((tag) =>
    tag.operations.map((operation) => operation.operationId)
  );
  if (new Set(operationIds).size !== operationIds.length) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI operation IDs must be unique."
    );
  }

  return {
    description: text(info, "description"),
    document,
    provenance: {
      applicationVersion,
      httpContract: httpContractLabel(
        tags.flatMap((tag) => tag.operations.map((operation) => operation.path))
      ),
      openapiVersion,
      sha256: actualSha256,
      sourceCommit: manifest.sourceCommit,
      sourcePath: manifest.sourcePath,
      sourceRepository: manifest.sourceRepository,
      sourceUrl,
    },
    schemas:
      record(
        isRecord(document.components) ? document.components : undefined,
        "schemas"
      ) ?? {},
    servers: serversFrom(document.servers),
    summary: text(info, "summary"),
    tags,
    title: requiredString(info, "title", "info.title"),
  };
}

export function renderPublicApiReference(
  contract: LoadedPublicOpenApiContract
): Map<string, string> {
  const schemaAnchors = schemaAnchorMap(contract.schemas);
  const files = new Map<string, string>();
  const pages = ["index"];

  files.set("index.mdx", renderIndex(contract, schemaAnchors));
  for (const tag of contract.tags) {
    pages.push(tag.slug);
    files.set(`${tag.slug}.mdx`, renderTagPage(tag, schemaAnchors));
  }
  pages.push("schemas");
  files.set("schemas.mdx", renderSchemaPage(contract.schemas, schemaAnchors));
  files.set(
    "meta.json",
    `${JSON.stringify({ title: "API reference", pages }, null, 2)}\n`
  );
  return files;
}

export function readAndLoadPublicOpenApiContract(
  root: string
): LoadedPublicOpenApiContract {
  const specPath = path.join(root, PUBLIC_OPENAPI_RELATIVE_PATH);
  const manifestPath = path.join(root, PUBLIC_OPENAPI_MANIFEST_RELATIVE_PATH);
  let specBytes: Buffer;
  let manifestText: string;
  try {
    specBytes = readFileSync(specPath);
    manifestText = readFileSync(manifestPath, "utf-8");
  } catch (error) {
    const code = nodeCode(error);
    if (code === "ENOENT") {
      throw new PublicOpenApiContractError(
        "unavailable",
        "Pinned public OpenAPI contract is unavailable. Expected contracts/public-openapi.json and contracts/public-openapi.manifest.json."
      );
    }
    throw error;
  }
  return loadPublicOpenApiContract(specBytes, manifestText);
}

export function syncPublicApiReference(options: {
  check: boolean;
  root: string;
}): void {
  const contract = readAndLoadPublicOpenApiContract(options.root);
  const expected = renderPublicApiReference(contract);
  const directory = path.join(options.root, API_REFERENCE_RELATIVE_DIR);
  const actual = readGeneratedFiles(directory);

  if (options.check) {
    const differences = compareGeneratedFiles(expected, actual);
    if (differences.length > 0) {
      throw new PublicOpenApiContractError(
        "stale_reference",
        `Generated API reference does not match the pinned public contract (${differences.join(", ")}). Run npm run docs:api.`
      );
    }
    return;
  }

  mkdirSync(directory, { recursive: true });
  for (const [relativePath, contents] of expected) {
    const filePath = path.join(directory, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }
  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath)) {
      rmSync(path.join(directory, relativePath));
    }
  }
}

function parseManifest(manifestText: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifestText);
  } catch {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI manifest is not valid JSON."
    );
  }
  if (!isRecord(parsed)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI manifest must be an object."
    );
  }

  const sourceRepository = requiredString(
    parsed,
    "sourceRepository",
    "manifest.sourceRepository"
  );
  const sourceCommit = requiredString(
    parsed,
    "sourceCommit",
    "manifest.sourceCommit"
  );
  const sourcePath = requiredString(
    parsed,
    "sourcePath",
    "manifest.sourcePath"
  );
  const sourceUrl = requiredString(parsed, "sourceUrl", "manifest.sourceUrl");
  const sha256 = requiredString(parsed, "sha256", "manifest.sha256");
  const openapi = requiredString(parsed, "openapi", "manifest.openapi");
  const infoVersion = requiredString(
    parsed,
    "infoVersion",
    "manifest.infoVersion"
  );

  if (
    sourceRepository !== SOURCE_REPOSITORY ||
    sourcePath !== SOURCE_PATH ||
    !/^[0-9a-f]{40}$/.test(sourceCommit) ||
    !/^https:\/\/[^/\s]+\/openapi\.json$/.test(sourceUrl)
  ) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      "Public OpenAPI manifest source must identify the API repository openapi.json commit and an HTTPS /openapi.json URL."
    );
  }
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI manifest checksum must be a lowercase SHA-256 hex digest."
    );
  }

  return {
    infoVersion,
    openapi,
    sha256,
    sourceCommit,
    sourcePath,
    sourceRepository,
    sourceUrl,
  };
}

function parseDocument(specBytes: Uint8Array): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(specBytes).toString("utf-8"));
  } catch {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI contract is not valid JSON."
    );
  }
  if (!isRecord(parsed)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI contract must be an object."
    );
  }
  asRecord(parsed.info, "info");
  asRecord(parsed.paths, "paths");
  if (typeof parsed.openapi !== "string") {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI contract is missing openapi."
    );
  }
  return parsed;
}

function buildTags(document: JsonRecord): TagView[] {
  const paths = asRecord(document.paths, "paths");
  const declared = Array.isArray(document.tags) ? document.tags : [];
  const descriptions = new Map<string, string>();
  const order: string[] = [];
  for (const tag of declared) {
    if (!isRecord(tag) || typeof tag.name !== "string" || tag.name === "") {
      throw new PublicOpenApiContractError(
        "malformed",
        "Public OpenAPI tags must have a name."
      );
    }
    if (!order.includes(tag.name)) order.push(tag.name);
    descriptions.set(tag.name, text(tag, "description"));
  }

  const grouped = new Map<string, OperationView[]>();
  for (const tagName of order) grouped.set(tagName, []);

  for (const [route, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Path ${route} must be an object.`
      );
    }
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      if (!isRecord(operation)) {
        throw new PublicOpenApiContractError(
          "malformed",
          `${method.toUpperCase()} ${route} must be an object.`
        );
      }
      const view = buildOperation(route, method, operation, pathItem);
      const tagName = view.tags[0] ?? "untagged";
      if (!grouped.has(tagName)) {
        grouped.set(tagName, []);
        order.push(tagName);
      }
      grouped.get(tagName)?.push(view);
    }
  }

  const usedSlugs = new Set<string>();
  return order
    .filter((name) => (grouped.get(name)?.length ?? 0) > 0)
    .map((name) => {
      let slug = slugify(name, "tag");
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${slugify(name, "tag")}-${suffix}`;
        suffix += 1;
      }
      usedSlugs.add(slug);
      return {
        description: descriptions.get(name) ?? "",
        name,
        operations: grouped.get(name) ?? [],
        slug,
      };
    });
}

function buildOperation(
  route: string,
  method: string,
  operation: JsonRecord,
  pathItem: JsonRecord
): OperationView {
  const operationId = text(operation, "operationId");
  if (!/^[A-Za-z0-9_.-]+$/.test(operationId)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${method.toUpperCase()} ${route} is missing a stable operationId.`
    );
  }
  const responses = buildResponses(operation.responses, operationId);
  const tags = stringList(operation.tags);
  return {
    deprecated: operation.deprecated === true,
    description: text(operation, "description"),
    method: method.toUpperCase(),
    operationId,
    parameters: mergeParameters(pathItem.parameters, operation.parameters),
    path: route,
    requestBody: buildRequestBody(operation.requestBody),
    requestBodyDescription: isRecord(operation.requestBody)
      ? text(operation.requestBody, "description")
      : "",
    requestBodyRequired:
      isRecord(operation.requestBody) &&
      operation.requestBody.required === true,
    responses,
    security: operation.security,
    summary: text(operation, "summary") || operationId,
    tags,
  };
}

function buildResponses(value: unknown, operationId: string): ResponseView[] {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Operation ${operationId} does not declare responses.`
    );
  }
  return Object.entries(value).map(([status, response]) => {
    if (!isRecord(response)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Operation ${operationId} response ${status} must be an object.`
      );
    }
    return {
      description: text(response, "description"),
      media: mediaViews(response.content),
      status,
    };
  });
}

function buildRequestBody(value: unknown): MediaView[] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Request body must be an object."
    );
  }
  return mediaViews(value.content);
}

function mediaViews(value: unknown): MediaView[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Response content must be an object."
    );
  }
  return Object.entries(value).map(([mediaType, media]) => {
    if (!isRecord(media)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Media type ${mediaType} must be an object.`
      );
    }
    return {
      examples: collectExamples(media),
      mediaType,
      schema: media.schema,
    };
  });
}

function mergeParameters(
  pathParameters: unknown,
  operationParameters: unknown
): ParameterView[] {
  const merged = new Map<string, ParameterView>();
  for (const parameter of parameterList(pathParameters)) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  for (const parameter of parameterList(operationParameters)) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  return [...merged.values()];
}

function parameterList(value: unknown): ParameterView[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "OpenAPI parameters must be an array."
    );
  }
  return value.map((parameter) => {
    if (!isRecord(parameter)) {
      throw new PublicOpenApiContractError(
        "malformed",
        "Each OpenAPI parameter must be an object."
      );
    }
    const name = text(parameter, "name");
    const location = text(parameter, "in");
    if (!name || !location) {
      throw new PublicOpenApiContractError(
        "malformed",
        "Each OpenAPI parameter needs a name and location."
      );
    }
    const schema = isRecord(parameter.schema) ? parameter.schema : undefined;
    return {
      description:
        text(parameter, "description") || text(schema, "description"),
      examples: [...collectExamples(parameter), ...collectExamples(schema)],
      location,
      name,
      required: parameter.required === true,
      schema: parameter.schema,
    };
  });
}

function collectExamples(source: JsonRecord | undefined): ExampleView[] {
  if (!source) return [];
  const examples: ExampleView[] = [];
  if ("example" in source) examples.push({ value: source.example });
  const named = source.examples;
  if (Array.isArray(named)) {
    for (const value of named) examples.push({ value });
  } else if (isRecord(named)) {
    for (const [name, entry] of Object.entries(named)) {
      if (isRecord(entry) && "value" in entry) {
        examples.push({
          description: optionalText(entry, "description"),
          name,
          summary: optionalText(entry, "summary"),
          value: entry.value,
        });
      } else {
        examples.push({ name, value: entry });
      }
    }
  }
  return examples;
}

function renderIndex(
  contract: LoadedPublicOpenApiContract,
  schemaAnchors: Map<string, string>
): string {
  const provenance = contract.provenance;
  const lines = [
    frontmatter(
      "API reference",
      "Generated from the pinned public Atlas OpenAPI contract, with spec version, source, and the raw schema."
    ),
    "This page is generated from the public OpenAPI contract. It is not a second hand-maintained endpoint catalog. Tags, operation IDs, parameters, schemas, examples, and errors below come from that contract.",
    "",
    "## Spec version and source",
    "",
    "| Label | Value |",
    "| --- | --- |",
    `| OpenAPI version | \`${escapeCell(provenance.openapiVersion)}\` |`,
    `| Application version | \`${escapeCell(provenance.applicationVersion)}\` |`,
    `| HTTP contract | \`${escapeCell(provenance.httpContract)}\` |`,
    `| Source repository | \`${escapeCell(provenance.sourceRepository)}\` |`,
    `| Source commit | \`${escapeCell(provenance.sourceCommit)}\` |`,
    `| Source file | \`${escapeCell(provenance.sourcePath)}\` |`,
    `| Checksum | \`${escapeCell(provenance.sha256)}\` |`,
    "",
    `Application version \`${escapeInline(provenance.applicationVersion)}\` identifies the OpenAPI \`info.version\` field. The HTTP contract is \`${escapeInline(provenance.httpContract)}\`. Those identifiers are different. This reference build is identified by the source commit and checksum.`,
    "",
    `Raw spec: [OpenAPI schema](${provenance.sourceUrl}).`,
    "",
    `Pinned source: [${provenance.sourceRepository}@${provenance.sourceCommit}](https://github.com/${provenance.sourceRepository}/blob/${provenance.sourceCommit}/${provenance.sourcePath}).`,
  ];

  if (contract.servers.length > 0) {
    lines.push("", "## Servers", "");
    for (const server of contract.servers) {
      const description = server.description
        ? ` (${escapeInline(server.description)})`
        : "";
      lines.push(`- \`${escapeInline(server.url)}\`${description}`);
    }
  }

  if (contract.summary) {
    lines.push("", `**${escapeInline(contract.summary)}**`);
  }
  if (contract.description) {
    lines.push("", escapeMdx(contract.description));
  }

  lines.push("", "## Operations", "");
  for (const tag of contract.tags) {
    lines.push(`### ${escapeInline(tag.name)}`, "");
    if (tag.description) lines.push(escapeMdx(tag.description), "");
    for (const operation of tag.operations) {
      lines.push(
        `- [\`${operation.method} ${operation.path}\`](/docs/api-reference/${tag.slug}#${operation.operationId}) — ${escapeInline(operation.summary)} — \`${operation.operationId}\``
      );
    }
    lines.push("");
  }
  lines.push(
    `Component schemas: [Schemas](/docs/api-reference/schemas) (${Object.keys(schemaAnchors).length}).`
  );
  return `${lines.join("\n").trim()}\n`;
}

function renderTagPage(
  tag: TagView,
  schemaAnchors: Map<string, string>
): string {
  const lines = [
    frontmatter(
      tagTitle(tag.name),
      tag.description ||
        `Generated ${tag.name} operations from the public Atlas OpenAPI contract.`
    ),
    "Generated from the public OpenAPI contract.",
    "",
  ];
  if (tag.description) lines.push(escapeMdx(tag.description), "");
  for (const operation of tag.operations) {
    lines.push(renderOperation(operation, schemaAnchors), "");
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderOperation(
  operation: OperationView,
  schemaAnchors: Map<string, string>
): string {
  const lines = [
    `## ${escapeInline(operation.summary).replaceAll("[#", "[ #")} [#${operation.operationId}]`,
    "",
    `\`${operation.method} ${operation.path}\``,
    "",
    `Operation ID: \`${operation.operationId}\``,
    "",
    `Tag: ${operation.tags.map((tag) => `\`${escapeInline(tag)}\``).join(", ") || "`untagged`"}`,
  ];
  if (operation.deprecated) lines.push("", "Deprecated.");
  if (operation.description) lines.push("", escapeMdx(operation.description));

  lines.push("", "### Parameters", "");
  if (operation.parameters.length === 0) {
    lines.push("This operation does not declare parameters.");
  } else {
    for (const parameter of operation.parameters) {
      lines.push(
        `#### ${escapeInline(parameter.name)}`,
        "",
        `- Location: \`${escapeInline(parameter.location)}\``,
        `- Required: ${parameter.required ? "yes" : "no"}`
      );
      if (parameter.description) {
        lines.push(`- ${escapeInline(parameter.description)}`);
      }
      lines.push("", "Schema:", "", jsonFence(parameter.schema));
      appendExamples(lines, parameter.examples);
      lines.push("");
    }
  }

  if (operation.requestBody) {
    lines.push("", "### Request body", "");
    lines.push(
      operation.requestBodyRequired
        ? "Required: yes"
        : "Required: not marked required"
    );
    if (operation.requestBodyDescription) {
      lines.push("", escapeMdx(operation.requestBodyDescription));
    }
    if (operation.requestBody.length === 0) {
      lines.push("", "This request body does not declare a media type.");
    }
    for (const media of operation.requestBody) {
      lines.push("", renderMedia(media, schemaAnchors));
    }
  }

  if (operation.security !== undefined) {
    lines.push("", "### Security", "", jsonFence(operation.security));
  }

  lines.push("", "### Responses", "");
  for (const response of operation.responses) {
    lines.push(`#### ${escapeInline(response.status)}`, "");
    if (response.description) lines.push(escapeMdx(response.description), "");
    if (response.media.length === 0) {
      lines.push("This response does not declare a body.", "");
      continue;
    }
    for (const media of response.media) {
      lines.push(renderMedia(media, schemaAnchors), "");
    }
  }
  return lines.join("\n").trim();
}

function renderMedia(
  media: MediaView,
  schemaAnchors: Map<string, string>
): string {
  const lines = [`##### ${escapeInline(media.mediaType)}`, ""];
  const refs = findRefs(media.schema);
  if (refs.length > 0) {
    lines.push(
      refs
        .map((ref) => {
          const anchor = schemaAnchors.get(ref);
          const name = ref.split("/").at(-1) ?? ref;
          if (!anchor) return `Schema: \`${ref}\``;
          return `Schema: [${escapeInline(name)}](/docs/api-reference/schemas#${anchor}) (\`${ref}\`)`;
        })
        .join("\n")
    );
    lines.push("");
  }
  lines.push("Schema:", "", jsonFence(media.schema));
  appendExamples(lines, media.examples);
  return lines.join("\n").trim();
}

function renderSchemaPage(
  schemas: JsonRecord,
  schemaAnchors: Map<string, string>
): string {
  const names = Object.keys(schemas);
  const lines = [
    frontmatter(
      "Schemas",
      "Component schemas copied from the pinned public Atlas OpenAPI contract."
    ),
    "These component schemas are copied from the public OpenAPI contract. Operations link here instead of repeating each schema.",
    "",
  ];
  if (names.length === 0) {
    lines.push("This contract does not declare component schemas.");
  }
  for (const name of names) {
    const anchor = schemaAnchors.get(`#/components/schemas/${name}`);
    if (!anchor) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Component schema ${name} is missing a stable heading.`
      );
    }
    lines.push(
      `## ${escapeInline(name)} [#${anchor}]`,
      "",
      jsonFence(schemas[name]),
      ""
    );
  }
  return `${lines.join("\n").trim()}\n`;
}

function appendExamples(lines: string[], examples: ExampleView[]): void {
  if (examples.length === 0) return;
  lines.push("", "Examples:");
  for (const example of examples) {
    const label = example.name ?? example.summary ?? "example";
    lines.push("", `###### ${escapeInline(label)}`);
    if (example.summary && example.name) {
      lines.push("", escapeMdx(example.summary));
    }
    if (example.description) lines.push("", escapeMdx(example.description));
    lines.push("", jsonFence(example.value));
  }
}

function schemaAnchorMap(schemas: JsonRecord): Map<string, string> {
  const anchors = new Map<string, string>();
  const used = new Set<string>();
  for (const name of Object.keys(schemas)) {
    let anchor = `schema-${slugify(name, "schema")}`;
    let suffix = 2;
    while (used.has(anchor)) {
      anchor = `schema-${slugify(name, "schema")}-${suffix}`;
      suffix += 1;
    }
    used.add(anchor);
    anchors.set(`#/components/schemas/${name}`, anchor);
  }
  return anchors;
}

function compareGeneratedFiles(
  expected: Map<string, string>,
  actual: Map<string, string>
): string[] {
  const differences: string[] = [];
  for (const [relativePath, contents] of expected) {
    if (!actual.has(relativePath)) differences.push(`missing ${relativePath}`);
    else if (actual.get(relativePath) !== contents) {
      differences.push(`changed ${relativePath}`);
    }
  }
  for (const relativePath of actual.keys()) {
    if (!expected.has(relativePath)) differences.push(`extra ${relativePath}`);
  }
  return differences;
}

function readGeneratedFiles(directory: string): Map<string, string> {
  let entries: string[];
  try {
    entries = walkFiles(directory);
  } catch (error) {
    if (nodeCode(error) === "ENOENT") return new Map();
    throw error;
  }
  const files = new Map<string, string>();
  for (const filePath of entries) {
    files.set(
      path.relative(directory, filePath).split(path.sep).join("/"),
      readFileSync(filePath, "utf-8")
    );
  }
  return files;
}

function walkFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function assertRefsResolve(
  document: unknown,
  node: unknown,
  seen = new Set<string>()
): void {
  if (Array.isArray(node)) {
    for (const child of node) assertRefsResolve(document, child, seen);
    return;
  }
  if (!isRecord(node)) return;
  const ref = node.$ref;
  if (typeof ref === "string" && !seen.has(ref)) {
    seen.add(ref);
    const target = resolveJsonPointer(document, ref);
    assertRefsResolve(document, target, seen);
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object")
      assertRefsResolve(document, value, seen);
  }
}

function resolveJsonPointer(document: unknown, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Unsupported OpenAPI reference ${ref}.`
    );
  }
  let current = document;
  for (const part of ref.slice(2).split("/")) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) || !(key in current)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Unresolved OpenAPI reference ${ref}.`
      );
    }
    current = current[key];
  }
  return current;
}

function findRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const child of value) findRefs(child, refs);
    return refs;
  }
  if (!isRecord(value)) return refs;
  if (typeof value.$ref === "string") refs.push(value.$ref);
  for (const child of Object.values(value)) findRefs(child, refs);
  return refs;
}

function rawSpecUrl(servers: unknown): string {
  if (!Array.isArray(servers) || !isRecord(servers[0])) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      "Public OpenAPI contract must declare an HTTPS server before the raw spec can be labeled."
    );
  }
  const url = servers[0].url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      "Public OpenAPI server URL must be HTTPS."
    );
  }
  return new URL("/openapi.json", url.endsWith("/") ? url : `${url}/`).href;
}

function serversFrom(value: unknown): { description: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((server) => ({
    description: text(server, "description"),
    url: text(server, "url"),
  }));
}

function httpContractLabel(paths: string[]): string {
  const prefixes = [
    ...new Set(
      paths.map((route) => {
        const match = /^\/(?<version>v\d+)(?:\/|$)/.exec(route);
        return match?.groups?.version
          ? `/${match.groups.version}`
          : "unversioned";
      })
    ),
  ];
  prefixes.sort();
  return prefixes.join(", ");
}

function jsonFence(value: unknown): string {
  const body = JSON.stringify(value, null, 2);
  const fence = body.includes("```") ? "````" : "```";
  return `${fence}json\n${body}\n${fence}`;
}

function frontmatter(title: string, description: string): string {
  const collapsed = description.replaceAll(/\s+/g, " ").trim();
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(collapsed)}\n---`;
}

function tagTitle(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

function slugify(value: string, label: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!slug) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Cannot create a stable ${label} name from "${value}".`
    );
  }
  return slug;
}

function escapeMdx(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("<", "\\<");
}

function escapeInline(value: string): string {
  return escapeMdx(value).replaceAll("\n", " ");
}

function escapeCell(value: string): string {
  return escapeInline(value).replaceAll("|", "\\|");
}

function text(record: JsonRecord | undefined, key: string): string {
  if (!record) return "";
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function optionalText(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function requiredString(
  record: JsonRecord,
  key: string,
  label: string
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new PublicOpenApiContractError(
      "malformed",
      `Public OpenAPI contract is missing ${label}.`
    );
  }
  return value;
}

function stringList(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new PublicOpenApiContractError(
      "malformed",
      "OpenAPI tags on an operation must be an array of strings."
    );
  }
  return value;
}

function isHttpMethod(method: string): boolean {
  return HTTP_METHODS.some((candidate) => candidate === method);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Public OpenAPI contract is missing ${label}.`
    );
  }
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(
  value: JsonRecord | undefined,
  key: string
): JsonRecord | undefined {
  if (!value) return undefined;
  const child = value[key];
  return isRecord(child) ? child : undefined;
}

function nodeCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

const invokedDirectly = process.argv[1]?.endsWith(
  "public-openapi-reference.ts"
);

if (invokedDirectly) {
  const check = process.argv.includes("--check");
  try {
    syncPublicApiReference({ check, root: process.cwd() });
    console.log(
      check
        ? "Public OpenAPI reference matches the pinned contract."
        : "Public OpenAPI reference generated."
    );
  } catch (error) {
    if (error instanceof PublicOpenApiContractError) {
      console.error(`Public OpenAPI reference ${error.code}: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
