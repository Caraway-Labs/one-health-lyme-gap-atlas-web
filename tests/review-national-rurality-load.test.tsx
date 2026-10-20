import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExplorerMapObservationReady } from "@/features/ux-reset/review/explorer-map-observation";
import { ExplorerMapContractError } from "@/features/ux-reset/review/explorer-map-observation";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import {
  RURALITY_NO_DATA_COLOR,
  RURALITY_RUCC_FILLS,
} from "@/features/ux-reset/review/rurality-palette";
import { ValueState } from "@/generated/models";
import { countyDisplayGeometryQueryKey } from "@/lib/county-geography";

const loadExplorerMapObservations = vi.hoisted(() =>
  vi.fn<() => Promise<ExplorerMapObservationReady>>()
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
  import("@/features/ux-reset/review/load-explorer-map-observations"),
  () => ({
    loadExplorerMapObservations,
  })
);

const BOUNDARY_COLOR = "#112233";
const OBSERVED_FIPS = "08001";
const OMITTED_FIPS = "08013";
const RELEASE_ID = "alpha-2026";

function observedRurality(): ExplorerMapObservationReady {
  return {
    knownEmptySelection: null,
    omitted: 1,
    period: "Vintage 2023.",
    rows: [
      {
        categoryLabel: "Metro: area population at least 1 million",
        fips: OBSERVED_FIPS,
        numeric: 1,
        provenance: {
          atlasAcquiredAt: null,
          evidence: {
            provenance_ref: "prov",
            resource_id: "resource",
            resource_type: "observation",
          },
          limitations: [],
          measureId: "rucc_2023",
          methodology: null,
          methodologyId: null,
          methodologyVersion: "semantic_county_assembly_v1",
          observationId: `obs-${OBSERVED_FIPS}`,
          periodEnd: null,
          periodStart: null,
          provenanceRef: "prov",
          publishedValue: 1,
          releaseId: RELEASE_ID,
          semanticVersion: "2.0.0",
          sourceId: "context_rucc",
          sourceLabel: "USDA ERS",
          sourcePublishedAt: null,
          sourceUrl: null,
          sourceVintage: "2023",
          temporalGrain: "VINTAGE_YEAR",
          unit: "code",
        },
        raw: "1",
        valueState: ValueState.OBSERVED,
      },
    ],
    sourceLabel: "USDA ERS",
    unit: "code",
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
    loadExplorerMapObservations.mockReset();
    document.documentElement.style.removeProperty("--explorer-boundary");
  });

  it("keeps a failed rurality load on the boundary color", async () => {
    document.documentElement.style.setProperty(
      "--explorer-boundary",
      BOUNDARY_COLOR
    );
    loadExplorerMapObservations.mockRejectedValue(
      new ExplorerMapContractError(
        "The observation response did not match the governed contract."
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
    loadExplorerMapObservations.mockResolvedValue(observedRurality());
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
