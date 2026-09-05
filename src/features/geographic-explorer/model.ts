import { createParser, parseAsStringEnum } from "nuqs";

import type { CountyScoreSummary } from "@/generated/models";
import { atlasSearchParams } from "@/lib/atlas-search-params";
import { matchesEvidence } from "@/lib/atlas-ui";
import type { EvidenceView } from "@/lib/atlas-ui";

export const VIEWS = [
  "tiles",
  "multiples",
  "matrix",
  "ranking",
  "maps",
  "scatter",
  "compare",
  "trends",
] as const;
export type View = (typeof VIEWS)[number];
export type Metric = "score" | "completeness";
export const VIEW_LABELS: Record<View, string> = {
  tiles: "Geographic tiles",
  multiples: "Small multiples",
  matrix: "Evidence matrix",
  ranking: "Ranked dot plot",
  maps: "Side-by-side maps",
  scatter: "Map + scatterplot",
  compare: "County comparison",
  trends: "Release trends",
};
const FIPS = /^\d{5}$/;
export function parseComparison(value: string) {
  return [...new Set(value.split(",").filter((part) => FIPS.test(part)))].slice(
    0,
    5
  );
}
export const explorerParams = {
  ...atlasSearchParams,
  view: parseAsStringEnum<View>([...VIEWS]).withDefault("tiles"),
  metric: parseAsStringEnum<Metric>(["score", "completeness"]).withDefault(
    "score"
  ),
  selected: createParser({
    parse: parseComparison,
    serialize: (value) => value.join(","),
  }).withDefault([]),
  page: createParser({
    parse: (value) =>
      /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 10_000
        ? Number(value)
        : null,
    serialize: String,
  }).withDefault(1),
};

// Hand-authored schematic layout; positions are approximate, never coordinates.
const GRID_ROWS = [
  " . . . . . . . . . . . ME",
  " WA ID MT ND MN . WI . . VT NH .",
  " OR NV WY SD IA IL MI . NY MA . .",
  " CA UT CO NE MO IN OH PA NJ CT RI .",
  " . AZ NM KS AR KY WV VA MD DE . .",
  " . . . OK LA MS TN NC SC DC . .",
  " . . . TX . . AL GA . . . .",
  " AK HI . . . . . . FL . . .",
];
export const STATE_GRID = GRID_ROWS.flatMap((row, y) =>
  row
    .trim()
    .split(/\s+/)
    .flatMap((code, x) =>
      code === "." ? [] : [{ code, row: y + 1, column: x + 1 }]
    )
);
export function metricValue(county: CountyScoreSummary, metric: Metric) {
  return metric === "score" ? county.score.score : county.evidence_completeness;
}
export function metricLabel(metric: Metric) {
  return metric === "score"
    ? "County review score"
    : "Evidence completeness (%)";
}
export function metricMaximum() {
  return 100;
}

export function matchesExplorerEvidence(
  county: CountyScoreSummary,
  view: EvidenceView
) {
  // Alpha source: round(usable / 6 * 100); five of six inputs rounds to 83%.
  return view === "complete"
    ? county.evidence_completeness >= 83
    : matchesEvidence(county, view);
}
export function rankCounties(counties: CountyScoreSummary[], metric: Metric) {
  return [...counties].sort(
    (a, b) =>
      metricValue(b, metric) - metricValue(a, metric) ||
      a.fips.localeCompare(b.fips)
  );
}
export function pageOf<T>(items: T[], page: number, size = 20) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    current,
    pages,
    items: items.slice((current - 1) * size, current * size),
  };
}
export function evidenceLabel(value: string) {
  if (value === "published_count_floor") return "Published county count floor";
  if (value === "no_county_linked_record") return "No county-linked record";
  return value.replaceAll("_", " ");
}
