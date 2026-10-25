import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { countyDisplayGeometryQueryKey } from "@/lib/county-geography";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

const pendingMapValues = Promise.withResolvers<never>();

vi.mock(
  import("@/features/ux-reset/review/load-explorer-map-values"),
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/ux-reset/review/load-explorer-map-values")
      >();
    return {
      ...actual,
      loadExplorerMapValues: () => pendingMapValues.promise,
    };
  }
);

const RELEASE_ID = "alpha-2026";

describe("national layer loading", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty("--explorer-boundary");
  });

  it("does not paint a pending observation layer as no published value", async () => {
    document.documentElement.style.setProperty(
      "--explorer-boundary",
      "#aabbcc"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(
      countyDisplayGeometryQueryKey("atlas-home", RELEASE_ID),
      {
        features: [
          {
            geometry: { coordinates: [-105.1, 39.7], type: "Point" as const },
            properties: { fips: "08001" },
            type: "Feature" as const,
          },
        ],
        type: "FeatureCollection" as const,
      }
    );
    render(
      <QueryClientProvider client={client}>
        <ReviewNationalPicture
          counties={[]}
          countiesError={false}
          countiesLoading={false}
          county={null}
          countyQuery=""
          mapLayer="incidence_floor"
          period={null}
          releaseId={RELEASE_ID}
          tierRelease={{ status: "unknown" }}
          onCountyChange={() => {}}
          onMapLayerChange={() => {}}
        />
      </QueryClientProvider>
    );
    const legend = await screen.findByTestId("explorer-map-legend");
    const region = screen.getByTestId("review-national-map-region");
    expect(legend.dataset.legendKind).toBe("loading");
    expect(legend.textContent ?? "").toMatch(
      /Published values for this layer are still loading/i
    );
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.dataset.mapColors ?? "").not.toContain("#aabbcc");
    expect(screen.getByTestId("mock-atlas-map")).toBeTruthy();
  });
});
