// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { remarkLLMs } from "fumadocs-core/mdx-plugins/remark-llms";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vitest";

import { expandDocsComponents } from "../src/lib/docs-llms-components";
import { renderPublicDocsPage } from "../src/lib/docs-llms-export";

const FRONTMATTER = /^---\n(?<frontmatter>[\s\S]*?)\n---\n?/;

async function renderedPage(relativePath: string): Promise<string> {
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
    else if (entry.name.endsWith(".mdx")) files.push(entryPath);
  }
  return files;
}

describe("rendered documentation markdown", () => {
  it("renders the observations geography_id parameter from the pinned contract", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/observations_v1_observations_get.mdx"
    );
    expect(markdown).toContain("#### geography_id");
    expect(markdown).toContain("query, required.");
    expect(markdown).toContain('"08001"');
    expect(markdown).not.toContain("<OpenAPIPage");
  });

  it("renders the observations page_size default and bounds", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/observations_v1_observations_get.mdx"
    );
    expect(markdown).toContain("#### page_size");
    expect(markdown).toContain("- Default: 100");
    expect(markdown).toContain("- Minimum: 1");
    expect(markdown).toContain("- Maximum: 500");
  });

  it("renders observations response media types and Retry-After", async () => {
    const markdown = await renderedPage(
      "content/docs/api-reference/observations/observations_v1_observations_get.mdx"
    );
    expect(markdown).toContain("- Media type: `application/json`");
    expect(markdown).toContain("- Media type: `application/problem+json`");
    expect(markdown).toContain(
      "- Header `Retry-After`: Seconds before retry when supplied by the service."
    );
    expect(markdown).toContain("CollectionEnvelope_CountyContextObservation_");
  });

  it("renders the published MCP interpretation guardrail", async () => {
    const markdown = await renderedPage("content/docs/develop/mcp-clients.mdx");
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

  it("renders every current docs page without leftover component tags", async () => {
    const pages = await Promise.all(mdxFiles("content/docs").map(renderedPage));
    const full = pages.join("\n\n");
    expect(full).toContain("#### geography_id");
    expect(full).toContain("- Default: 100");
    expect(full).toContain("Missing is not zero.");
    expect(full).toContain("import httpx");
    expect(full).not.toContain("<OpenAPIPage");
  });
});
