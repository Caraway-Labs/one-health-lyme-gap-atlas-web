import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { responseHeaders } from "../src/lib/openapi-response-headers";

const contract = JSON.parse(
  readFileSync("contracts/public-openapi.json", "utf-8")
) as {
  paths: Record<
    string,
    {
      get?: {
        responses: Record<string, { headers?: unknown }>;
      };
    }
  >;
};

describe("OpenAPI response headers", () => {
  it("keeps the Atlas geometry Retry-After schema and description", () => {
    const responses =
      contract.paths["/v1/atlas/geometry"]?.get?.responses ?? {};

    expect(responseHeaders(responses["200"]?.headers)).toStrictEqual([
      {
        description: "Media type of the body: `application/geo+json`.",
        name: "Content-Type",
        required: false,
        schema: "string",
      },
      {
        description:
          "How long a client or shared cache can reuse the response: `public, max-age=31536000, immutable`. While the API serves a fallback copy of its data, it replaces a `public` value with `private, no-store`.",
        name: "Cache-Control",
        required: false,
        schema: "string",
      },
      {
        description:
          "Opaque validator for this representation. Send it as `If-None-Match` to get an empty 304 when nothing changed. Send the value back exactly as you received it.",
        name: "ETag",
        required: false,
        schema: "string",
      },
      {
        description:
          "Identifier for this request. Quote it when you ask for support. If you send a valid `X-Request-ID` request header, the API uses that value. Otherwise it generates one. A response that a shared cache replays can carry the identifier of the request that filled the cache.",
        name: "X-Request-ID",
        required: false,
        schema: "string",
      },
    ]);
    expect(responseHeaders(responses["429"]?.headers)).toStrictEqual([
      {
        description:
          "Seconds to wait before you retry. Wait that long when the header is present.",
        name: "Retry-After",
        required: false,
        schema: "string",
      },
    ]);
    expect(responseHeaders(responses["503"]?.headers)).toStrictEqual(
      responseHeaders(responses["429"]?.headers)
    );
  });

  it("renders a content header schema without inventing fields", () => {
    expect(
      responseHeaders({
        "X-Profile": {
          content: {
            "text/plain": {
              schema: { enum: ["profile-token"], type: "string" },
            },
          },
          description: "Profile token.",
        },
      })
    ).toStrictEqual([
      {
        description: "Profile token.",
        name: "X-Profile",
        required: false,
        schema: 'text/plain: string ("profile-token")',
      },
    ]);
  });
});
