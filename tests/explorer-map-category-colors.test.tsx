import { Color, createExpression } from "@maplibre/maplibre-gl-style-spec";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EXPLORER_STATIC_EXTRA_COLOR_COUNT,
  resolveExplorerMapColor,
} from "@/features/ux-reset/review/explorer-map-layers";
import { ReviewNationalPicture } from "@/features/ux-reset/review/review-national-picture";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import { EXPLORER_SCORE_SETTINGS } from "@/features/ux-reset/review/use-explorer-map-scores";
import type { CountyScoreSummary } from "@/generated/models";
import { countyDisplayGeometryQueryKey } from "@/lib/county-geography";

import { buildStateReview } from "./fixtures/review-operating-picture-fixtures";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams("") as ReadonlyURLSearchParams,
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

const RELEASE_ID = "alpha-2026";
const EXTRA_STATUSES = [
  "Detected",
  "Suspect",
  "Possible",
  "Endemic",
  "Emerging",
  "Local",
  "Imported",
  "Widespread",
] as const;
const COUNTIES = [
  ["08001", "Detected"],
  ["08003", "Suspect"],
  ["08005", "Possible"],
  ["08007", "Endemic"],
  ["08009", "Emerging"],
  ["08011", "Local"],
  ["08013", "Imported"],
  ["08014", "Widespread"],
  ["08015", "Unknown"],
  ["08017", "Unavailable"],
] as const;
const STATUS_TOKENS: Record<string, string> = {
  "--atlas-muted-text": "#506772",
  "--explorer-boundary": "#e4e9ea",
  "--mint": "#dff1eb",
  "--navy": "#082a4d",
  "--navy-2": "#0d3b60",
  "--teal": "#0f7782",
  "--teal-dark": "#075760",
};

function scoreCounty(fips: string, tickStatus: string): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#a9d2db",
    county: "County",
    evidence_completeness: 40,
    fips,
    human_status: "published_count_floor",
    in_contiguous_tick_scope: true,
    priority: "Lower Atlas priority — Not a safety finding",
    score: {
      access_signal: 0.5,
      community: 0.5,
      ecological: 0.5,
      human_weakness: 0.5,
      pathogen_signal: 0.5,
      rural_signal: 0.5,
      score: 12,
      svi_signal: 0.5,
      tick_signal: 0.5,
    },
    state: "CO",
    state_name: "Colorado",
    tick_status: tickStatus,
  };
}

function installStatusTokens() {
  for (const [name, value] of Object.entries(STATUS_TOKENS)) {
    document.documentElement.style.setProperty(name, value);
  }
}

function clearStatusTokens() {
  for (const name of Object.keys(STATUS_TOKENS)) {
    document.documentElement.style.removeProperty(name);
  }
}

