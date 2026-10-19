import {
  getPublishedApiOrigin,
  type PublicOriginEnvironment,
} from "@/lib/public-origins";

export const HTTP_CLIENT_GROUP_ID = "atlas-http-client";

export const HTTP_CLIENT_LANGUAGES = [
  "curl",
  "Python",
  "R",
  "TypeScript",
] as const;

export type HttpClientLanguage = (typeof HTTP_CLIENT_LANGUAGES)[number];

export type HttpClientBody = "bytes" | "json";

export interface HttpClientRequest {
  body?: HttpClientBody;
  path: string;
  query?: string;
}

export interface HttpClientExamples {
  Python: string;
  R: string;
  TypeScript: string;
  curl: string;
}

type QueryPair = readonly [string, string];

const R_ARGUMENT = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function resolveHttpClientRequests(input: {
  body?: HttpClientBody;
  path?: string;
  query?: string;
  requests?: readonly HttpClientRequest[];
}): HttpClientRequest[] {
  if (input.requests && input.requests.length > 0) {
    return [...input.requests];
  }
  if (input.path) {
    return [{ body: input.body, path: input.path, query: input.query }];
  }
  throw new Error("HTTP client example requires a path or requests");
}

export function httpClientUrl(
  request: HttpClientRequest,
  environment?: PublicOriginEnvironment
): string {
  const origin = getPublishedApiOrigin(environment);
  const url = new URL(request.path, `${origin}/`);
  const query = request.query?.replace(/^\?/u, "");
  if (query) {
    url.search = query;
  }
  return url.href;
}

export function httpClientExamples(
  requests: readonly HttpClientRequest[],
  environment?: PublicOriginEnvironment
): HttpClientExamples {
  return {
    Python: pythonRequests(requests, environment),
    R: rRequests(requests, environment),
    TypeScript: typescriptRequests(requests, environment),
    curl: requests.map((request) => curlGet(request, environment)).join("\n"),
  };
}

export function httpClientPaginationExamples(
  request: HttpClientRequest,
  environment?: PublicOriginEnvironment
): HttpClientExamples {
  const endpoint = endpointUrl(request, environment);
  const params = queryParams(request.query);
  return {
    Python: pythonPagination(endpoint, params),
    R: rPagination(endpoint, params),
    TypeScript: typescriptPagination(endpoint, params),
    curl: curlPagination(httpClientUrl(request, environment)),
  };
}

function curlGet(
  request: HttpClientRequest,
  environment?: PublicOriginEnvironment
): string {
  return `curl -fsS '${httpClientUrl(request, environment)}'`;
}

function curlPagination(url: string): string {
  const joiner = url.includes("?") ? "&" : "?";
  return `url='${url}'
first=$(curl -fsS "$url")
token=$(printf '%s' "$first" | python3 -c 'import json,sys,urllib.parse; token=json.load(sys.stdin)["meta"]["next_page_token"]; print("" if token is None else urllib.parse.quote(token, safe=""))')
if [ -n "$token" ]; then
  curl -fsS "$url${joiner}page_token=$token"
fi`;
}

function pythonRequests(
  requests: readonly HttpClientRequest[],
  environment?: PublicOriginEnvironment
): string {
  if (requests.length === 1) {
    const request = requests[0];
    if (!request) {
      throw new Error("HTTP client example requires a request");
    }
    return pythonSingle(request, environment);
  }
  const used = new Set<string>();
  const calls = requests
    .map((request) => pythonCall(request, environment, used))
    .join("\n");
  return `import httpx

with httpx.Client(timeout=30.0) as client:
${calls}`;
}

function pythonSingle(
  request: HttpClientRequest,
  environment?: PublicOriginEnvironment
): string {
  const params = pythonParams(queryParams(request.query), 8);
  const paramsArg = params ? `\n    params={\n${params}\n    },` : "";
  return `import httpx

response = httpx.get(
    ${quote(endpointUrl(request, environment))},${paramsArg}
    timeout=30.0,
)
response.raise_for_status()
${request.body === "bytes" ? "payload = response.content" : "body = response.json()"}`;
}

