import { describe, expect, it } from "vitest";

import { curlSampleId } from "@/components/docs-openapi-example";

describe("curl sample selection", () => {
  it("prefers the live curl generator over a static sample labeled curl", () => {
    const generators = new Map<string, { label?: string }>([
      ["curl", { label: "cURL" }],
      ["Shell", { label: "curl" }],
    ]);

    expect(curlSampleId(generators)).toBe("curl");
  });

  it("uses a sample whose label is curl when no curl generator is registered", () => {
    const generators = new Map<string, { label?: string }>([
      ["Shell", { label: "curl" }],
      ["Python", { label: "Python" }],
    ]);

    expect(curlSampleId(generators)).toBe("Shell");
  });

  it("returns an empty id when the operation has no curl sample", () => {
    expect(curlSampleId(new Map([["Python", { label: "Python" }]]))).toBe("");
  });
});
