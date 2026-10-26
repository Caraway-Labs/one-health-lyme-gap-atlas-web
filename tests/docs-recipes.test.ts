// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vitest";

import { runCountyTable } from "../src/features/docs/recipes/county-table";
import { startRecipeMock } from "../src/features/docs/recipes/mock-server";
import { runPageCollection } from "../src/features/docs/recipes/page-collection";
import {
  retryableStatuses,
  retryDelaySeconds,
  runValueState,
} from "../src/features/docs/recipes/value-state";

const root = process.cwd();
const recipeDirectory = path.join(root, "src/features/docs/recipes");

function readRecipe(name: string): string {
  return readFileSync(path.join(recipeDirectory, name), "utf-8");
}

function expectedOutput(name: string): string {
  return readFileSync(
    path.join(recipeDirectory, "expected", `${name}.txt`),
    "utf-8"
  );
}

describe("integration recipe sources", () => {
  it("embeds one source file per language and the captured output", async () => {
    const page = readFileSync(
      path.join(root, "content/docs/develop/recipes.mdx"),
      "utf-8"
    );
    const compiled = await remark()
      .use(remarkMdx)
      .use(remarkInclude)
      .process({
        path: path.join(root, "content/docs/develop/recipes.mdx"),
        value: page,
      });
    const rendered = String(compiled);
    const markers = [
      "import pandas as pd",
      "library(dplyr)",
      "runCountyTable",
      "01001,null,MISSING",
      "<RecipeLanguageTabs>",
      "](/docs/develop/errors)",
      "](/docs/develop/errors#retries)",
      "](/docs/develop/errors#value-states)",
      "](/docs/api-reference/observations)",
    ];
    const missing = markers.filter(
      (marker) => !rendered.includes(marker) && !page.includes(marker)
    );
    expect(missing).toStrictEqual([]);
    expect(rendered).not.toContain("<include");
  });

  it("keeps FIPS as strings and does not replace null with zero", () => {
    const sources = [
      "county-table.py",
      "county-table.R",
      "county-table.ts",
      "page-collection.py",
      "page-collection.R",
      "page-collection.ts",
      "value-state.py",
      "value-state.R",
      "value-state.ts",
    ].map(readRecipe);
    const problems = sources.flatMap((source) => {
      const failures = [
        source.includes("ATLAS_API_BASE_URL") ? "" : "missing base URL",
        source.includes("https://api.onehealthatlas.org")
          ? ""
          : "missing production origin",
        /fillna\(\s*0/u.test(source) ? "fillna(0)" : "",
        /as\.numeric\(\s*[^)]*geography_id/u.test(source) ? "numeric FIPS" : "",
        /Number\(\s*[^)]*geographyId/u.test(source) ? "numeric FIPS" : "",
      ];
      return failures.filter((failure) => failure.length > 0);
    });
    expect(problems).toStrictEqual([]);
    expect(retryableStatuses.has(503)).toBeTruthy();
    expect(retryableStatuses.has(400)).toBeFalsy();
  });

  it("waits for Retry-After and falls back when the header is absent", () => {
    expect(retryDelaySeconds("0", 1)).toBe(0);
    expect(retryDelaySeconds("30", 2)).toBe(30);
    const fallback = retryDelaySeconds(null, 1);
    expect(fallback).toBeGreaterThanOrEqual(1);
    expect(fallback).toBeLessThanOrEqual(1.1);
    expect(retryDelaySeconds("later", 7)).toBeLessThanOrEqual(60);
  });

  it("prints the captured sample from the local mock", async () => {
    const mock = await startRecipeMock();
    const previous = process.env.ATLAS_API_BASE_URL;
    process.env.ATLAS_API_BASE_URL = mock.url;
    try {
      const output = {
        county: await runCountyTable(),
        page: await runPageCollection(),
        valueState: await runValueState(),
      };
      expect(output).toStrictEqual({
        county: expectedOutput("county-table"),
        page: expectedOutput("page-collection"),
        valueState: expectedOutput("value-state"),
      });
      expect(output.county).toContain("01001,null,MISSING");
      expect(output.county).not.toContain(",0,MISSING");
    } finally {
      if (previous === undefined) delete process.env.ATLAS_API_BASE_URL;
      else process.env.ATLAS_API_BASE_URL = previous;
      await mock.close();
    }
  });
});
