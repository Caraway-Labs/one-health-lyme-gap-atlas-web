// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vitest";

import {
  expandDocsComponents,
  markdownTableCell,
} from "../src/lib/docs-llms-components";
import { renderPublicDocsPage } from "../src/lib/docs-llms-export";
import {
  constraintRow,
  constraintTables,
  gfmTables,
  pinnedParameterPattern,
  provenanceUnionRows,
} from "./docs-llms-gfm";

const FRONTMATTER = /^---\n(?<frontmatter>[\s\S]*?)\n---\n?/;
const renderedPages = new Map<string, Promise<string>>();

async function renderedPage(relativePath: string): Promise<string> {
  const cached = renderedPages.get(relativePath);
  if (cached) return cached;
  const pending = renderPageFile(relativePath);
  renderedPages.set(relativePath, pending);
  return pending;
}

async function renderPageFile(relativePath: string): Promise<string> {
  const raw = readFileSync(relativePath, "utf-8");
  const frontmatter = FRONTMATTER.exec(raw)?.groups?.frontmatter ?? "";
  const title =
    /^title:\s*(?<title>.+)$/m.exec(frontmatter)?.groups?.title ?? "";
  const description =
    /^description:\s*(?<description>.+)$/m.exec(frontmatter)?.groups
      ?.description ?? "";
  const body = raw.replace(FRONTMATTER, "");
  const processed = await remark()
    .use(remarkMdx)
    .use(remarkLLMs, { _data: true })
    .process(body);
  const markdown =
    typeof processed.data.markdown === "string" ? processed.data.markdown : "";
  return renderPublicDocsPage({
    description: description.replaceAll(/^['"]|['"]$/g, ""),
    processed: expandDocsComponents(markdown, raw),
    title: title.replaceAll(/^['"]|['"]$/g, ""),
    url: `https://onehealthatlas.org/docs/${relativePath
      .replace(/^content\/docs\//, "")
      .replace(/\.mdx$/, "")}`,
  });
}

function mdxFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...mdxFiles(entryPath));
    else if (entry.name.endsWith(".mdx"))
      files.push(entryPath.split(path.sep).join("/"));
  }
  return files;
}

describe("rendered documentation markdown", () => {
  it("renders the observations geography_id parameter from the pinned contract", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/listObservations.mdx"
    );
    expect(markdown).toContain("#### geography_id");
    expect(markdown).toContain("query, required.");
    expect(markdown).toContain('"08001"');
    expect(markdown).not.toContain("<OpenAPIPage");
  });

  it("renders the observations page_size default and bounds", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/listObservations.mdx"
    );
    const tables = constraintTables(markdown);
    expect(markdown).toContain("#### page_size");
    expect(constraintRow(tables, "Default", "100")).toStrictEqual([
      "Default",
      "100",
    ]);
    expect(constraintRow(tables, "Minimum", "1")).toStrictEqual([
      "Minimum",
      "1",
    ]);
    expect(constraintRow(tables, "Maximum", "500")).toStrictEqual([
      "Maximum",
      "500",
    ]);
  });

  it("renders observations response media types and Retry-After", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/listObservations.mdx"
    );
    expect(markdown).toContain("- Media type: `application/json`");
    expect(markdown).toContain("- Media type: `application/problem+json`");
    expect(markdown).toContain(
      "- Header `Retry-After`: Seconds to wait before you retry. Wait that long when the header is present."
    );
    expect(markdown).toContain("CollectionEnvelope_CountyContextObservation_");
  });

  it("renders the published MCP interpretation guardrail", async () => {
    const markdown = await renderedPage("content/docs/develop/mcp-clients.mdx");
    expect(markdown).toContain("Interpret with care");
    expect(markdown).toContain("Missing is not zero.");
    expect(markdown).toContain(
      "A gap or a review priority is not risk or a diagnosis."
    );
    expect(markdown).not.toContain("<InterpretationGuardrailCopy");
  });

  it("renders runnable quickstart client examples", async () => {
    const markdown = await renderedPage("content/docs/develop/quickstart.mdx");
    expect(markdown).toContain("curl -fsS");
    expect(markdown).toContain("import httpx");
    expect(markdown).toContain("library(httr2)");
    expect(markdown).toContain("await fetch");
    expect(markdown).not.toContain("<HttpClientTabs");
  });

  it("renders quickstart steps and the labelled sample", async () => {
    const markdown = await renderedPage("content/docs/develop/quickstart.mdx");
    expect(markdown).toContain("### Make a request");
    expect(markdown).toContain("#### Show example response");
    expect(markdown).toContain("governed-2026-10-15-january-climate-prod");
    expect(markdown).toContain(
      "[Workflow guides](https://onehealthatlas.org/docs/develop/workflows)"
    );
    expect(markdown).not.toContain("On 12 October");
  });

  it("strips quickstart layout tags from the markdown export", async () => {
    const markdown = await renderedPage("content/docs/develop/quickstart.mdx");
    expect(markdown).toContain("Interpret with care");
    expect(markdown).not.toContain("<Callout");
    expect(markdown).not.toContain("<Card");
    expect(markdown).not.toContain("<Steps");
    expect(markdown).not.toContain("were checked");
  });

  it("renders the quickstart playground as an anonymous GET", async () => {
    const markdown = await renderedPage("content/docs/develop/quickstart.mdx");
    expect(markdown).toContain("Anonymous read-only playground.");
    expect(markdown).toContain(
      "GET https://api.onehealthatlas.org/v1/observations?measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023"
    );
    expect(markdown).not.toContain("<ApiPlayground");
  });

  it("keeps pipes, backticks, newlines, and plain-text backslashes in one cell", () => {
    const cell = markdownTableCell("number | `string`\nnull");
    const [table] = gfmTables(`| Type |\n| --- |\n| ${cell} |`);
    const slash = markdownTableCell("a\\b|c");
    const [slashTable] = gfmTables(`| Value |\n| --- |\n| ${slash} |`);
    expect(table?.[1]).toHaveLength(1);
    expect(table?.[1]?.[0]).toBe("number | `string` null");
    expect(slashTable?.[1]).toHaveLength(1);
    expect(slashTable?.[1]?.[0]).toBe("a\\b|c");
  });

  it("keeps the provenance value row to four parsed cells", async () => {
    const { value } = provenanceUnionRows(
      await renderedPage("content/docs/develop/provenance.mdx")
    );
    expect(value).toHaveLength(4);
    expect(value[1]).toBe("number | string | null");
    expect(value[2]).toBe("yes");
    expect(value[3]).toBe(
      "The reported value. Read it with `value_state` and `unit`. `null` never means zero."
    );
  });

  it("finds the provenance value row after schema tables in the full export", async () => {
    const schemas = await renderedPage(
      "content/docs/api-reference/schemas.mdx"
    );
    const provenance = await renderedPage(
      "content/docs/develop/provenance.mdx"
    );
    const { value } = provenanceUnionRows(`${schemas}\n\n${provenance}`);
    expect(value).toStrictEqual([
      "value",
      "number | string | null",
      "yes",
      "The reported value. Read it with `value_state` and `unit`. `null` never means zero.",
    ]);
    expect(schemas).toContain("| Name | Type | Required | Description |");
    expect(schemas).not.toContain("| Field | Type | Required | Description |");
  });

  it("keeps nullable timestamp rows in both provenance tables", async () => {
    const { fiveTimestamps, fourTimestamps } = provenanceUnionRows(
      await renderedPage("content/docs/develop/provenance.mdx")
    );
    expect(fourTimestamps.map((row) => row[0])).toStrictEqual([
      "atlas_acquired_at",
      "atlas_processed_at",
      "source_published_at",
    ]);
    expect(
      fourTimestamps.every(
        (row) =>
          row.length === 4 && row[1] === "date-time | null" && row[2] === "no"
      )
    ).toBeTruthy();
    expect(fiveTimestamps.map((row) => row[0])).toStrictEqual([
      "published_at",
      "atlas_processed_at",
      "upstream_updated_at",
      "source_retrieved_at",
    ]);
    expect(
      fiveTimestamps.every(
        (row) => row.length === 5 && row[2] === "date-time | null"
      )
    ).toBeTruthy();
    expect(fiveTimestamps[0]?.[4]).toBe(
      "Deprecated. Use `upstream_updated_at`. When the publisher published the data. The observation publisher timestamp is source_published_at."
    );
  });

  it("keeps pinned schema constraints in two-cell rows", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/atlas/downloadAtlasRanking.mdx"
    );
    const tables = constraintTables(markdown);
    expect(constraintRow(tables, "Pattern", "^(ALL|[A-Z]{2})$")).toStrictEqual([
      "Pattern",
      "^(ALL|[A-Z]{2})$",
    ]);
    expect(
      constraintRow(tables, "Enum", "all, ecological, human, complete")
    ).toStrictEqual(["Enum", "all, ecological, human, complete"]);
    expect(constraintRow(tables, "Maximum length", "100")).toStrictEqual([
      "Maximum length",
      "100",
    ]);
    expect(constraintRow(tables, "Multiple of", "5")).toStrictEqual([
      "Multiple of",
      "5",
    ]);
    expect(
      tables.every((table) => table.every((row) => row.length === 2))
    ).toBeTruthy();
  });

  it("matches pinned FIPS and template patterns exactly", async () => {
    const fipsPattern = pinnedParameterPattern("/v1/counties/{fips}", "fips");
    const templatePattern = pinnedParameterPattern(
      "/v1/counties/{fips}/report.pdf",
      "template"
    );
    const county = constraintTables(
      await renderedPage("content/docs/api-reference/counties/getCounty.mdx")
    );
    const pdf = constraintTables(
      await renderedPage(
        "content/docs/api-reference/counties/downloadCountyReport.mdx"
      )
    );
    const tier1 = constraintTables(
      await renderedPage(
        "content/docs/api-reference/counties/getCountyTier1Priority.mdx"
      )
    );
    expect(constraintRow(county, "Pattern", fipsPattern)).toStrictEqual([
      "Pattern",
      fipsPattern,
    ]);
    expect(constraintRow(pdf, "Pattern", fipsPattern)).toStrictEqual([
      "Pattern",
      fipsPattern,
    ]);
    expect(constraintRow(pdf, "Pattern", templatePattern)).toStrictEqual([
      "Pattern",
      templatePattern,
    ]);
    expect(constraintRow(tier1, "Pattern", fipsPattern)).toStrictEqual([
      "Pattern",
      fipsPattern,
    ]);
  });

  it("renders every current docs page without leftover component tags", async () => {
    const files = mdxFiles("content/docs");
    const pages = await Promise.all(files.map(renderedPage));
    const full = pages.join("\n\n");
    const observations =
      pages[
        files.indexOf(
          "content/docs/api-reference/observations/listObservations.mdx"
        )
      ] ?? "";
    expect(full).toContain("#### geography_id");
    expect(
      constraintRow(constraintTables(observations), "Default", "100")
    ).toStrictEqual(["Default", "100"]);
    expect(full).toContain("Missing is not zero.");
    expect(full).toContain("import httpx");
    expect(full).not.toContain("<OpenAPIPage");
  }, 20_000);
});
