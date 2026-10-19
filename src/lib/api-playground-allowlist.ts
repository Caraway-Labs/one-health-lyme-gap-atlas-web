/**
 * Allowlist for the docs API playground proxy.
 *
 * Paths and query names come from the pinned public OpenAPI document.
 * Query values are size-limited and rejected when they look like a host or
 * URL, and published enums stay on the API so its problem responses remain
 * visible. Path parameters keep their published patterns, except
 * `geography_type`, which accepts a short token so an unsupported type can
 * still reach the API.
 */

export type OpenApiSchema = {
  $ref?: string;
  anyOf?: readonly OpenApiSchema[];
  enum?: readonly string[];
  format?: string;
  items?: OpenApiSchema;
  maxItems?: number;
  maxLength?: number;
  oneOf?: readonly OpenApiSchema[];
  pattern?: string;
  type?: string | readonly string[];
};

export type OpenApiParameter = {
  $ref?: string;
  in?: string;
  name?: string;
  required?: boolean;
  schema?: OpenApiSchema;
};

export type OpenApiOperation = {
  parameters?: readonly OpenApiParameter[];
};

export type OpenApiPathItem = {
  get?: OpenApiOperation;
  parameters?: readonly OpenApiParameter[];
};

export type OpenApiDocument = {
  components?: {
    parameters?: Record<string, OpenApiParameter>;
    schemas?: Record<string, OpenApiSchema>;
  };
  paths?: Record<string, OpenApiPathItem>;
};

export type QueryValueKind = "date" | "integer" | "string";

export type PublishedQueryParam = {
  kind: QueryValueKind;
  maxItems: number;
  maxLength: number;
  repeated: boolean;
};

export type PublishedOperation = {
  pathParams: ReadonlyMap<string, RegExp>;
  query: ReadonlyMap<string, PublishedQueryParam>;
  template: string;
};

export type PlaygroundTarget = {
  pathname: string;
  upstreamUrl: string;
};

export type PlaygroundTargetRejection = {
  detail: string;
  status: 400 | 413;
};

const DEFAULT_STRING_MAX_LENGTH = 2000;
const MAX_QUERY_PAIRS = 40;
const MAX_REPEATED_ITEMS = 50;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const GEOGRAPHY_TYPE_PATTERN = /^[a-z]{1,32}$/;
const SAFE_PATH = /^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/;
const HOST_QUERY_NAMES = new Set([
  "endpoint",
  "host",
  "origin",
  "upstream",
  "uri",
  "url",
]);

const compiledOperations = new WeakMap<
  OpenApiDocument,
  readonly PublishedOperation[]
>();

export function publishedOperations(
  document: OpenApiDocument
): readonly PublishedOperation[] {
  const cached = compiledOperations.get(document);
  if (cached) return cached;
  const operations = compileOperations(document);
  compiledOperations.set(document, operations);
  return operations;
}

export function resolvePlaygroundTarget(input: {
  operations: readonly PublishedOperation[];
  pathname: string;
  searchParams: URLSearchParams;
  upstreamOrigin: string;
}):
  | { ok: true; target: PlaygroundTarget }
  | { ok: false; rejection: PlaygroundTargetRejection } {
  const pathname = playgroundPathname(input.pathname);
  if (!pathname) {
    return reject(400, "The playground does not accept that path.");
  }
  if (input.searchParams.size > MAX_QUERY_PAIRS) {
    return reject(413, "The query string is too long for the playground.");
  }
  for (const name of input.searchParams.keys()) {
    if (HOST_QUERY_NAMES.has(name.toLowerCase())) {
      return reject(400, "The playground does not accept a request host.");
    }
  }

  const operation = matchOperation(input.operations, pathname);
  if (!operation) {
    return reject(400, "That path is not a published GET endpoint.");
  }

  const query = validatedQuery(operation, input.searchParams);
  if (!query.ok) return query;

  const upstream = new URL(input.upstreamOrigin);
  upstream.pathname = pathname;
  upstream.search = query.search;
  return {
    ok: true,
    target: { pathname, upstreamUrl: upstream.href },
  };
}

function compileOperations(document: OpenApiDocument): PublishedOperation[] {
  const operations: PublishedOperation[] = [];
  for (const [template, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem.get) continue;
    operations.push(compileOperation(document, template, pathItem));
  }
  return operations;
}

function compileOperation(
  document: OpenApiDocument,
  template: string,
  pathItem: OpenApiPathItem
): PublishedOperation {
  const parameters = [
    ...(pathItem.parameters ?? []),
    ...(pathItem.get?.parameters ?? []),
  ];
  const pathParams = new Map<string, RegExp>();
  const query = new Map<string, PublishedQueryParam>();
  for (const parameter of parameters) {
    const resolved = resolveParameter(document, parameter);
    if (!resolved?.name || !resolved.in) continue;
    const schema = resolveSchema(document, resolved.schema);
    if (resolved.in === "path") {
      pathParams.set(resolved.name, pathPattern(resolved.name, schema));
    }
    if (resolved.in === "query") {
      query.set(resolved.name, queryParam(schema));
    }
  }
  return { pathParams, query, template };
}

function resolveParameter(
  document: OpenApiDocument,
  parameter: OpenApiParameter
): OpenApiParameter | undefined {
  if (!parameter.$ref) return parameter;
  const name = refName(parameter.$ref, "parameters");
  if (!name) return undefined;
  return document.components?.parameters?.[name];
}

