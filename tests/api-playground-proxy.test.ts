// @vitest-environment node
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import {
  API_PLAYGROUND_OPERATIONS,
  playgroundProxyPath,
} from "@/features/docs/api-playground-operations";
import {
  publishedOperations,
  type OpenApiDocument,
} from "@/lib/api-playground-allowlist";
import {
  createRateLimiter,
  proxyPlaygroundRequest,
  type PlaygroundProxyOptions,
} from "@/lib/api-playground-proxy";

const UPSTREAM_ORIGIN = "https://api.onehealthatlas.org";

const pinnedDocument = JSON.parse(
  readFileSync("contracts/public-openapi.json", "utf-8")
) as OpenApiDocument;

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://127.0.0.1:3000${path}`, {
    method: "GET",
    ...init,
  });
}

function options(
  fetchImpl: typeof fetch,
  overrides: Partial<PlaygroundProxyOptions> = {}
): PlaygroundProxyOptions {
  return {
    document: pinnedDocument,
    fetchImpl,
    limiter: createRateLimiter({ limit: 20, windowMs: 60_000 }),
    now: () => 1_700_000_000_000,
    upstreamOrigin: UPSTREAM_ORIGIN,
    ...overrides,
  };
}

function jsonResponse(
  status: number,
  body: string,
  headers: Record<string, string>
): Response {
  return new Response(body, { headers, status });
}

