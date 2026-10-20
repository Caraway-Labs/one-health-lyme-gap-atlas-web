import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { countyReferenceFromScoreSummaries } from "@/features/ux-reset/review/explorer-county-reference";
import { EXPLORER_NATIONAL_COUNTY_SHORTLIST_LENGTH } from "@/features/ux-reset/review/explorer-ranked-counties";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
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

function score(
  fips: string,
  state: string,
  stateName: string,
  total: number
): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#55a8a3",
    county: `County ${fips}`,
    evidence_completeness: 50,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 1,
      community: 1,
      ecological: 0,
      human_weakness: 1,
      pathogen_signal: 0,
      rural_signal: 1,
      score: total,
      svi_signal: 1,
      tick_signal: 0,
    },
    state,
    state_name: stateName,
    tick_status: "No records",
  };
}

function publishedCounties(): CountyScoreSummary[] {
  const colorado = Array.from({ length: 30 }, (_, index) =>
    score(
      `08${String(index + 1).padStart(3, "0")}`,
      "CO",
      "Colorado",
      100 - index
    )
  );
  const newYork = Array.from({ length: 20 }, (_, index) =>
    score(
      `36${String(index + 1).padStart(3, "0")}`,
      "NY",
      "New York",
      50 - index
    )
  );
  return [...colorado, ...newYork];
}

function renderPicture(mapFocus: string | null) {
  const counties = publishedCounties();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties,
      methodology_version: "1",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  client.setQueryData(countyDisplayGeometryQueryKey("atlas-home", RELEASE_ID), {
    features: [],
    type: "FeatureCollection",
  });
  render(
    <QueryClientProvider client={client}>
      <ReviewNationalPicture
        counties={countyReferenceFromScoreSummaries(counties)}
        countiesError={false}
        countiesLoading={false}
        county={null}
        countyQuery=""
        mapFocus={mapFocus}
        mapLayer="gap_score"
        period={null}
        releaseId={RELEASE_ID}
        tierRelease={{ status: "unknown" }}
        onCountyChange={() => {}}
        onMapFocusChange={() => {}}
        onMapLayerChange={() => {}}
      />
    </QueryClientProvider>
  );
}

function listedFips(): string[] {
  return screen
    .getAllByTestId("national-published-county")
    .map((row) => row.dataset.fips ?? "");
}

function expectCountiesHeadingOutsideRows(): void {
  const heading = screen.getByRole("heading", { name: "Counties" });
  const rowList = document.querySelector(".ux-reset-ranked-county-list");
  expect({
    duplicateEyebrow: document.querySelector(
      ".ux-reset-ranked-counties-eyebrow"
    ),
    insideRows: rowList?.contains(heading) ?? null,
    level: heading.tagName,
    redundantH1: screen.queryByRole("heading", { level: 1, name: "Counties" }),
  }).toStrictEqual({
    duplicateEyebrow: null,
    insideRows: false,
    level: "H2",
    redundantH1: null,
  });
}

describe("national county shortlist", () => {
  afterEach(() => {
    cleanup();
  });

  it("bounds the default national list and lists a focused state's counties", () => {
    renderPicture(null);
    const national = listedFips();
    const note = screen.getByTestId("explorer-national-shortlist-note");
    const list = document.querySelector(".ux-reset-explorer-list");
    expect({
      count: national.length,
      firstHeading: list?.querySelector("h1, h2, h3")?.textContent ?? "",
      localStateFilter: screen.queryByTestId("national-browse-state"),
      note: note.textContent,
      states: [...new Set(national.map((fips) => fips.slice(0, 2)))].toSorted(),
    }).toStrictEqual({
      count: EXPLORER_NATIONAL_COUNTY_SHORTLIST_LENGTH,
      firstHeading: "Counties",
      localStateFilter: null,
      note: "Showing the first 40 counties. Use the State control, or select a state on the map, to narrow this list.",
      states: ["08", "36"],
    });
    expect(within(note).queryByRole("combobox")).toBeNull();
    expectCountiesHeadingOutsideRows();

    cleanup();
    renderPicture("CO");
    expectCountiesHeadingOutsideRows();
    const colorado = listedFips();
    expect({
      count: colorado.length,
      note: screen.queryByTestId("explorer-national-shortlist-note"),
      states: [...new Set(colorado.map((fips) => fips.slice(0, 2)))],
    }).toStrictEqual({
      count: 30,
      note: null,
      states: ["08"],
    });

    cleanup();
    renderPicture("NY");
    expectCountiesHeadingOutsideRows();
    const newYork = listedFips();
    expect({
      count: newYork.length,
      states: [...new Set(newYork.map((fips) => fips.slice(0, 2)))],
    }).toStrictEqual({
      count: 20,
      states: ["36"],
    });
  });
});