function featureColors(region: HTMLElement): Map<string, string> {
  const colors = new Map<string, string>();
  const raw = region.dataset.mapColors ?? "";
  for (const pair of raw.split(" ").filter(Boolean)) {
    const separator = pair.indexOf(":");
    colors.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return colors;
}

function specifiedBackground(swatch: Element): string {
  const style = swatch.getAttribute("style") ?? "";
  for (const marker of ["background-color:", "background:"]) {
    const start = style.indexOf(marker);
    if (start === -1) {
      continue;
    }
    const value = style.slice(start + marker.length);
    const end = value.indexOf(";");
    return (end === -1 ? value : value.slice(0, end)).trim();
  }
  return "";
}

function legendColor(legend: HTMLElement, label: string): string {
  for (const item of legend.querySelectorAll<HTMLElement>(
    "[data-legend-label]"
  )) {
    if (item.dataset.legendLabel !== label) {
      continue;
    }
    const swatch = item.querySelector("span");
    if (!swatch) {
      return "";
    }
    const specified = specifiedBackground(swatch);
    return resolveExplorerMapColor(specified) ?? specified;
  }
  return "";
}

function sameColor(left: string, right: string): boolean {
  const parsedLeft = Color.parse(left);
  const parsedRight = Color.parse(right);
  if (!(parsedLeft && parsedRight)) {
    return false;
  }
  return (
    Math.abs(parsedLeft.r - parsedRight.r) < 0.002 &&
    Math.abs(parsedLeft.g - parsedRight.g) < 0.002 &&
    Math.abs(parsedLeft.b - parsedRight.b) < 0.002
  );
}

function colorExpressionError(color: string): string | null {
  const created = createExpression(color, "paint.fill-color", {
    overridable: false,
    "property-type": "data-driven",
    transition: false,
    type: "color",
  });
  if (created.result === "success") {
    return null;
  }
  return created.value.map((error) => error.message).join(" ");
}

function audit(region: HTMLElement, legend: HTMLElement): string[] {
  const problems: string[] = [];
  const features = featureColors(region);
  const extraColors: string[] = [];
  for (const [fips, status] of COUNTIES) {
    const feature = features.get(fips) ?? "";
    if (!Color.parse(feature)) {
      problems.push(`${fips} color is not paintable: ${feature}`);
    }
    const expressionError = colorExpressionError(feature);
    if (expressionError) {
      problems.push(`${fips} ${expressionError}`);
    }
    if (feature.includes("color-mix(") || feature.startsWith("var(")) {
      problems.push(`${fips} still uses a CSS expression: ${feature}`);
    }
    const swatch = legendColor(legend, status);
    if (!sameColor(feature, swatch)) {
      problems.push(
        `${fips} legend ${swatch} does not match feature ${feature}`
      );
    }
    if (EXTRA_STATUSES.includes(status as (typeof EXTRA_STATUSES)[number])) {
      extraColors.push(feature);
    }
  }
  if (new Set(extraColors).size <= EXPLORER_STATIC_EXTRA_COLOR_COUNT) {
    problems.push("dynamic extra-category palette was not used");
  }
  return problems;
}

function cachedClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(
    ["ux-reset-review-scores", RELEASE_ID, EXPLORER_SCORE_SETTINGS],
    {
      counties: COUNTIES.map(([fips, status]) => scoreCounty(fips, status)),
      methodology_version: "semantic-1.0.0",
      release_id: RELEASE_ID,
      settings: EXPLORER_SCORE_SETTINGS,
    }
  );
  client.setQueryData(countyDisplayGeometryQueryKey("atlas-home", RELEASE_ID), {
    features: COUNTIES.map(([fips]) => ({
      geometry: { coordinates: [-105.1, 39.7], type: "Point" as const },
      properties: { fips },
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
  });
  client.setQueryData(["ux-reset-review-county-directory", RELEASE_ID], []);
  return client;
}

async function paintedProblems(
  client: QueryClient,
  scope: "national" | "state"
): Promise<string[]> {
  const view = render(
    <QueryClientProvider client={client}>
      {scope === "national" ? (
        <ReviewNationalPicture
          counties={[]}
          countiesError={false}
          countiesLoading={false}
          county={null}
          countyQuery=""
          mapLayer="tick_status"
          period={null}
          releaseId={RELEASE_ID}
          tierRelease={{ status: "unknown" }}
          onCountyChange={() => {}}
          onMapLayerChange={() => {}}
        />
      ) : (
        <ReviewOperatingPicture
          mapLayer="tick_status"
          review={buildStateReview({
            resultState: "none_stand_out",
            state: "CO",
          })}
          scopeCode="CO"
          stateName="Colorado"
        />
      )}
    </QueryClientProvider>
  );
  const region = await screen.findByTestId(
    scope === "national"
      ? "review-national-map-region"
      : "review-state-map-region"
  );
  await waitFor(() => {
    const colors = region.dataset.mapColors ?? "";
    if (!colors.includes("08001:")) {
      throw new Error(`map colors were not ready for ${scope}`);
    }
  });
  const problems = audit(region, screen.getByTestId("explorer-map-legend"));
  view.unmount();
  return problems;
}

describe("Explorer category colors on the map", () => {
  afterEach(() => {
    cleanup();
    clearStatusTokens();
  });

  it("paints extra categories, Unknown, and Unavailable at national and state scope", async () => {
    installStatusTokens();
    const client = cachedClient();
    const national = await paintedProblems(client, "national");
    const state = await paintedProblems(client, "state");
    expect({ national, state }).toStrictEqual({ national: [], state: [] });
  });
});
