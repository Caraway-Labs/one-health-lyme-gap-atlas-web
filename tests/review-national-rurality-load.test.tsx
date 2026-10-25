import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerMapContractError } from "@/features/ux-reset/review/explorer-map-observation";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import {
  RURALITY_NO_DATA_COLOR,
  RURALITY_RUCC_FILLS,
} from "@/features/ux-reset/review/rurality-palette";
import { countyDisplayGeometryQueryKey } from "@/lib/county-geography";

const loadExplorerMapValues = vi.hoisted(() =>
  vi.fn<
    () => Promise<{
      counties: {
        fips: string;
        incidence_floor_2023: number | null;
        rucc_2023: number | null;
        svi_percentile: number | null;
        uninsured_percent: number | null;
      }[];
      release_id: string;
    }>
  >()
);

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

vi.mock(
  import("@/features/ux-reset/review/load-explorer-map-values"),
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/ux-reset/review/load-explorer-map-values")
      >();
    return {
      ...actual,
      loadExplorerMapValues,
    };
  }
);

const BOUNDARY_COLOR = "#112233";
const OBSERVED_FIPS = "08001";
const OMITTED_FIPS = "08013";
const RELEASE_ID = "alpha-2026";

function observedRuralityCollection() {
  return {
    release_id: RELEASE_ID,
    counties: [
      {
        fips: OBSERVED_FIPS,
        incidence_floor_2023: null,
        rucc_2023: 1,
        svi_percentile: null,
        uninsured_percent: null,
      },
    ],
  };
}

function renderRurality() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(countyDisplayGeometryQueryKey("atlas-home", RELEASE_ID), {
    features: [OBSERVED_FIPS, OMITTED_FIPS].map((fips) => ({
      geometry: { coordinates: [-105.1, 39.7], type: "Point" as const },
      properties: { fips },
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
  });
  render(
    <QueryClientProvider client={client}>
      <ReviewNationalPicture
        counties={[]}
        countiesError={false}
        countiesLoading={false}
        county={null}
        countyQuery=""
        mapLayer="rurality"
        period={null}
        releaseId={RELEASE_ID}
        tierRelease={{ status: "unknown" }}
        onCountyChange={() => {}}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

function paintedColors(): Map<string, string> {
  const colors = new Map<string, string>();
  const encoded = screen.getByTestId("review-national-map-region").dataset
    .mapColors;
  for (const entry of (encoded ?? "").split(" ").filter(Boolean)) {
    const separator = entry.indexOf(":");
    colors.set(entry.slice(0, separator), entry.slice(separator + 1));
  }
  return colors;
}

describe("national rurality load paint", () => {
  afterEach(() => {
    cleanup();
    loadExplorerMapValues.mockReset();
    document.documentElement.style.removeProperty("--explorer-boundary");
  });

  it("keeps a failed rurality load on the boundary color", async () => {
    document.documentElement.style.setProperty(
      "--explorer-boundary",
      BOUNDARY_COLOR
    );
    loadExplorerMapValues.mockRejectedValue(
      new ExplorerMapContractError(
        "The map values response did not match the governed contract."
      )
    );
    renderRurality();
    await waitFor(() => {
      expect(screen.getByTestId("explorer-map-legend").dataset.legendKind).toBe(
        "unavailable"
      );
    });
    expect(paintedColors()).toStrictEqual(
      new Map([
        [OBSERVED_FIPS, BOUNDARY_COLOR],
        [OMITTED_FIPS, BOUNDARY_COLOR],
      ])
    );
    expect(
      screen.getByTestId("review-national-map-region").dataset.mapColors ?? ""
    ).not.toContain(RURALITY_NO_DATA_COLOR);
  });

  it("paints counties omitted from a successful rurality load as no data", async () => {
    document.documentElement.style.setProperty(
      "--explorer-boundary",
      BOUNDARY_COLOR
    );
    loadExplorerMapValues.mockResolvedValue(observedRuralityCollection());
    renderRurality();
    await waitFor(() => {
      expect(screen.getByTestId("explorer-map-legend").dataset.legendKind).toBe(
        "categorical"
      );
    });
    expect(paintedColors()).toStrictEqual(
      new Map([
        [OBSERVED_FIPS, RURALITY_RUCC_FILLS[1]],
        [OMITTED_FIPS, RURALITY_NO_DATA_COLOR],
      ])
    );
  });
});