function resolveSchema(
  document: OpenApiDocument,
  schema: OpenApiSchema | undefined,
  depth = 0
): OpenApiSchema {
  if (!schema || depth > 8) return {};
  if (schema.$ref) {
    const name = refName(schema.$ref, "schemas");
    if (!name) return {};
    return resolveSchema(
      document,
      document.components?.schemas?.[name],
      depth + 1
    );
  }
  const branches = schema.anyOf ?? schema.oneOf;
  if (!branches) return schema;
  for (const branch of branches) {
    const resolved = resolveSchema(document, branch, depth + 1);
    const types = schemaTypes(resolved);
    if (!types.every((type) => type === "null")) return resolved;
  }
  return {};
}

function refName(
  ref: string,
  section: "parameters" | "schemas"
): string | undefined {
  const prefix = `#/components/${section}/`;
  if (!ref.startsWith(prefix)) return undefined;
  return ref.slice(prefix.length);
}

function pathPattern(name: string, schema: OpenApiSchema): RegExp {
  if (schema.pattern) return anchored(schema.pattern);
  if (name === "geography_type") return GEOGRAPHY_TYPE_PATTERN;
  return IDENTIFIER_PATTERN;
}

function anchored(pattern: string): RegExp {
  const body = pattern.replace(/^\^/, "").replace(/\$$/, "");
  return new RegExp(`^(?:${body})$`);
}

function queryParam(schema: OpenApiSchema): PublishedQueryParam {
  const itemSchema = schema.items ? schema : undefined;
  const valueSchema = schema.items ?? schema;
  const repeated =
    schemaTypes(schema).includes("array") || Boolean(schema.items);
  const maxItems = repeated
    ? Math.min(
        itemSchema?.maxItems ?? schema.maxItems ?? MAX_REPEATED_ITEMS,
        MAX_REPEATED_ITEMS
      )
    : 1;
  return {
    kind: valueKind(valueSchema),
    maxItems,
    maxLength:
      valueSchema.maxLength ?? defaultMaxLength(valueKind(valueSchema)),
    repeated,
  };
}

function valueKind(schema: OpenApiSchema): QueryValueKind {
  if (schemaTypes(schema).includes("integer")) return "integer";
  if (schema.format === "date") return "date";
  return "string";
}

function defaultMaxLength(kind: QueryValueKind): number {
  switch (kind) {
    case "date": {
      return 10;
    }
    case "integer": {
      return 12;
    }
    case "string": {
      return DEFAULT_STRING_MAX_LENGTH;
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function schemaTypes(schema: OpenApiSchema): string[] {
  const type = schema.type;
  if (!type) return [];
  if (typeof type === "string") return [type];
  return [...type];
}

function playgroundPathname(pathname: string): string | undefined {
  const prefix = "/api/proxy";
  if (!pathname.startsWith(`${prefix}/`)) return undefined;
  let decoded = pathname.slice(prefix.length);
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return undefined;
    }
  }
  if (!SAFE_PATH.test(decoded)) return undefined;
  const segments = decoded.split("/").slice(1);
  if (segments.some((segment) => segment === "." || segment === ".."))
    return undefined;
  return decoded;
}

function matchOperation(
  operations: readonly PublishedOperation[],
  pathname: string
): PublishedOperation | undefined {
  const segments = pathname.split("/").slice(1);
  for (const operation of operations) {
    const templateSegments = operation.template.split("/").slice(1);
    if (templateSegments.length !== segments.length) continue;
    if (pathSegmentsMatch(operation, templateSegments, segments))
      return operation;
  }
  return undefined;
}

function pathSegmentsMatch(
  operation: PublishedOperation,
  templateSegments: readonly string[],
  segments: readonly string[]
): boolean {
  for (let index = 0; index < templateSegments.length; index += 1) {
    const templateSegment = templateSegments[index] ?? "";
    const segment = segments[index] ?? "";
    if (templateSegment.startsWith("{") && templateSegment.endsWith("}")) {
      const name = templateSegment.slice(1, -1);
      const pattern = operation.pathParams.get(name);
      if (!pattern?.test(segment)) return false;
      continue;
    }
    if (templateSegment !== segment) return false;
  }
  return true;
}

function validatedQuery(
  operation: PublishedOperation,
  searchParams: URLSearchParams
):
  | { ok: true; search: string }
  | { ok: false; rejection: PlaygroundTargetRejection } {
  const seen = new Map<string, number>();
  const forwarded = new URLSearchParams();
  for (const [name, value] of searchParams.entries()) {
    const rule = operation.query.get(name);
    if (!rule) {
      return reject(
        400,
        "That query parameter is not published for this endpoint."
      );
    }
    const count = (seen.get(name) ?? 0) + 1;
    if (count > rule.maxItems) {
      return reject(
        400,
        "That query parameter is repeated more times than this endpoint publishes."
      );
    }
    seen.set(name, count);
    if (!valueAllowed(value, rule)) {
      return reject(400, "That query value is not accepted by the playground.");
    }
    forwarded.append(name, value);
  }
  return { ok: true, search: forwarded.toString() };
}

function valueAllowed(value: string, rule: PublishedQueryParam): boolean {
  switch (rule.kind) {
    case "date": {
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }
    case "integer": {
      return /^-?\d{1,12}$/.test(value);
    }
    case "string": {
      return isSafeString(value, rule.maxLength);
    }
    default: {
      const exhaustive: never = rule.kind;
      return exhaustive;
    }
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined || code <= 31 || code === 127) return true;
  }
  return false;
}

function isSafeString(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) return false;
  if (hasControlCharacter(value)) return false;
  if (value.includes("\\") || value.includes("@") || value.includes("://"))
    return false;
  if (value.startsWith("//")) return false;
  return true;
}

function reject(
  status: 400 | 413,
  detail: string
): { ok: false; rejection: PlaygroundTargetRejection } {
  return { ok: false, rejection: { detail, status } };
}
