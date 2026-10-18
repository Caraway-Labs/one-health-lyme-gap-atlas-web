import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { countyReferenceFromScoreSummaries } from "@/features/ux-reset/review/explorer-county-reference";
import { SCENARIO_SCORE_DEFAULTS } from "@/features/ux-reset/review/explorer-scenario-score";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { countyDisplayGeometryQueryKey } from "@/lib/county-geography";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

const RELEASE_ID = "alpha-2026";
const RAMP = "#112233";

function score(
  fips: string,
  state: string,
  stateName: string,
  countyName: string,
  human: number,
  total: number,
  humanStatus: string
): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#55a8a3",
    county: countyName,
    evidence_completeness: 50,
    fips,
    human_status: humanStatus,
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 84.8,
      community: 87.3,
      ecological: 0,
      human_weakness: human,
      pathogen_signal: 0,
      rural_signal: 100,
      score: total,
      svi_signal: 83.8,
      tick_signal: 0,
    },
    state,
    state_name: stateName,
    tick_status: "No records",
  };
}

const conejos = score(
  "08021",
  "CO",
  "Colorado",
  "Conejos County",
  75,
  22.9,
  "no_county_linked_record"
);
const adams = score(
  "08001",
  "CO",
  "Colorado",
  "Adams County",
  0,
  0,
  "published_count_floor"
);
adams.color = "#a9d2db";
const anchorage = score(
  "02020",
  "AK",
  "Alaska",
  "Anchorage Municipality",
  100,
  99,
  "published_count_floor"
);
anchorage.color = "#ff00aa";

const COUNTIES = [conejos, adams, anchorage];

function installRamps() {
  document.documentElement.style.setProperty("--map-ramp-1", RAMP);
  document.documentElement.style.setProperty("--explorer-boundary", "#e4e9ea");
}

function featureColor(region: HTMLElement, fips: string): string {
  const raw = region.dataset.mapColors ?? "";
  const pair = raw.split(" ").find((entry) => entry.startsWith(`${fips}:`));
  return pair?.slice(fips.length + 1) ?? "";
}

function client(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties: COUNTIES,
      methodology_version: "1",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  queryClient.setQueryData(
    countyDisplayGeometryQueryKey("atlas-home", RELEASE_ID),
    {
      features: COUNTIES.map((county) => ({
        geometry: { coordinates: [-105.1, 39.7], type: "Point" as const },
        properties: { fips: county.fips },
        type: "Feature" as const,
      })),
      type: "FeatureCollection" as const,
    }
  );
  return queryClient;
}

function picture(
  queryClient: QueryClient,
  settings: ScoreSettings,
  mapLayer: "boundaries" | "gap_score" | "tick_status"
) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReviewNationalPicture
        counties={countyReferenceFromScoreSummaries(COUNTIES)}
        countiesError={false}
        countiesLoading={false}
        county="08021"
        countyQuery=""
        mapLayer={mapLayer}
        period={null}
        releaseId={RELEASE_ID}
        releaseStates={[{ code: "CO", name: "Colorado" }]}
        scenarioSettings={settings}
        tierRelease={{ status: "unknown" }}
        onCountyChange={() => {}}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

describe("national Explorer what-if map", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty("--map-ramp-1");
    document.documentElement.style.removeProperty("--explorer-boundary");
  });

  it("recolors a national gap-score county without a national rank or Alaska fill", async () => {
    installRamps();
    const queryClient = client();
    const view = render(
      picture(queryClient, SCENARIO_SCORE_DEFAULTS, "gap_score")
    );
    const region = () => screen.getByTestId("review-national-map-region");
    await waitFor(() => {
      expect(featureColor(region(), "08021")).toBe("#55a8a3");
    });
    view.rerender(
      picture(
        queryClient,
        { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 },
        "gap_score"
      )
    );
    await waitFor(() => {
      expect(featureColor(region(), "08021")).toBe(RAMP);
    });
    const legend = screen.getByTestId("explorer-map-legend").textContent ?? "";
    const row = screen
      .getAllByTestId("national-published-county")
      .find((entry) => entry.dataset.fips === "08021");
    expect({
      adams: featureColor(region(), "08001"),
      alaska: featureColor(region(), "02020"),
      nationalAverage: legend.toLowerCase().includes("national average"),
      nationalScore: legend.toLowerCase().includes("national score"),
      rank: row?.textContent?.includes("Scenario rank") ?? true,
      published: row?.textContent?.includes("Published score 22.9") ?? false,
    }).toStrictEqual({
      adams: "#a9d2db",
      alaska: "",
      nationalAverage: false,
      nationalScore: false,
      rank: false,
      published: true,
    });
    expect(legend).toContain("Adjusted scenario");
    expect(row?.textContent).toContain("Adjusted scenario 12.2");
  });

  it("keeps a limited county on its governed color", async () => {
    installRamps();
    const queryClient = client();
    render(
      picture(
        queryClient,
        { ...SCENARIO_SCORE_DEFAULTS, low_incidence_breakpoint: 20 },
        "gap_score"
      )
    );
    const region = () => screen.getByTestId("review-national-map-region");
    await waitFor(() => {
      expect(featureColor(region(), "08021")).toBe("#55a8a3");
    });
    expect({
      adams: featureColor(region(), "08001"),
      legend: screen.getByTestId("explorer-map-legend").textContent ?? "",
    }).toMatchObject({
      adams: "#a9d2db",
    });
    expect(screen.getByTestId("explorer-map-legend").textContent).toContain(
      "keep the governed score and color"
    );
  });

  it("leaves tick status and boundaries on their governed presentation", async () => {
    installRamps();
    const queryClient = client();
    const view = render(
      picture(
        queryClient,
        { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 },
        "tick_status"
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("explorer-map-layer").textContent).toContain(
        "Blacklegged tick status"
      );
    });
    expect(
      screen.getByRole("heading", { name: "Explore county patterns" })
    ).toBeTruthy();
    const region = () => screen.getByTestId("review-national-map-region");
    expect({
      color: featureColor(region(), "08021"),
      legend: screen.getByTestId("explorer-map-legend").textContent ?? "",
    }).toMatchObject({
      legend: expect.not.stringContaining("Adjusted scenario"),
    });
    expect(featureColor(region(), "08021")).not.toBe(RAMP);

    view.rerender(
      picture(
        queryClient,
        { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 },
        "boundaries"
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("explorer-map-layer").textContent).toContain(
        "County boundaries"
      );
    });
    expect(screen.getByTestId("explorer-map-legend").textContent).not.toContain(
      "Adjusted scenario"
    );
  });
});
