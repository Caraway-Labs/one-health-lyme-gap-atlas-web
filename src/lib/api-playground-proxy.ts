/**
 * Anonymous read-only proxy for the docs API playground.
 *
 * The production API allows CORS from https://onehealthatlas.org and
 * http://localhost:3000. Other docs origins, including preview hosts, are not
 * allowlisted. This route keeps one configured upstream origin, so every docs
 * host can show status, body, and the published response headers without
 * taking a host from the browser.
 */

import {
  publishedOperations,
  resolvePlaygroundTarget,
  type OpenApiDocument,
} from "@/lib/api-playground-allowlist";

const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_SEARCH_LENGTH = 8000;
const PROXY_PREFIX = "/api/proxy";

const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "etag",
  "retry-after",
] as const;

const ACCEPT_HEADER =
  /^(?:\*\/\*|application\/json|application\/pdf|application\/problem\+json|text\/csv)$/;
const IF_NONE_MATCH = /^(?:\*|(?:W\/)?"[\u0021\u0023-\u007E]{1,200}")$/;

export type PlaygroundRateLimit =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type PlaygroundRateLimiter = {
  take: (key: string, now: number) => PlaygroundRateLimit;
};

export type PlaygroundProxyOptions = {
  document: OpenApiDocument;
  fetchImpl?: typeof fetch;
  limiter: PlaygroundRateLimiter;
  maxResponseBytes?: number;
  now?: () => number;
  timeoutMs?: number;
  upstreamOrigin: string;
};

export function createRateLimiter(options?: {
  limit?: number;
  windowMs?: number;
}): PlaygroundRateLimiter {
  const limit = options?.limit ?? 60;
  const windowMs = options?.windowMs ?? 60_000;
  const hits = new Map<string, number[]>();
  return {
    take(key: string, now: number): PlaygroundRateLimit {
      if (hits.size > 5000) hits.clear();
      const recent = (hits.get(key) ?? []).filter(
        (timestamp) => now - timestamp < windowMs
      );
      if (recent.length >= limit) {
        const oldest = recent[0] ?? now;
        hits.set(key, recent);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowMs - (now - oldest)) / 1000)
          ),
        };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true };
    },
  };
}

export function playgroundClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "anonymous";
  const first = forwarded.split(",")[0]?.trim();
  if (!first) return "anonymous";
  return first.slice(0, 200);
}

export async function proxyPlaygroundRequest(
  request: Request,
  options: PlaygroundProxyOptions
): Promise<Response> {
  if (request.method !== "GET") {
    return problem(
      405,
      "Method not allowed",
      "The playground accepts GET only.",
      {
        allow: "GET",
      }
    );
  }

  const url = new URL(request.url);
  if (url.search.length > MAX_SEARCH_LENGTH) {
    return problem(
      413,
      "Query too long",
      "The query string is too long for the playground."
    );
  }

  const decision = options.limiter.take(
    playgroundClientKey(request),
    options.now?.() ?? Date.now()
  );
  if (!decision.allowed) {
    return problem(
      429,
      "Too many requests",
      "Wait and send this playground request again.",
      {
        "retry-after": String(decision.retryAfterSeconds),
      }
    );
  }

  const headers = upstreamHeaders(request);
  if (headers instanceof Response) return headers;

  const origin = safeOrigin(options.upstreamOrigin);
  if (!origin) {
    return problem(
      500,
      "Playground unavailable",
      "The playground upstream origin is not configured."
    );
  }

  const target = resolvePlaygroundTarget({
    operations: publishedOperations(options.document),
    pathname: url.pathname,
    searchParams: url.searchParams,
    upstreamOrigin: origin,
  });
  if (!target.ok) {
    return problem(
      target.rejection.status,
      target.rejection.status === 413
        ? "Query too long"
        : "Playground request was not sent",
      target.rejection.detail
    );
  }

  const timeoutMs = options.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    return await fetchPublished(
      target.target.upstreamUrl,
      headers,
      AbortSignal.timeout(timeoutMs),
      fetchImpl,
      options,
      origin
    );
  } catch (error) {
    if (isTimeout(error)) {
      return problem(
        504,
        "Upstream timeout",
        "The API did not respond before the playground timeout."
      );
    }
    return problem(
      502,
      "Upstream unavailable",
      "The playground could not reach the API."
    );
  }
}

