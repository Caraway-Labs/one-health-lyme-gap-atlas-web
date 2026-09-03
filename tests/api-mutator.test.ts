import { afterEach, describe, expect, it, vi } from "vitest";
import { apiMutator } from "../src/lib/api-mutator";

const fetchMock = vi.fn();

describe("API mutator", () => {
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("uses the configured public API origin and preserves request options", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ release_id: "alpha" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiMutator<{ data: { release_id: string }; status: number }>("/v1/atlas/metadata", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/v1/atlas/metadata", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(result.data).toEqual({ release_id: "alpha" });
    expect(result.status).toBe(200);
  });

  it("parses GeoJSON and non-JSON download responses correctly", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
        status: 200,
        headers: { "content-type": "application/geo+json" },
      }))
      .mockResolvedValueOnce(new Response("rank,fips\n1,08001", {
        status: 200,
        headers: { "content-type": "text/csv" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiMutator<{ data: { type: string } }>("/v1/atlas/geometry", { method: "GET" }))
      .resolves.toMatchObject({ data: { type: "FeatureCollection" } });
    await expect(apiMutator<{ data: string }>("/v1/atlas/ranking.csv", { method: "GET" }))
      .resolves.toMatchObject({ data: "rank,fips\n1,08001" });
  });

  it("exposes safe API error details and keeps opaque failures understandable", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Invalid county FIPS" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiMutator("/v1/counties/bad", { method: "GET" })).rejects.toThrow("Invalid county FIPS");
    await expect(apiMutator("/v1/atlas/metadata", { method: "GET" })).rejects.toThrow("Atlas API request failed (503)");
  });
});
