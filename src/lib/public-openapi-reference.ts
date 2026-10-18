import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  getDocsUrl,
  getPublishedApiOrigin,
  getSiteOrigin,
} from "./public-origins.ts";

/**
 * Build-time rendering of the public Atlas OpenAPI contract.
 *
 * The pinned file is the public projection from the API repository, not
 * `contracts/openapi.json` (the unserved first-party Web generator input).
 * Pages are regenerated from that pin. A missing, malformed, empty, or
 * mismatched contract fails the build instead of leaving the previous pages
 * in place as a silent reference.
 *
 * `npm run docs:api:drift` compares the pin with the live document named in
 * the manifest. It reports staleness and does not rewrite the pin, manifest,
 * or generated pages. Pull-request builds do not run it.
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
  | "stale_contract"
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

type ExternalDocsView = {
  description: string;
  url: string;
};

type ParameterView = {
  allowEmptyValue: boolean;
  allowReserved: boolean;
  content: MediaView[] | undefined;
  deprecated: boolean;
  description: string;
  examples: ExampleView[];
  explode: boolean | undefined;
  location: string;
  name: string;
  required: boolean;
  schema: unknown;
  style: string;
};

type ExampleView = {
  description?: string;
  name?: string;
  summary?: string;
  value: unknown;
};

type MediaView = {
  encoding: EncodingView[];
  examples: ExampleView[];
  mediaType: string;
  schema: unknown;
};

type EncodingView = {
  allowReserved: boolean;
  contentType: string;
  explode: boolean | undefined;
  headers: HeaderView[];
  name: string;
  style: string;
};

type HeaderView = {
  content: MediaView[] | undefined;
  deprecated: boolean;
  description: string;
  examples: ExampleView[];
  explode: boolean | undefined;
  name: string;
  required: boolean;
  schema: unknown;
  style: string;
};

type LinkView = {
  description: string;
  name: string;
  operationId: string;
  operationRef: string;
  parameters: unknown;
  requestBody: unknown;
  server: ServerView | undefined;
};

type ResponseView = {
  description: string;
  headers: HeaderView[];
  links: LinkView[];
  media: MediaView[];
  status: string;
};

type ServerView = {
  description: string;
  url: string;
};

type SecuritySchemeView = {
  name: string;
  scheme: JsonRecord;
};

type OperationView = {
  deprecated: boolean;
  description: string;
  externalDocs: ExternalDocsView | undefined;
  method: string;
  operationId: string;
  parameters: ParameterView[];
  path: string;
  pathDescription: string;
  pathSummary: string;
  requestBody: MediaView[] | undefined;
  requestBodyDescription: string;
  requestBodyRequired: boolean;
  responses: ResponseView[];
  security: unknown;
  securitySchemes: SecuritySchemeView[];
  servers: ServerView[] | undefined;
  summary: string;
  tags: string[];
};

type TagView = {
  description: string;
  externalDocs: ExternalDocsView | undefined;
  name: string;
  operations: OperationView[];
  slug: string;
};

export type LoadedPublicOpenApiContract = {
  description: string;
  document: JsonRecord;
  externalDocs: ExternalDocsView | undefined;
  provenance: PublicOpenApiProvenance;
  schemas: JsonRecord;
  servers: ServerView[];
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

  const servers = documentServers(document);
  const sourceUrl = httpsServerUrl(servers[0]?.url ?? "");
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
    externalDocs: externalDocsFrom(document.externalDocs, "Document"),
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
    servers,
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
  if ("webhooks" in document) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Public OpenAPI webhooks are not rendered by this reference."
    );
  }
  const paths = asRecord(document.paths, "paths");
  const declared = Array.isArray(document.tags) ? document.tags : [];
  const descriptions = new Map<string, string>();
  const tagDocs = new Map<string, ExternalDocsView>();
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
    const docs = externalDocsFrom(tag.externalDocs, `Tag ${tag.name}`);
    if (docs) tagDocs.set(tag.name, docs);
  }

  const grouped = new Map<string, OperationView[]>();
  for (const tagName of order) grouped.set(tagName, []);

  for (const [route, pathEntry] of Object.entries(paths)) {
    if (!isRecord(pathEntry)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Path ${route} must be an object.`
      );
    }
    const pathItem = resolvePathItem(document, pathEntry, route);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      if (!isRecord(operation)) {
        throw new PublicOpenApiContractError(
          "malformed",
          `${method.toUpperCase()} ${route} must be an object.`
        );
      }
      const view = buildOperation(document, route, method, operation, pathItem);
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
        externalDocs: tagDocs.get(name),
        name,
        operations: grouped.get(name) ?? [],
        slug,
      };
    });
}

function buildOperation(
  document: JsonRecord,
  route: string,
  method: string,
  operation: JsonRecord,
  pathItem: JsonRecord
): OperationView {
  const label = `${method.toUpperCase()} ${route}`;
  if (operation.callbacks !== undefined) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} callbacks are not rendered by this reference.`
    );
  }
  const operationId = text(operation, "operationId");
  if (!/^[A-Za-z0-9_.-]+$/.test(operationId)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} is missing a stable operationId.`
    );
  }
  const requestBody = buildRequestBody(document, operation.requestBody);
  const responses = buildResponses(document, operation.responses, operationId);
  const security = securityDeclaration(document, operation, pathItem, label);
  const tags = stringList(operation.tags);
  return {
    deprecated: operation.deprecated === true,
    description: text(operation, "description"),
    externalDocs: externalDocsFrom(operation.externalDocs, label),
    method: method.toUpperCase(),
    operationId,
    parameters: mergeParameters(
      document,
      pathItem.parameters,
      operation.parameters
    ),
    path: route,
    pathDescription: text(pathItem, "description"),
    pathSummary: text(pathItem, "summary"),
    requestBody: requestBody.media,
    requestBodyDescription: requestBody.description,
    requestBodyRequired: requestBody.required,
    responses,
    security: security?.requirements,
    securitySchemes: security?.schemes ?? [],
    servers: operationServers(document, operation, pathItem, label),
    summary: text(operation, "summary") || operationId,
    tags,
  };
}

function resolvePathItem(
  document: JsonRecord,
  pathItem: JsonRecord,
  route: string,
  stack: string[] = []
): JsonRecord {
  const ref = referenceOf(pathItem);
  if (ref === undefined) return pathItem;
  if (!ref.startsWith(PATH_ITEM_REF_PREFIX)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Path ${route} reference must point to components.pathItems.`
    );
  }
  assertNotCircular(stack, ref);
  const resolved = resolvePathItem(
    document,
    assertObjectTarget(ref, resolveJsonPointer(document, ref)),
    route,
    [...stack, ref]
  );
  return withSiblingOverrides(resolved, pathItem);
}

function operationServers(
  document: JsonRecord,
  operation: JsonRecord,
  pathItem: JsonRecord,
  label: string
): ServerView[] | undefined {
  if (operation.servers !== undefined) {
    return serverList(document, operation.servers, label);
  }
  if (pathItem.servers !== undefined) {
    return serverList(document, pathItem.servers, label);
  }
  return undefined;
}

function securityDeclaration(
  document: JsonRecord,
  operation: JsonRecord,
  pathItem: JsonRecord,
  label: string
): { requirements: unknown[]; schemes: SecuritySchemeView[] } | undefined {
  let requirements: unknown;
  if (operation.security !== undefined) requirements = operation.security;
  else if (pathItem.security === undefined) {
    requirements = document.security;
  } else {
    requirements = pathItem.security;
  }
  if (requirements === undefined) return undefined;
  if (!Array.isArray(requirements)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} security must be an array.`
    );
  }
  const names = new Set<string>();
  for (const requirement of requirements) {
    if (!isRecord(requirement) || referenceOf(requirement) !== undefined) {
      throw new PublicOpenApiContractError(
        "malformed",
        `${label} security requirements must be objects.`
      );
    }
    for (const name of Object.keys(requirement)) names.add(name);
  }
  return {
    requirements,
    schemes: [...names].map((name) => resolveSecurityScheme(document, name)),
  };
}

function resolveSecurityScheme(
  document: JsonRecord,
  name: string,
  stack: string[] = []
): SecuritySchemeView {
  const ref = `${SECURITY_SCHEME_REF_PREFIX}${encodePointerToken(name)}`;
  return { name, scheme: dereferenceSecurityScheme(document, ref, stack) };
}

function dereferenceSecurityScheme(
  document: JsonRecord,
  ref: string,
  stack: string[]
): JsonRecord {
  assertNotCircular(stack, ref);
  const entry = assertObjectTarget(ref, resolveJsonPointer(document, ref));
  const targetRef = referenceOf(entry);
  if (targetRef === undefined) return entry;
  if (!targetRef.startsWith(SECURITY_SCHEME_REF_PREFIX)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `OpenAPI reference ${targetRef} must point to components.securitySchemes.`
    );
  }
  return withSiblingOverrides(
    dereferenceSecurityScheme(document, targetRef, [...stack, ref]),
    entry
  );
}

function buildResponses(
  document: JsonRecord,
  value: unknown,
  operationId: string
): ResponseView[] {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Operation ${operationId} does not declare responses.`
    );
  }
  return Object.entries(value).map(([status, response]) => {
    const resolved = reusableRecord(
      document,
      response,
      `Operation ${operationId} response ${status} must be an object.`,
      "#/components/responses/"
    );
    return {
      description: text(resolved, "description"),
      headers: buildHeaders(document, resolved.headers, operationId, status),
      links: buildLinks(document, resolved.links, operationId, status),
      media: mediaViews(document, resolved.content),
      status,
    };
  });
}

function buildHeaders(
  document: JsonRecord,
  headers: unknown,
  operationId: string,
  status: string
): HeaderView[] {
  if (headers === undefined) return [];
  if (!isRecord(headers)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Operation ${operationId} response ${status} headers must be an object.`
    );
  }
  return Object.entries(headers).map(([name, header]) => {
    const resolved = reusableRecord(
      document,
      header,
      `Operation ${operationId} response ${status} header ${name} must be an object.`,
      "#/components/headers/"
    );
    const label = `Header ${name}`;
    const body = schemaOrContent(document, resolved, label);
    const schema = isRecord(body.schema) ? body.schema : undefined;
    return {
      content: body.content,
      deprecated: booleanFlag(resolved, "deprecated") === true,
      description: text(resolved, "description") || text(schema, "description"),
      examples: body.examples,
      explode: booleanFlag(resolved, "explode"),
      name,
      required: resolved.required === true,
      schema: body.schema,
      style: styleOf(resolved),
    };
  });
}

function buildLinks(
  document: JsonRecord,
  links: unknown,
  operationId: string,
  status: string
): LinkView[] {
  if (links === undefined) return [];
  if (!isRecord(links)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Operation ${operationId} response ${status} links must be an object.`
    );
  }
  return Object.entries(links).map(([name, link]) => {
    const resolved = reusableRecord(
      document,
      link,
      `Operation ${operationId} response ${status} link ${name} must be an object.`,
      "#/components/links/"
    );
    return {
      description: text(resolved, "description"),
      name,
      operationId: text(resolved, "operationId"),
      operationRef: text(resolved, "operationRef"),
      parameters: resolved.parameters,
      requestBody: resolved.requestBody,
      server:
        resolved.server === undefined
          ? undefined
          : serverView(document, resolved.server, `Link ${name}`, 0),
    };
  });
}

function buildRequestBody(
  document: JsonRecord,
  value: unknown
): { description: string; media: MediaView[] | undefined; required: boolean } {
  if (value === undefined) {
    return { description: "", media: undefined, required: false };
  }
  const resolved = reusableRecord(
    document,
    value,
    "Request body must be an object.",
    "#/components/requestBodies/"
  );
  return {
    description: text(resolved, "description"),
    media: mediaViews(document, resolved.content),
    required: resolved.required === true,
  };
}

function mediaViews(document: JsonRecord, value: unknown): MediaView[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "Response content must be an object."
    );
  }
  return Object.entries(value).map(([mediaType, media]) => {
    const resolved = reusableRecord(
      document,
      media,
      `Media type ${mediaType} must be an object.`
    );
    return {
      encoding: buildEncoding(document, resolved.encoding, mediaType),
      examples: collectExamples(document, resolved),
      mediaType,
      schema: resolved.schema,
    };
  });
}

function mergeParameters(
  document: JsonRecord,
  pathParameters: unknown,
  operationParameters: unknown
): ParameterView[] {
  const merged = new Map<string, ParameterView>();
  for (const parameter of parameterList(document, pathParameters)) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  for (const parameter of parameterList(document, operationParameters)) {
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  return [...merged.values()];
}

function parameterList(document: JsonRecord, value: unknown): ParameterView[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      "OpenAPI parameters must be an array."
    );
  }
  return value.map((parameter) => {
    const resolved = reusableRecord(
      document,
      parameter,
      "Each OpenAPI parameter must be an object.",
      "#/components/parameters/"
    );
    const name = text(resolved, "name");
    const location = text(resolved, "in");
    if (!name || !location) {
      throw new PublicOpenApiContractError(
        "malformed",
        "Each OpenAPI parameter needs a name and location."
      );
    }
    const body = schemaOrContent(document, resolved, `Parameter ${name}`);
    const schema = isRecord(body.schema) ? body.schema : undefined;
    return {
      allowEmptyValue: booleanFlag(resolved, "allowEmptyValue") === true,
      allowReserved: booleanFlag(resolved, "allowReserved") === true,
      content: body.content,
      deprecated: booleanFlag(resolved, "deprecated") === true,
      description: text(resolved, "description") || text(schema, "description"),
      examples: body.examples,
      explode: booleanFlag(resolved, "explode"),
      location,
      name,
      required: resolved.required === true,
      schema: body.schema,
      style: styleOf(resolved),
    };
  });
}

function collectExamples(
  document: JsonRecord,
  source: JsonRecord | undefined
): ExampleView[] {
  if (!source) return [];
  const examples: ExampleView[] = [];
  if ("example" in source) examples.push({ value: source.example });
  const named = source.examples;
  if (Array.isArray(named)) {
    for (const value of named) examples.push({ value });
  } else if (isRecord(named)) {
    for (const [name, entry] of Object.entries(named)) {
      const resolved = dereferenceReusable(
        document,
        entry,
        "#/components/examples/"
      );
      if (isRecord(resolved)) {
        const ref = referenceOf(resolved);
        if (ref !== undefined) {
          throw new PublicOpenApiContractError(
            "malformed",
            `Unsupported OpenAPI reference ${ref}.`
          );
        }
      }
      if (isRecord(resolved) && "value" in resolved) {
        examples.push({
          description: optionalText(resolved, "description"),
          name,
          summary: optionalText(resolved, "summary"),
          value: resolved.value,
        });
      } else {
        examples.push({ name, value: resolved });
      }
    }
  }
  return examples;
}

function schemaOrContent(
  document: JsonRecord,
  source: JsonRecord,
  label: string
): {
  content: MediaView[] | undefined;
  examples: ExampleView[];
  schema: unknown;
} {
  const hasSchema = source.schema !== undefined;
  const hasContent = source.content !== undefined;
  if (hasSchema && hasContent) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} must not declare both schema and content.`
    );
  }
  if (!hasSchema && !hasContent) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} must declare schema or content.`
    );
  }
  if (hasContent && ("example" in source || source.examples !== undefined)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} with content must not declare example or examples.`
    );
  }
  const content = hasContent ? mediaViews(document, source.content) : undefined;
  if (content && content.length !== 1) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} content must contain exactly one media type.`
    );
  }
  const schema = isRecord(source.schema) ? source.schema : undefined;
  return {
    content,
    examples: hasContent
      ? []
      : [
          ...collectExamples(document, source),
          ...collectExamples(document, schema),
        ],
    schema: hasSchema ? source.schema : undefined,
  };
}

function buildEncoding(
  document: JsonRecord,
  value: unknown,
  mediaType: string
): EncodingView[] {
  if (value === undefined) return [];
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Media type ${mediaType} encoding must be an object.`
    );
  }
  return Object.entries(value).map(([name, entry]) => {
    if (!isRecord(entry)) {
      throw new PublicOpenApiContractError(
        "malformed",
        `Encoding ${name} must be an object.`
      );
    }
    return {
      allowReserved: booleanFlag(entry, "allowReserved") === true,
      contentType: text(entry, "contentType"),
      explode: booleanFlag(entry, "explode"),
      headers: buildHeaders(document, entry.headers, mediaType, name),
      name,
      style: styleOf(entry),
    };
  });
}

function booleanFlag(record: JsonRecord, key: string): boolean | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new PublicOpenApiContractError(
      "malformed",
      `OpenAPI ${key} must be a boolean.`
    );
  }
  return value;
}

function styleOf(record: JsonRecord): string {
  if (record.style === undefined) return "";
  if (typeof record.style !== "string") {
    throw new PublicOpenApiContractError(
      "malformed",
      "OpenAPI style must be a string."
    );
  }
  return record.style;
}

function externalDocsFrom(
  value: unknown,
  label: string
): ExternalDocsView | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} externalDocs must be an object.`
    );
  }
  const url = text(value, "url");
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} externalDocs url must be an HTTP(S) URL.`
    );
  }
  return { description: text(value, "description"), url };
}

function externalDocsLink(docs: ExternalDocsView): string {
  const label = docs.description || docs.url;
  return `[${escapeInline(label)}](${docs.url})`;
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
  if (contract.externalDocs) {
    lines.push(
      "",
      "## External documentation",
      "",
      externalDocsLink(contract.externalDocs)
    );
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
    `Component schemas: [Schemas](/docs/api-reference/schemas) (${schemaAnchors.size}).`
  );
  return `${lines.join("\n").trim()}\n`;
}

const COUNTY_REPORT_OPERATION_ID =
  "county_report_pdf_v1_counties__fips__report_pdf_get";
const COUNTY_REPORT_TEMPLATE_TABS = ["county-v1 scoring", "county-v2 evidence"];
const COUNTY_REPORT_SCORE_PARAMETERS = [
  "ecological_share",
  "low_incidence_breakpoint",
  "missing_human_weakness",
] as const;
const COUNTY_REPORT_EVIDENCE_PARAMETERS = [
  "period_start",
  "period_end",
  "measure_id",
] as const;
const COUNTY_REPORT_CHECKED_ON = "18 October 2026";
const COUNTY_REPORT_V1_CACHE =
  "Cache-Control: public, max-age=300, must-revalidate";
const COUNTY_REPORT_V2_CACHE = "Cache-Control: no-store";
const COUNTY_REPORT_V1_SELECTOR_DETAIL =
  "Observation context requires county-v2.";
const COUNTY_REPORT_V2_SELECTOR_DETAIL =
  "county-v2 requires release, exact period and distinct measures.";
const COUNTY_REPORT_UNKNOWN_TEMPLATE_DETAIL =
  "The requested county report template is not available.";

type CountyReportSchemaFacts = {
  defaultValue?: number;
  maxItems?: number;
  maximum?: number;
  minimum?: number;
  multipleOf?: number;
  pattern?: string;
  stringDefault?: string;
};

function renderCountyReportTemplateGuide(
  operation: OperationView
): string | undefined {
  if (operation.operationId !== COUNTY_REPORT_OPERATION_ID) return undefined;
  assertCountyReportContract(operation);
  const parameters = new Map(
    operation.parameters.map((parameter) => [parameter.name, parameter])
  );
  const template = countyReportSchemaFacts(parameters.get("template")?.schema);
  const measure = countyReportSchemaFacts(parameters.get("measure_id")?.schema);
  if (
    template.stringDefault !== "county-v1" ||
    template.pattern === undefined
  ) {
    throw new Error(
      "County report template schema no longer matches county-v1."
    );
  }
  if (measure.maxItems === undefined) {
    throw new Error("County report measure_id is missing maxItems.");
  }
  const apiOrigin = getPublishedApiOrigin({});
  const docsUrl = getDocsUrl({});
  const exampleCounty = "36061";
  const reportPath = `/v1/counties/${exampleCounty}/report.pdf`;
  const scoringUrl = `${apiOrigin}${reportPath}?template=county-v1`;
  const evidenceUrl = `${apiOrigin}${reportPath}?template=county-v2&dataset_version=RELEASE_ID&period_start=2023-01-01&period_end=2023-12-31&measure_id=case_count_floor_2023`;
  const [scoringTab, evidenceTab] = COUNTY_REPORT_TEMPLATE_TABS;
  if (!(scoringTab && evidenceTab && template.stringDefault)) {
    throw new Error("County report template tabs are incomplete.");
  }
  const scoreRows = COUNTY_REPORT_SCORE_PARAMETERS.map((name) =>
    countyReportScoreRow(name, parameters.get(name)?.schema)
  );
  const evidenceList = joinProseList([
    "`dataset_version`",
    ...COUNTY_REPORT_EVIDENCE_PARAMETERS.map((name) => `\`${name}\``),
  ]);

  return [
    "### Template selection",
    "",
    `Choose \`template\` on \`${operation.method} ${operation.path}\`. The default is \`${template.stringDefault}\`. Use a county FIPS in the lower 48 states or the District of Columbia. A scoring PDF is a review-priority report. An evidence PDF repeats canonical observations, lineage, value states, and limitations. Neither report is a diagnosis, an individual risk estimate, or a causal claim.`,
    "",
    "The same selector rules, with the requests checked against the published API, are in the [workflow guides](/docs/develop/workflows#download-a-county-report).",
    "",
    `<Tabs items={${JSON.stringify(COUNTY_REPORT_TEMPLATE_TABS)}}>`,
    `  <Tab value="county-v1-scoring">`,
    "",
    `\`county-v1\` is the scoring selector. \`dataset_version\` is optional. These score settings are optional and bind the scoring inputs:`,
    "",
    "| Parameter | Default | Bounds |",
    "| --- | --- | --- |",
    ...scoreRows,
    "",
    `\`period_start\`, \`period_end\`, and \`measure_id\` are forbidden on \`county-v1\`. Sending one of them returns HTTP \`422\`. Checked on ${COUNTY_REPORT_CHECKED_ON} for FIPS \`${exampleCounty}\`:`,
    "",
    jsonFence(
      countyReportProblem(422, COUNTY_REPORT_V1_SELECTOR_DETAIL, reportPath)
    ),
    "",
    `An unknown registered-pattern template returns HTTP \`422\` with detail \`${COUNTY_REPORT_UNKNOWN_TEMPLATE_DETAIL}\` A template outside \`${template.pattern ?? ""}\` returns HTTP \`422\` with detail \`One or more request values are invalid.\``,
    "",
    `A successful county-v1 response uses \`${COUNTY_REPORT_V1_CACHE}\`. \`ETag\` with \`If-None-Match\` can return \`304\`.`,
    "",
    "```sh",
    `curl -fsS '${scoringUrl}'`,
    "```",
    "",
    "  </Tab>",
    `  <Tab value="county-v2-evidence">`,
    "",
    `\`county-v2\` is the evidence selector. It requires ${evidenceList}. Pass the observation \`release_id\` as \`dataset_version\`. \`period_start\` and \`period_end\` are the exact inclusive dates. \`measure_id\` accepts 1–${String(measure.maxItems)} distinct ids, repeated or comma-separated.`,
    "",
    `A missing release, period, or measure list, a duplicate measure id, more than ${String(measure.maxItems)} ids, or a reversed period returns HTTP \`422\`. Checked on ${COUNTY_REPORT_CHECKED_ON}:`,
    "",
    jsonFence(
      countyReportProblem(422, COUNTY_REPORT_V2_SELECTOR_DETAIL, reportPath)
    ),
    "",
    "An unknown measure returns HTTP `404` `RESOURCE_NOT_FOUND`. The contract also returns HTTP `503` when provenance is missing or mismatched, and HTTP `413` when the report exceeds resource limits.",
    "",
    `Score settings are the county-v1 inputs above. A checked county-v2 request that also sent \`ecological_share=65\` still returned HTTP \`200\` and \`${COUNTY_REPORT_V2_CACHE}\`.`,
    "",
    `A successful county-v2 response uses \`${COUNTY_REPORT_V2_CACHE}\`. The service revalidates authoritative context before a cache response or \`304\`. \`ETag\` is still present.`,
    "",
    "Replace `RELEASE_ID` with the observation `release_id`:",
    "",
    "```sh",
    `curl -fsS '${evidenceUrl}'`,
    "```",
    "",
    `The same checked requests are in the [workflow guides](${docsUrl}/develop/workflows#download-a-county-report).`,
    "",
    "  </Tab>",
    "</Tabs>",
  ].join("\n");
}

function joinProseList(items: readonly string[]): string {
  if (items.length < 2) return items.join("");
  const last = items.at(-1) ?? "";
  return `${items.slice(0, -1).join(", ")}, and ${last}`;
}

function assertCountyReportContract(operation: OperationView): void {
  const requiredSentences = [
    "Opt-in county-v2 requires dataset_version, period_start, period_end and repeated measure_id",
    "V1 rejects observation selectors with 422",
    "V2 responses use no-store",
    "V1 public cache TTL 300 seconds with revalidation",
    "Unknown templates return 422",
  ];
  const missing = requiredSentences.filter(
    (sentence) => !operation.description.includes(sentence)
  );
  if (missing.length > 0) {
    throw new Error(
      `County report template guide is missing contract text: ${missing.join("; ")}`
    );
  }
  const names = new Set(
    operation.parameters.map((parameter) => parameter.name)
  );
  const requiredNames = [
    "dataset_version",
    "template",
    ...COUNTY_REPORT_SCORE_PARAMETERS,
    ...COUNTY_REPORT_EVIDENCE_PARAMETERS,
  ];
  const missingNames = requiredNames.filter((name) => !names.has(name));
  if (missingNames.length > 0) {
    throw new Error(
      `County report template guide is missing parameters: ${missingNames.join(", ")}`
    );
  }
}

function countyReportScoreRow(name: string, schema: unknown): string {
  const facts = countyReportSchemaFacts(schema);
  if (
    facts.defaultValue === undefined ||
    facts.minimum === undefined ||
    facts.maximum === undefined
  ) {
    throw new Error(
      `County report parameter ${name} is missing numeric bounds.`
    );
  }
  const step =
    facts.multipleOf === undefined ? "" : `, multiple of ${facts.multipleOf}`;
  return `| \`${name}\` | ${facts.defaultValue} | ${facts.minimum}–${facts.maximum}${step} |`;
}

function countyReportSchemaFacts(schema: unknown): CountyReportSchemaFacts {
  const facts: CountyReportSchemaFacts = {};
  walkCountyReportSchema(schema, facts);
  return facts;
}

function walkCountyReportSchema(
  schema: unknown,
  facts: CountyReportSchemaFacts
): void {
  if (!isRecord(schema)) return;
  if (typeof schema.pattern === "string") facts.pattern = schema.pattern;
  if (typeof schema.default === "string") facts.stringDefault = schema.default;
  if (typeof schema.default === "number") facts.defaultValue = schema.default;
  if (typeof schema.maximum === "number") facts.maximum = schema.maximum;
  if (typeof schema.minimum === "number") facts.minimum = schema.minimum;
  if (typeof schema.multipleOf === "number")
    facts.multipleOf = schema.multipleOf;
  if (typeof schema.maxItems === "number") facts.maxItems = schema.maxItems;
  for (const combiner of ["allOf", "anyOf", "oneOf"] as const) {
    const branches = schema[combiner];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) walkCountyReportSchema(branch, facts);
  }
  walkCountyReportSchema(schema.items, facts);
}

function countyReportProblem(
  status: number,
  detail: string,
  instance: string
): JsonRecord {
  return {
    type: `${getSiteOrigin({})}/problems/http-${status}`,
    title: "Request failed",
    status,
    detail,
    instance,
    request_id: "example-request-id",
    errors: null,
  };
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
  ];
  if (
    tag.operations.some(
      (operation) => operation.operationId === COUNTY_REPORT_OPERATION_ID
    )
  ) {
    lines.push('import { Tab, Tabs } from "fumadocs-ui/components/tabs";', "");
  }
  lines.push("Generated from the public OpenAPI contract.", "");
  if (tag.description) lines.push(escapeMdx(tag.description), "");
  if (tag.externalDocs) lines.push(externalDocsLink(tag.externalDocs), "");
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
  if (operation.externalDocs) {
    lines.push(
      "",
      `Documentation: ${externalDocsLink(operation.externalDocs)}`
    );
  }
  if (operation.pathSummary) lines.push("", escapeMdx(operation.pathSummary));
  if (operation.pathDescription) {
    lines.push("", escapeMdx(operation.pathDescription));
  }
  if (operation.description) lines.push("", escapeMdx(operation.description));
  const templateGuide = renderCountyReportTemplateGuide(operation);
  if (templateGuide) lines.push("", templateGuide);
  if (operation.servers && operation.servers.length > 0) {
    lines.push("", "### Servers", "");
    for (const server of operation.servers) {
      const description = server.description
        ? ` (${escapeInline(server.description)})`
        : "";
      lines.push(`- \`${escapeInline(server.url)}\`${description}`);
    }
  }

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
      if (parameter.deprecated) lines.push("- Deprecated.");
      if (parameter.description) {
        lines.push(`- ${escapeInline(parameter.description)}`);
      }
      if (parameter.allowEmptyValue) lines.push("- Empty values are allowed.");
      if (parameter.style) {
        lines.push(`- Style: \`${escapeInline(parameter.style)}\``);
      }
      if (parameter.explode !== undefined) {
        lines.push(`- Explode: ${parameter.explode ? "yes" : "no"}`);
      }
      if (parameter.allowReserved) {
        lines.push("- Reserved characters are allowed.");
      }
      if (parameter.content) {
        for (const media of parameter.content) {
          lines.push("", renderMedia(media, schemaAnchors));
        }
      } else if (parameter.schema !== undefined) {
        lines.push("", "Schema:", "", jsonFence(parameter.schema));
        appendExamples(lines, parameter.examples);
      }
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
    for (const scheme of operation.securitySchemes) {
      lines.push(
        "",
        `#### ${escapeInline(scheme.name)}`,
        "",
        jsonFence(scheme.scheme)
      );
    }
  }

  lines.push("", "### Responses", "");
  for (const response of operation.responses) {
    lines.push(`#### ${escapeInline(response.status)}`, "");
    if (response.description) lines.push(escapeMdx(response.description), "");
    if (response.headers.length > 0) {
      lines.push("##### Headers", "");
      for (const header of response.headers) {
        lines.push(renderHeader(header, schemaAnchors), "");
      }
    }
    if (response.media.length === 0) {
      lines.push("This response does not declare a body.", "");
    } else {
      for (const media of response.media) {
        lines.push(renderMedia(media, schemaAnchors), "");
      }
    }
    if (response.links.length > 0) {
      lines.push("##### Links", "");
      for (const link of response.links) {
        lines.push(renderLink(link), "");
      }
    }
  }
  return lines.join("\n").trim();
}

function renderHeader(
  header: HeaderView,
  schemaAnchors: Map<string, string>
): string {
  const lines = [
    `###### ${escapeInline(header.name)}`,
    "",
    `- Required: ${header.required ? "yes" : "no"}`,
  ];
  if (header.deprecated) lines.push("- Deprecated.");
  if (header.description) lines.push(`- ${escapeInline(header.description)}`);
  if (header.style) lines.push(`- Style: \`${escapeInline(header.style)}\``);
  if (header.explode !== undefined) {
    lines.push(`- Explode: ${header.explode ? "yes" : "no"}`);
  }
  if (header.content) {
    for (const media of header.content) {
      lines.push("", renderMedia(media, schemaAnchors, true));
    }
  } else {
    const schemaType = headerSchemaType(header.schema);
    if (schemaType) lines.push(`- Type: \`${escapeInline(schemaType)}\``);
    if (header.schema !== undefined) {
      lines.push("", "Schema:", "", jsonFence(header.schema));
    }
    appendExamples(lines, header.examples);
  }
  return lines.join("\n");
}

function renderLink(link: LinkView): string {
  const lines = [`###### ${escapeInline(link.name)}`, ""];
  if (link.operationId) {
    lines.push(`- Operation ID: \`${escapeInline(link.operationId)}\``);
  }
  if (link.operationRef) {
    lines.push(`- Operation ref: \`${escapeInline(link.operationRef)}\``);
  }
  if (link.description) lines.push("", escapeMdx(link.description));
  if (link.parameters !== undefined) {
    lines.push("", "Parameters:", "", jsonFence(link.parameters));
  }
  if (link.requestBody !== undefined) {
    lines.push("", "Request body:", "", jsonFence(link.requestBody));
  }
  if (link.server) {
    const description = link.server.description
      ? ` (${escapeInline(link.server.description)})`
      : "";
    lines.push(`- Server: \`${escapeInline(link.server.url)}\`${description}`);
  }
  return lines.join("\n");
}

function headerSchemaType(schema: unknown): string {
  if (!isRecord(schema) || typeof schema.type !== "string") return "";
  return schema.type;
}

function renderMedia(
  media: MediaView,
  schemaAnchors: Map<string, string>,
  nested = false
): string {
  const lines = nested
    ? [`Content type: \`${escapeInline(media.mediaType)}\``, ""]
    : [`##### ${escapeInline(media.mediaType)}`, ""];
  if (media.schema !== undefined) {
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
  }
  appendExamples(lines, media.examples);
  if (media.encoding.length > 0) {
    lines.push("", "Encoding:");
    for (const encoding of media.encoding) {
      lines.push("", `**${escapeInline(encoding.name)}**`);
      if (encoding.contentType) {
        lines.push(`- Content type: \`${escapeInline(encoding.contentType)}\``);
      }
      if (encoding.style) {
        lines.push(`- Style: \`${escapeInline(encoding.style)}\``);
      }
      if (encoding.explode !== undefined) {
        lines.push(`- Explode: ${encoding.explode ? "yes" : "no"}`);
      }
      if (encoding.allowReserved) {
        lines.push("- Reserved characters are allowed.");
      }
      for (const header of encoding.headers) {
        lines.push("", renderHeader(header, schemaAnchors));
      }
    }
  }
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

const PATH_ITEM_REF_PREFIX = "#/components/pathItems/";
const SERVER_REF_PREFIX = "#/components/servers/";
const SECURITY_SCHEME_REF_PREFIX = "#/components/securitySchemes/";
const REUSABLE_COMPONENT_PREFIXES = [
  "#/components/responses/",
  "#/components/parameters/",
  "#/components/headers/",
  "#/components/examples/",
  "#/components/requestBodies/",
  "#/components/links/",
] as const;

function isReusableComponentRef(ref: string): boolean {
  return REUSABLE_COMPONENT_PREFIXES.some((prefix) => ref.startsWith(prefix));
}

function dereferenceReusable(
  document: JsonRecord,
  value: unknown,
  prefix?: string
): unknown {
  const overlays: JsonRecord[] = [];
  let current = value;
  const stack: string[] = [];
  while (isRecord(current)) {
    const ref = referenceOf(current);
    if (ref === undefined || prefix === undefined || !ref.startsWith(prefix)) {
      break;
    }
    assertNotCircular(stack, ref);
    stack.push(ref);
    overlays.push(current);
    current = assertObjectTarget(ref, resolveJsonPointer(document, ref));
  }
  if (!isRecord(current) || overlays.length === 0) return current;
  let merged = current;
  for (const source of overlays.toReversed()) {
    merged = withSiblingOverrides(merged, source);
  }
  return merged;
}

function reusableRecord(
  document: JsonRecord,
  value: unknown,
  message: string,
  prefix?: string
): JsonRecord {
  const resolved = dereferenceReusable(document, value, prefix);
  if (!isRecord(resolved)) {
    throw new PublicOpenApiContractError("malformed", message);
  }
  const ref = referenceOf(resolved);
  if (ref !== undefined) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Unsupported OpenAPI reference ${ref}.`
    );
  }
  return resolved;
}

function assertRefsResolve(
  document: unknown,
  node: unknown,
  stack: string[] = [],
  completed = new Set<string>()
): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      assertRefsResolve(document, child, stack, completed);
    }
    return;
  }
  if (!isRecord(node)) return;
  const ref = typeof node.$ref === "string" ? node.$ref : undefined;
  if (ref !== undefined && !completed.has(ref)) {
    if (stack.includes(ref)) {
      if (isReusableComponentRef(ref)) assertNotCircular(stack, ref);
    } else {
      const target = resolveJsonPointer(document, ref);
      if (isReusableComponentRef(ref)) assertObjectTarget(ref, target);
      assertRefsResolve(document, target, [...stack, ref], completed);
      completed.add(ref);
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      assertRefsResolve(document, value, stack, completed);
    }
  }
}

function referenceOf(value: JsonRecord): string | undefined {
  if (!("$ref" in value)) return undefined;
  const ref = value.$ref;
  if (typeof ref !== "string" || ref.trim() === "") {
    throw new PublicOpenApiContractError(
      "malformed",
      "OpenAPI $ref must be a non-empty string."
    );
  }
  return ref;
}

function assertNotCircular(stack: string[], ref: string): void {
  if (stack.includes(ref)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `Circular OpenAPI reference ${[...stack, ref].join(" -> ")}.`
    );
  }
}

function assertObjectTarget(ref: string, target: unknown): JsonRecord {
  if (!isRecord(target)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `OpenAPI reference ${ref} must point to an object.`
    );
  }
  return target;
}

function withSiblingOverrides(
  target: JsonRecord,
  source: JsonRecord
): JsonRecord {
  const merged: JsonRecord = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (key !== "$ref") merged[key] = value;
  }
  return merged;
}

function encodePointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
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

function documentServers(document: JsonRecord): ServerView[] {
  if (!Array.isArray(document.servers) || document.servers.length === 0) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      "Public OpenAPI contract must declare an HTTPS server before the raw spec can be labeled."
    );
  }
  return serverList(document, document.servers, "Document");
}

function httpsServerUrl(url: string): string {
  if (!url.startsWith("https://")) {
    throw new PublicOpenApiContractError(
      "source_mismatch",
      "Public OpenAPI server URL must be HTTPS."
    );
  }
  return new URL("/openapi.json", url.endsWith("/") ? url : `${url}/`).href;
}

function serverList(
  document: JsonRecord,
  value: unknown,
  label: string
): ServerView[] {
  if (!Array.isArray(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} servers must be an array.`
    );
  }
  return value.map((entry, index) => serverView(document, entry, label, index));
}

function serverView(
  document: JsonRecord,
  value: unknown,
  label: string,
  index: number
): ServerView {
  if (!isRecord(value)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} server ${index + 1} must be an object.`
    );
  }
  const resolved = resolveServer(document, value, label, index, []);
  const url = text(resolved, "url");
  if (url === "") {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} server ${index + 1} is missing a url.`
    );
  }
  return { description: text(resolved, "description"), url };
}

function resolveServer(
  document: JsonRecord,
  value: JsonRecord,
  label: string,
  index: number,
  stack: string[]
): JsonRecord {
  const ref = referenceOf(value);
  if (ref === undefined) return value;
  if (!ref.startsWith(SERVER_REF_PREFIX)) {
    throw new PublicOpenApiContractError(
      "malformed",
      `${label} server ${index + 1} reference must point to components.servers.`
    );
  }
  assertNotCircular(stack, ref);
  const resolved = resolveServer(
    document,
    assertObjectTarget(ref, resolveJsonPointer(document, ref)),
    label,
    index,
    [...stack, ref]
  );
  return withSiblingOverrides(resolved, value);
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

const DRIFT_ATTEMPTS = 3;

/**
 * Compare a retrieved authoritative document with the pinned checksum.
 * A mismatch is a maintainer signal. This function does not write files.
 */