function pythonCall(
  request: HttpClientRequest,
  environment: PublicOriginEnvironment | undefined,
  used: Set<string>
): string {
  const name = bindingName(request.path, used);
  const params = pythonParams(queryParams(request.query), 12);
  const paramsArg = params ? `\n        params={\n${params}\n        },` : "";
  return `    ${name} = client.get(
        ${quote(endpointUrl(request, environment))},${paramsArg}
    )
    ${name}.raise_for_status()
    ${name}_${request.body === "bytes" ? "payload" : "body"} = ${name}.${request.body === "bytes" ? "content" : "json()"}`;
}

function pythonPagination(
  endpoint: string,
  params: readonly QueryPair[]
): string {
  return `import httpx

filters = {
${pythonParams(params, 4)}
}
with httpx.Client(timeout=30.0) as client:
    first = client.get(${quote(endpoint)}, params=filters)
    first.raise_for_status()
    token = first.json()["meta"]["next_page_token"]
    if token is not None:
        continued = client.get(
            ${quote(endpoint)},
            params={**filters, "page_token": token},
        )
        continued.raise_for_status()
        page = continued.json()`;
}

function rRequests(
  requests: readonly HttpClientRequest[],
  environment?: PublicOriginEnvironment
): string {
  const used = new Set<string>();
  const calls = requests
    .map((request) => rCall(request, environment, used))
    .join("\n\n");
  return `library(httr2)

${calls}`;
}

function rCall(
  request: HttpClientRequest,
  environment: PublicOriginEnvironment | undefined,
  used: Set<string>
): string {
  const name = bindingName(request.path, used);
  const params = queryParams(request.query);
  const steps = [`request(${quote(endpointUrl(request, environment))})`];
  if (params.length > 0) {
    steps.push(rQuery(params));
  }
  steps.push("req_timeout(30)", "req_perform()");
  const reader = request.body === "bytes" ? "resp_body_raw" : "resp_body_json";
  return `${name} <- ${steps.join(" |>\n  ")}
${name}_body <- ${reader}(${name})`;
}

function rPagination(endpoint: string, params: readonly QueryPair[]): string {
  const multi = repeated(params) ? ', .multi = "explode"' : "";
  return `library(httr2)

filters <- list(
${rList(params, 2)}
)

first <- request(${quote(endpoint)}) |>
  req_url_query(!!!filters${multi}) |>
  req_timeout(30) |>
  req_perform()

token <- resp_body_json(first)$meta$next_page_token
if (!is.null(token)) {
  continued <- request(${quote(endpoint)}) |>
    req_url_query(!!!filters, page_token = token${multi}) |>
    req_timeout(30) |>
    req_perform()
  page <- resp_body_json(continued)
}`;
}

function typescriptRequests(
  requests: readonly HttpClientRequest[],
  environment?: PublicOriginEnvironment
): string {
  const used = new Set<string>();
  return requests
    .map((request) =>
      typescriptCall(
        request,
        environment,
        requests.length === 1 ? "response" : bindingName(request.path, used)
      )
    )
    .join("\n\n");
}

function typescriptCall(
  request: HttpClientRequest,
  environment: PublicOriginEnvironment | undefined,
  name: string
): string {
  const urlName = name === "response" ? "url" : `${name}Url`;
  const responseName = name === "response" ? "response" : `${name}Response`;
  const bodyName = name === "response" ? "body" : `${name}Body`;
  const appends = queryParams(request.query).map(
    ([key, value]) =>
      `${urlName}.searchParams.append(${quote(key)}, ${quote(value)});`
  );
  const readBody =
    request.body === "bytes"
      ? `const ${bodyName}: ArrayBuffer = await ${responseName}.arrayBuffer();`
      : `const ${bodyName}: unknown = await ${responseName}.json();`;
  const lines = [
    `const ${urlName} = new URL(${quote(endpointUrl(request, environment))});`,
    ...appends,
    `const ${responseName} = await fetch(${urlName});`,
    `if (!${responseName}.ok) {`,
    `  throw new Error(\`Atlas HTTP \${${responseName}.status}\`);`,
    "}",
    readBody,
  ];
  return lines.join("\n");
}