async function fetchPublished(
  initialUrl: string,
  headers: Headers,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
  options: PlaygroundProxyOptions,
  origin: string
): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop < 2; hop += 1) {
    const upstream = await fetchImpl(currentUrl, {
      cache: "no-store",
      headers,
      method: "GET",
      redirect: "manual",
      signal,
    });
    if (!isRedirect(upstream.status)) {
      return clientResponse(
        upstream,
        options.maxResponseBytes ?? MAX_RESPONSE_BYTES
      );
    }
    const nextUrl = sameOriginRedirect(
      upstream,
      currentUrl,
      options.document,
      origin
    );
    await upstream.body?.cancel().catch(() => null);
    if (!nextUrl || hop === 1) {
      return problem(
        502,
        "Redirect not followed",
        "The playground did not follow an upstream redirect."
      );
    }
    currentUrl = nextUrl;
  }
  return problem(
    502,
    "Redirect not followed",
    "The playground did not follow an upstream redirect."
  );
}

function isRedirect(status: number): boolean {
  switch (status) {
    case 301:
    case 302:
    case 303:
    case 307:
    case 308: {
      return true;
    }
    default: {
      return false;
    }
  }
}

function sameOriginRedirect(
  response: Response,
  currentUrl: string,
  document: OpenApiDocument,
  origin: string
): string | undefined {
  const location = response.headers.get("location");
  if (!location || /[\r\n\0]/.test(location)) return undefined;
  let next: URL;
  try {
    next = new URL(location, currentUrl);
  } catch {
    return undefined;
  }
  if (next.username || next.password || next.origin !== origin)
    return undefined;
  const resolved = resolvePlaygroundTarget({
    operations: publishedOperations(document),
    pathname: `${PROXY_PREFIX}${next.pathname}`,
    searchParams: next.searchParams,
    upstreamOrigin: origin,
  });
  if (!resolved.ok) return undefined;
  return resolved.target.upstreamUrl;
}

async function clientResponse(
  upstream: Response,
  maxResponseBytes: number
): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    copyHeader(upstream.headers, headers, name);
  }
  if (
    upstream.status === 204 ||
    upstream.status === 205 ||
    upstream.status === 304
  ) {
    await upstream.body?.cancel().catch(() => null);
    return new Response(null, { headers, status: upstream.status });
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > maxResponseBytes) {
    return problem(
      502,
      "Response too large",
      "The API response is larger than the playground can return."
    );
  }
  return new Response(body, { headers, status: upstream.status });
}

function copyHeader(
  from: Headers,
  to: Headers,
  name: (typeof FORWARDED_RESPONSE_HEADERS)[number]
): void {
  const value = from.get(name);
  if (!value || value.length > 300 || hasControlCharacter(value)) return;
  to.set(name, value);
}

function upstreamHeaders(request: Request): Headers | Response {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) {
    if (!ACCEPT_HEADER.test(accept)) {
      return problem(
        400,
        "Playground request was not sent",
        "Accept is not a published media type for this playground."
      );
    }
    headers.set("accept", accept);
  }
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    if (!IF_NONE_MATCH.test(ifNoneMatch)) {
      return problem(
        400,
        "Playground request was not sent",
        "If-None-Match must be one entity tag."
      );
    }
    headers.set("if-none-match", ifNoneMatch);
  }
  return headers;
}

function safeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash)
      return undefined;
    if (url.pathname !== "/" && url.pathname !== "") return undefined;
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined || code <= 31 || code === 127) return true;
  }
  return false;
}

function isTimeout(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("name" in error))
    return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

function problem(
  status: number,
  title: string,
  detail: string,
  extraHeaders?: Record<string, string>
): Response {
  const headers = new Headers(extraHeaders);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/problem+json; charset=utf-8");
  return Response.json(
    { detail, status, title, type: "about:blank" },
    { headers, status }
  );
}
