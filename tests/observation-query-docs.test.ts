import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  observationCurl,
  observationRequestUrl,
} from "@/features/docs/observation-query-example";

const page = fs.readFileSync(
  path.join(process.cwd(), "content/docs/develop/observation-queries.mdx"),
  "utf-8"
);

const sliceLabels = [
  "Annual surveillance",
  "Cumulative vector and pathogen",
  "January 2025 environment",
  "Land cover",
  "2022 SVI and ACS",
  "2023 RUCC",
] as const;

const sliceIds = [
  "annual-surveillance",
  "cumulative-vector-and-pathogen",
  "january-2025-environment",
  "land-cover",
  "2022-svi-and-acs",
  "2023-rucc",
] as const;

describe("observation query documentation", () => {
  it("persists one Fumadocs tab group whose values match the item labels", () => {
    expect(page).toContain('groupId="atlas-observation-slice"');
    expect(page).toContain("persist");
    expect(page).toContain('from "fumadocs-ui/components/tabs"');
    const itemsBody = page.match(/items=\{\[(?<body>[^\]]+)\]\}/u)?.groups
      ?.body;
    const items = [...(itemsBody ?? "").matchAll(/"(?<label>[^"]+)"/gu)].map(
      (match) => match.groups?.label
    );
    const tabs = [
      ...page.matchAll(/<Tab forceMount value="(?<label>[^"]+)">/gu),
    ];
    const headings = [...page.matchAll(/^\s*### (?<heading>.+)$/gmu)].map(
      (match) => match.groups?.heading
    );
    expect({
      headings,
      items,
      labels: tabs.map((match) => match.groups?.label),
      panelIds: page.match(/<Tab[^>]*\sid="/u),
      slugs: headings.map((heading) =>
        heading?.toLowerCase().replaceAll(" ", "-")
      ),
    }).toStrictEqual({
      headings: [...sliceLabels],
      items: [...sliceLabels],
      labels: [...sliceLabels],
      panelIds: null,
      slugs: [...sliceIds],
    });
  });

  it("names supported and rejected temporal parameters from the checked contract", () => {
    const required = [
      "UNSUPPORTED_FILTER",
      "UNSUPPORTED_STRATIFICATION",
      "INVALID_REQUEST",
      "NO_PUBLISHED_RESULTS",
      "This measure does not support vintage_year.",
      "Supply vintage_year for county context.",
      "Unsupported county context time selection.",
      "CDC status is cumulative as published; omit year and use start_date=end_date=2025-12-31.",
      "lower 48 states and the District of Columbia",
      "not a zero",
      "not individual risk",
    ];
    const missing = required.filter((phrase) => !page.includes(phrase));
    expect(missing).toStrictEqual([]);
    expect(page).not.toMatch(/Alaska|Hawaii|\b(?:AK|HI)\b/);
  });

  it("builds observation curls from the published API origin", () => {
    const query =
      "measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023";
    expect(observationRequestUrl(query)).toBe(
      `https://api.onehealthatlas.org/v1/observations?${query}`
    );
    expect(
      observationRequestUrl(query, {
        NEXT_PUBLIC_API_BASE_URL: "https://preview.example",
      })
    ).toBe(`https://preview.example/v1/observations?${query}`);
    expect(observationCurl(query)).toBe(
      `curl -fsS 'https://api.onehealthatlas.org/v1/observations?${query}'`
    );
    expect(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "src/features/docs/observation-query-example.tsx"
        ),
        "utf-8"
      )
    ).not.toContain("https://api.onehealthatlas.org");
    expect(page).toContain(`<ObservationCurl query="${query}" />`);
  });
});