describe("api playground proxy", () => {
  it("allowlists the pinned public GET operations", () => {
    const operations = publishedOperations(pinnedDocument);
    expect(operations).toHaveLength(22);
    expect(operations.map((operation) => operation.template)).toContain(
      "/v1/atlas/map-values"
    );
    expect(operations.map((operation) => operation.template)).toContain(
      "/v1/observations"
    );
    expect(operations.map((operation) => operation.template)).toContain(
      "/v1/atlas/ranking.csv"
    );
  });

  it("forwards an allowlisted GET and the published response headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, '{"data":[]}', {
        "cache-control": "public, max-age=300",
        "content-type": "application/json",
        etag: 'W/"abc"',
        "set-cookie": "session=secret",
        "x-request-id": "hidden",
      })
    );
    const response = await proxyPlaygroundRequest(
      request(
        "/api/proxy/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023",
        {
          headers: {
            accept: "application/json",
            authorization: "Bearer secret",
            cookie: "session=secret",
            "if-none-match": 'W/"previous"',
          },
        }
      ),
      options(fetchImpl)
    );
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    const outbound = new Headers(init?.headers);

    expect({
      body: await response.text(),
      outbound: {
        accept: outbound.get("accept"),
        authorization: outbound.get("authorization"),
        cookie: outbound.get("cookie"),
        ifNoneMatch: outbound.get("if-none-match"),
        method: init?.method,
        redirect: init?.redirect,
        url,
      },
      response: {
        cacheControl: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag"),
        setCookie: response.headers.get("set-cookie"),
        status: response.status,
        xRequestId: response.headers.get("x-request-id"),
      },
    }).toStrictEqual({
      body: '{"data":[]}',
      outbound: {
        accept: "application/json",
        authorization: null,
        cookie: null,
        ifNoneMatch: 'W/"previous"',
        method: "GET",
        redirect: "manual",
        url: "https://api.onehealthatlas.org/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023",
      },
      response: {
        cacheControl: "public, max-age=300",
        contentType: "application/json",
        etag: 'W/"abc"',
        setCookie: null,
        status: 200,
        xRequestId: null,
      },
    });
  });

  it("forwards geometry GeoJSON and rejects an unrelated Accept type", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, '{"type":"FeatureCollection"}', {
        "content-type": "application/geo+json",
      })
    );
    const forwarded = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/geometry", {
        headers: { accept: "application/geo+json" },
      }),
      options(fetchImpl)
    );
    const rejected = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/geometry", {
        headers: { accept: "text/html" },
      }),
      options(fetchImpl)
    );
    const [url, init] = fetchImpl.mock.calls[0] ?? [];

    expect({
      calls: fetchImpl.mock.calls.length,
      forwarded: {
        accept: new Headers(init?.headers).get("accept"),
        body: await forwarded.text(),
        contentType: forwarded.headers.get("content-type"),
        status: forwarded.status,
        url,
      },
      rejected: {
        body: await rejected.json(),
        status: rejected.status,
      },
    }).toStrictEqual({
      calls: 1,
      forwarded: {
        accept: "application/geo+json",
        body: '{"type":"FeatureCollection"}',
        contentType: "application/geo+json",
        status: 200,
        url: "https://api.onehealthatlas.org/v1/atlas/geometry",
      },
      rejected: {
        body: {
          detail: "Accept is not a published media type for this playground.",
          status: 400,
          title: "Playground request was not sent",
          type: "about:blank",
        },
        status: 400,
      },
    });
  });

  it("passes through 4xx and 5xx status, body, and retry headers", async () => {
    const problem =
      '{"code":"RESOURCE_NOT_FOUND","detail":"Measure not found."}';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(404, problem, {
          "cache-control": "private",
          "content-type": "application/problem+json",
          etag: '"missing"',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(503, '{"status":503}', {
          "cache-control": "no-store",
          "content-type": "application/problem+json",
          "retry-after": "30",
        })
      );

    const notFound = await proxyPlaygroundRequest(
      request("/api/proxy/v1/measures/missing_measure"),
      options(fetchImpl)
    );
    const unavailable = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl)
    );
    expect([
      {
        body: await notFound.text(),
        cacheControl: notFound.headers.get("cache-control"),
        contentType: notFound.headers.get("content-type"),
        etag: notFound.headers.get("etag"),
        status: notFound.status,
      },
      {
        body: await unavailable.text(),
        contentType: unavailable.headers.get("content-type"),
        retryAfter: unavailable.headers.get("retry-after"),
        status: unavailable.status,
      },
    ]).toStrictEqual([
      {
        body: problem,
        cacheControl: "private",
        contentType: "application/problem+json",
        etag: '"missing"',
        status: 404,
      },
      {
        body: '{"status":503}',
        contentType: "application/problem+json",
        retryAfter: "30",
        status: 503,
      },
    ]);
  });

  it("passes through an empty conditional response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          headers: {
            "cache-control": "public, max-age=60",
            etag: 'W/"same"',
          },
          status: 304,
        })
    );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/sources/human", {
        headers: { "if-none-match": 'W/"same"' },
      }),
      options(fetchImpl)
    );
    expect(response.status).toBe(304);
    await expect(response.text()).resolves.toBe("");
    expect(response.headers.get("etag")).toBe('W/"same"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("maps an upstream timeout to 504", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      await delay(1000, undefined, { signal: init?.signal ?? undefined });
      return new Response(null, { status: 599 });
    });
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl, { timeoutMs: 20 })
    );
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      detail: "The API did not respond before the playground timeout.",
      status: 504,
    });
  });

  it("maps an upstream network failure to 502", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("connect ECONNREFUSED");
    });
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl)
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ status: 502 });
  });

  it("rejects user-supplied hosts, traversal, and unpublished queries", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const cases = [
      "/api/proxy?url=https://evil.test/secret",
      "/api/proxy/https://evil.test/secret",
      "/api/proxy/v1/%2e%2e/secret",
      "/api/proxy/v1/observations/../../etc/passwd",
      "/api/proxy/v1/observations?url=https://evil.test",
      "/api/proxy/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=https://evil.test&year=2023",
      "/api/proxy/v1/%252e%252e/secret",
      "/api/proxy/v1/not-published",
      "/api/proxy/v1/counties/36a61",
      "/api/proxy/v1/states/NEW/review",
    ];
    const results: { detail: string; status: number }[] = [];
    for (const path of cases) {
      const response = await proxyPlaygroundRequest(
        request(path),
        options(fetchImpl)
      );
      const body = (await response.json()) as { detail: string };
      results.push({ detail: body.detail, status: response.status });
    }
    expect(results.map((result) => result.status)).toStrictEqual(
      cases.map(() => 400)
    );
    expect(
      results.some((result) =>
        result.detail.toLowerCase().includes("evil.test")
      )
    ).toBeFalsy();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not follow a redirect to another host", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          headers: { location: "https://evil.test/v1/atlas/metadata" },
          status: 302,
        })
    );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl)
    );
    expect(response.status).toBe(502);
    await expect(response.text()).resolves.not.toContain("evil.test");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("follows one same-origin redirect only when the target stays allowlisted", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: "/v1/sources/human" },
          status: 307,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, '{"data":{"id":"human"}}', {
          "content-type": "application/json",
          etag: '"human"',
        })
      );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl)
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"human"');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://api.onehealthatlas.org/v1/sources/human"
    );
  });

  it("does not follow a redirect that carries userinfo", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          headers: {
            location:
              "https://user:pass@api.onehealthatlas.org/v1/sources/human",
          },
          status: 302,
        })
    );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl)
    );
    expect(response.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledOnce();
    await expect(response.text()).resolves.not.toContain("user:pass");
  });

  it("rejects methods other than GET", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("connect failed");
    });
    const posted = await proxyPlaygroundRequest(
      new Request("http://127.0.0.1:3000/api/proxy/v1/atlas/metadata", {
        method: "POST",
      }),
      options(fetchImpl)
    );
    expect({
      allow: posted.headers.get("allow"),
      calls: fetchImpl.mock.calls.length,
      status: posted.status,
    }).toStrictEqual({ allow: "GET", calls: 0, status: 405 });
  });

  it("returns 429 with Retry-After after the rate limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("connect failed");
    });
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const first = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl, { limiter })
    );
    const limited = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl, { limiter })
    );
    expect({
      calls: fetchImpl.mock.calls.length,
      first: first.status,
      retryAfter: limited.headers.get("retry-after"),
      status: limited.status,
    }).toStrictEqual({ calls: 1, first: 502, retryAfter: "60", status: 429 });
  });

  it("uses separate rate limit buckets per client", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.take("10.0.0.1", 1000).allowed).toBeTruthy();
    expect(limiter.take("10.0.0.1", 1000).allowed).toBeFalsy();
    expect(limiter.take("10.0.0.2", 1000).allowed).toBeTruthy();
  });

  it("rates DigitalOcean clients by do-connecting-ip", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, "{}", { "content-type": "application/json" })
    );
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const sharedIngress = "10.0.0.8";
    const client = (address: string) =>
      request("/api/proxy/v1/atlas/metadata", {
        headers: {
          "do-connecting-ip": address,
          "x-forwarded-for": sharedIngress,
        },
      });
    const first = await proxyPlaygroundRequest(
      client("203.0.113.1"),
      options(fetchImpl, { limiter })
    );
    const repeated = await proxyPlaygroundRequest(
      client("203.0.113.1"),
      options(fetchImpl, { limiter })
    );
    const other = await proxyPlaygroundRequest(
      client("203.0.113.2"),
      options(fetchImpl, { limiter })
    );
    expect({
      first: first.status,
      other: other.status,
      repeated: repeated.status,
    }).toStrictEqual({ first: 200, other: 200, repeated: 429 });
  });

  it("rejects a response larger than the playground cap", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, "abcdef", { "content-type": "application/json" })
    );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl, { maxResponseBytes: 4 })
    );
    expect(response.status).toBe(502);
    await expect(response.text()).resolves.not.toContain("abcdef");
  });

  it("cancels an oversized body before later chunks are read", async () => {
    let reads = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>(
      {
        cancel() {
          cancelled = true;
        },
        pull(controller) {
          reads += 1;
          controller.enqueue(
            new Uint8Array([reads, reads, reads, reads, reads])
          );
        },
      },
      new CountQueuingStrategy({ highWaterMark: 0 })
    );
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(stream, {
          headers: { "content-type": "application/json" },
          status: 200,
        })
    );
    const response = await proxyPlaygroundRequest(
      request("/api/proxy/v1/atlas/metadata"),
      options(fetchImpl, { maxResponseBytes: 4 })
    );
    expect({
      cancelled,
      reads,
      status: response.status,
    }).toStrictEqual({ cancelled: true, reads: 1, status: 502 });
  });

  it("keeps playground examples on the published allowlist and the lower 48", async () => {
    const serialized = JSON.stringify(API_PLAYGROUND_OPERATIONS);
    expect(serialized).toContain("36061");
    expect(serialized).not.toMatch(/"AK"|"HI"|02020|15001/);

    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, "{}", { "content-type": "application/json" })
    );
    const statuses: number[] = [];
    for (const operation of API_PLAYGROUND_OPERATIONS) {
      for (const example of operation.examples) {
        const response = await proxyPlaygroundRequest(
          request(playgroundProxyPath(operation, example.values)),
          options(fetchImpl)
        );
        statuses.push(response.status);
      }
    }
    expect(statuses).toStrictEqual(statuses.map(() => 200));
    expect(fetchImpl).toHaveBeenCalledTimes(statuses.length);
  });
});
