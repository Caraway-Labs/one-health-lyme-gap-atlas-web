import { afterEach, describe, expect, it, vi } from "vitest";

import { apiMutator, AtlasApiError } from "../src/lib/api-mutator";

describe("Atlas API mutator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws handled failures without a development console.error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      apiMutator("/v1/atlas/metadata", { method: "GET" })
    ).rejects.toBeInstanceOf(AtlasApiError);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