function typescriptPagination(
  endpoint: string,
  params: readonly QueryPair[]
): string {
  const filterLines = params
    .map(([key, value]) => `  [${quote(key)}, ${quote(value)}],`)
    .join("\n");
  return `function readNextPageToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("meta" in body)) {
    throw new Error("Atlas response is missing meta");
  }
  const { meta } = body;
  if (typeof meta !== "object" || meta === null || !("next_page_token" in meta)) {
    throw new Error("Atlas response is missing next_page_token");
  }
  const { next_page_token: nextPageToken } = meta;
  if (nextPageToken === null) {
    return null;
  }
  if (typeof nextPageToken !== "string") {
    throw new Error("Atlas next_page_token is not a string");
  }
  return nextPageToken;
}

const endpoint = ${quote(endpoint)};
const filters: [string, string][] = [
${filterLines}
];

function atlasUrl(pageToken?: string): URL {
  const url = new URL(endpoint);
  for (const [name, value] of filters) {
    url.searchParams.append(name, value);
  }
  if (pageToken !== undefined) {
    url.searchParams.append("page_token", pageToken);
  }
  return url;
}

const firstResponse = await fetch(atlasUrl());
if (!firstResponse.ok) {
  throw new Error(\`Atlas HTTP \${firstResponse.status}\`);
}
const token = readNextPageToken(await firstResponse.json());
if (token !== null) {
  const continuedResponse = await fetch(atlasUrl(token));
  if (!continuedResponse.ok) {
    throw new Error(\`Atlas HTTP \${continuedResponse.status}\`);
  }
  const page: unknown = await continuedResponse.json();
}`;
}

function endpointUrl(
  request: HttpClientRequest,
  environment?: PublicOriginEnvironment
): string {
  const origin = getPublishedApiOrigin(environment);
  return new URL(request.path, `${origin}/`).href;
}

function queryParams(query: string | undefined): QueryPair[] {
  if (!query) {
    return [];
  }
  return [...new URLSearchParams(query.replace(/^\?/u, "")).entries()];
}

function pythonParams(params: readonly QueryPair[], indent: number): string {
  const pad = " ".repeat(indent);
  return groupParams(params)
    .map(([name, values]) => {
      const rendered =
        values.length === 1
          ? quote(values[0] ?? "")
          : `[${values.map((value) => quote(value)).join(", ")}]`;
      return `${pad}${quote(name)}: ${rendered},`;
    })
    .join("\n");
}

function rQuery(params: readonly QueryPair[]): string {
  const multi = repeated(params) ? '\n    .multi = "explode"' : "";
  return `req_url_query(
${rList(params, 4)}${multi}
  )`;
}

function rList(params: readonly QueryPair[], indent: number): string {
  const pad = " ".repeat(indent);
  return groupParams(params)
    .map(([name, values]) => {
      assertRName(name);
      const rendered =
        values.length === 1
          ? quote(values[0] ?? "")
          : `c(${values.map((value) => quote(value)).join(", ")})`;
      return `${pad}${name} = ${rendered},`;
    })
    .join("\n");
}

function groupParams(params: readonly QueryPair[]): [string, string[]][] {
  const grouped: [string, string[]][] = [];
  for (const [name, value] of params) {
    const existing = grouped.find(([key]) => key === name);
    if (existing) {
      existing[1].push(value);
      continue;
    }
    grouped.push([name, [value]]);
  }
  return grouped;
}

function repeated(params: readonly QueryPair[]): boolean {
  const names = params.map(([name]) => name);
  return new Set(names).size !== names.length;
}

function bindingName(path: string, used: Set<string>): string {
  const segment =
    path.split("/").findLast((part) => part.length > 0) ?? "response";
  const cleaned = segment.replaceAll(/[^A-Za-z0-9_]/gu, "_");
  const base = /^[A-Za-z_]/u.test(cleaned) ? cleaned : `response_${cleaned}`;
  let name = base === "response" ? "response" : base;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

function assertRName(name: string): void {
  if (!R_ARGUMENT.test(name)) {
    throw new Error(`Query name ${name} is not an R argument`);
  }
}

function quote(value: string): string {
  return JSON.stringify(value);
}
