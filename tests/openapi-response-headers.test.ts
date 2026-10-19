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

    expect(responseHeaders(responses["200"]?.headers)).toStrictEqual([]);
    expect(responseHeaders(responses["429"]?.headers)).toStrictEqual([
      {
        description: "Seconds before retry when supplied by the service.",
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