export function compareAuthoritativeOpenApiChecksum(
  pinnedSha256: string,
  authoritativeBytes: Uint8Array
): void {
  const authoritativeSha256 = createHash("sha256")
    .update(authoritativeBytes)
    .digest("hex");
  if (authoritativeSha256 === pinnedSha256) {
    return;
  }
  throw new PublicOpenApiContractError(
    "stale_contract",
    `Pinned public OpenAPI checksum ${pinnedSha256} differs from authoritative checksum ${authoritativeSha256}. Review the semantic diff before replacing contracts/public-openapi.json, then update the manifest and run npm run docs:api. This check does not rewrite accepted artifacts.`
  );
}

/**
 * Retrieve the manifest source URL and compare it with the pinned checksum.
 * Retrieval failure and a checksum mismatch both fail closed. Neither path
 * rewrites the pin, the manifest, or the generated reference.
 */
export async function checkAuthoritativeOpenApiDrift(
  root: string
): Promise<void> {
  const contract = readAndLoadPublicOpenApiContract(root);
  const sourceUrl = contract.provenance.sourceUrl;
  let lastError: unknown;
  for (let attempt = 1; attempt <= DRIFT_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${String(response.status)}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      compareAuthoritativeOpenApiChecksum(contract.provenance.sha256, bytes);
      return;
    } catch (error) {
      if (error instanceof PublicOpenApiContractError) {
        throw error;
      }
      lastError = error;
    }
  }
  const detail =
    lastError instanceof Error ? lastError.message : "unknown error";
  throw new PublicOpenApiContractError(
    "unavailable",
    `Authoritative OpenAPI at ${sourceUrl} could not be retrieved (${detail}). The pinned contract was not changed.`
  );
}

const invokedDirectly = process.argv[1]?.endsWith(
  "public-openapi-reference.ts"
);

async function runPublicOpenApiCli(): Promise<void> {
  const check = process.argv.includes("--check");
  const drift = process.argv.includes("--drift");
  try {
    if (check && drift) {
      throw new PublicOpenApiContractError(
        "malformed",
        "Pass only one of --check or --drift."
      );
    }
    if (drift) {
      await checkAuthoritativeOpenApiDrift(process.cwd());
      console.log(
        "Pinned public OpenAPI matches the authoritative document. No files were changed."
      );
      return;
    }
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
      return;
    }
    throw error;
  }
}

if (invokedDirectly) {
  await runPublicOpenApiCli();
}
