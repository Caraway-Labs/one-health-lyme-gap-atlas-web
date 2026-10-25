import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import {
  constraintRow,
  constraintTables,
  pinnedParameterPattern,
  provenanceUnionRows,
} from "../docs-llms-gfm";

const publicOpenApiManifest = JSON.parse(
  readFileSync("contracts/public-openapi.manifest.json", "utf-8")
) as { sha256: string; sourceCommit: string };

test("serves a stable llms.txt index and the current full docs export", async ({
  request,
}) => {
  const indexResponse = await request.get("/llms.txt");
  expect(indexResponse.status()).toBe(200);
  expect(indexResponse.headers()["content-type"]).toContain("text/markdown");
  const index = await indexResponse.text();
  expect(index).toContain("# One Health Atlas documentation");
  expect(index).toContain(
    "](https://onehealthatlas.org/docs/releases-and-methodology)"
  );
  expect(index).toContain("](https://onehealthatlas.org/llms-full.txt)");
  expect(index).toContain("Append `.md`");
  expect(index).not.toContain("PRIVATE KEY");
  const indexAgain = await (await request.get("/llms.txt")).text();
  expect(indexAgain).toBe(index);

  const fullResponse = await request.get("/llms-full.txt");
  expect(fullResponse.status()).toBe(200);
  expect(fullResponse.headers()["content-type"]).toContain("text/markdown");
  const full = await fullResponse.text();
  expect(full).toContain(publicOpenApiManifest.sourceCommit);
  expect(full).toContain(publicOpenApiManifest.sha256);
  expect(full).toContain("It is not a diagnosis");
  expect(full).toContain("lower 48 states and the District of Columbia");
  expect(full).toContain("https://onehealthatlas.org/docs/api-reference");
  expect(full).not.toContain("-----BEGIN");
  expect(full).not.toContain("SUPABASE_SERVICE_ROLE");
  const fullAgain = await (await request.get("/llms-full.txt")).text();
  expect(fullAgain).toBe(full);
});

test("serves processed Markdown and current MDX for one page", async ({
  request,
}) => {
  const processed = await request.get("/docs/releases-and-methodology.md");
  expect(processed.status()).toBe(200);
  expect(processed.headers()["content-type"]).toContain("text/markdown");
  const processedText = await processed.text();
  expect(processedText).toContain(
    "# Releases and methodology labels (https://onehealthatlas.org/docs/releases-and-methodology)"
  );
  expect(processedText).toContain("Evidence snapshot");
  expect(processedText).toContain("It is not a diagnosis");
  expect(processedText).not.toContain("title: Releases and methodology labels");

  const raw = await request.get("/docs/releases-and-methodology.mdx");
  expect(raw.status()).toBe(200);
  const rawText = await raw.text();
  expect(rawText).toContain("title: Releases and methodology labels");
  expect(rawText).toContain("Evidence snapshot");

  const reference = await request.get("/docs/api-reference.md");
  expect(reference.status()).toBe(200);
  const referenceText = await reference.text();
  expect(referenceText).toContain(publicOpenApiManifest.sourceCommit);
  expect(referenceText).toContain(publicOpenApiManifest.sha256);
  expect(referenceText).toContain(
    "https://api.onehealthatlas.org/openapi.json"
  );

  const referenceSource = await request.get("/docs/api-reference.mdx");
  expect(await referenceSource.text()).toContain(
    publicOpenApiManifest.sourceCommit
  );

  const indexPage = await request.get("/docs.md");
  expect(indexPage.status()).toBe(200);
  expect(await indexPage.text()).toContain("Start with One Health Atlas");

  const missing = await request.get("/docs/not-a-published-page.md");
  expect(missing.status()).toBe(404);
});

const observationsMarkdownPath =
  "/docs/api-reference/observations/listObservations.md";

test("renders operation pages, guardrails, and client examples into Markdown", async ({
  request,
}) => {
  const observations = await request.get(observationsMarkdownPath);
  expect(observations.status()).toBe(200);
  const observationsText = await observations.text();
  expect(observationsText).toContain("#### geography_id");
  expect(observationsText).toContain("query, required.");
  expect(observationsText).toContain('"08001"');
  const observationTables = constraintTables(observationsText);
  expect(observationsText).toContain("#### page_size");
  expect(constraintRow(observationTables, "Default", "100")).toEqual([
    "Default",
    "100",
  ]);
  expect(constraintRow(observationTables, "Minimum", "1")).toEqual([
    "Minimum",
    "1",
  ]);
  expect(constraintRow(observationTables, "Maximum", "500")).toEqual([
    "Maximum",
    "500",
  ]);
  expect(observationsText).toContain("- Media type: `application/json`");
  expect(observationsText).toContain(
    "- Media type: `application/problem+json`"
  );
  expect(observationsText).toContain(
    "- Header `Retry-After`: Seconds to wait before you retry. Wait that long when the header is present."
  );
  expect(observationsText).not.toContain("<OpenAPIPage");

  const mcp = await (await request.get("/docs/develop/mcp-clients.md")).text();
  expect(mcp).toContain("Missing is not zero.");
  expect(mcp).not.toContain("<InterpretationGuardrailCopy");

  const quickstart = await (
    await request.get("/docs/develop/quickstart.md")
  ).text();
  expect(quickstart).toContain("curl -fsS");
  expect(quickstart).toContain("import httpx");
  expect(quickstart).toContain("library(httr2)");
  expect(quickstart).toContain("await fetch");
  expect(quickstart).not.toContain("<HttpClientTabs");

  const full = await (await request.get("/llms-full.txt")).text();
  const fullTables = constraintTables(full);
  expect(full).toContain("#### geography_id");
  expect(constraintRow(fullTables, "Default", "100")).toEqual([
    "Default",
    "100",
  ]);
  expect(constraintRow(fullTables, "Minimum", "1")).toEqual(["Minimum", "1"]);
  expect(constraintRow(fullTables, "Maximum", "500")).toEqual([
    "Maximum",
    "500",
  ]);
  expect(full).toContain("- Media type: `application/json`");
  expect(full).toContain("- Media type: `application/problem+json`");
  expect(full).toContain(
    "- Header `Retry-After`: Seconds to wait before you retry. Wait that long when the header is present."
  );
  expect(full).toContain("Missing is not zero.");
  expect(full).toContain("import httpx");
  expect(full).toContain("library(httr2)");
  expect(full).toContain("await fetch");
  expect(full).not.toContain("<InterpretationGuardrailCopy");
  expect(full).not.toContain("<HttpClientTabs");
  expect(full).not.toContain("<OpenAPIPage");
});

test("keeps schema constraints inside parsed table cells", async ({
  request,
}) => {
  const ranking = await (
    await request.get("/docs/api-reference/atlas/downloadAtlasRanking.md")
  ).text();
  const full = await (await request.get("/llms-full.txt")).text();
  for (const markdown of [ranking, full]) {
    const tables = constraintTables(markdown);
    expect(constraintRow(tables, "Pattern", "^(ALL|[A-Z]{2})$")).toEqual([
      "Pattern",
      "^(ALL|[A-Z]{2})$",
    ]);
    expect(
      constraintRow(tables, "Enum", "all, ecological, human, complete")
    ).toEqual(["Enum", "all, ecological, human, complete"]);
    expect(constraintRow(tables, "Maximum length", "100")).toEqual([
      "Maximum length",
      "100",
    ]);
    expect(constraintRow(tables, "Multiple of", "5")).toEqual([
      "Multiple of",
      "5",
    ]);
    expect(
      tables.every((table) => table.every((row) => row.length === 2))
    ).toBeTruthy();
  }
});

test("matches pinned FIPS and template patterns exactly", async ({
  request,
}) => {
  const fipsPattern = pinnedParameterPattern("/v1/counties/{fips}", "fips");
  const templatePattern = pinnedParameterPattern(
    "/v1/counties/{fips}/report.pdf",
    "template"
  );
  const county = await (
    await request.get("/docs/api-reference/counties/getCounty.md")
  ).text();
  const pdf = await (
    await request.get("/docs/api-reference/counties/downloadCountyReport.md")
  ).text();
  const tier1 = await (
    await request.get("/docs/api-reference/counties/getCountyTier1Priority.md")
  ).text();
  const full = await (await request.get("/llms-full.txt")).text();
  for (const markdown of [county, pdf, tier1, full]) {
    expect(
      constraintRow(constraintTables(markdown), "Pattern", fipsPattern)
    ).toEqual(["Pattern", fipsPattern]);
  }
  for (const markdown of [pdf, full]) {
    expect(
      constraintRow(constraintTables(markdown), "Pattern", templatePattern)
    ).toEqual(["Pattern", templatePattern]);
  }
});

test("keeps provenance union types inside parsed table cells", async ({
  request,
}) => {
  const page = await (await request.get("/docs/develop/provenance.md")).text();
  const full = await (await request.get("/llms-full.txt")).text();
  for (const markdown of [page, full]) {
    const { fiveTimestamps, fourTimestamps, value } =
      provenanceUnionRows(markdown);
    expect(value).toEqual([
      "value",
      "number | string | null",
      "yes",
      "The reported value. Read it with `value_state` and `unit`. `null` never means zero.",
    ]);
    expect(fourTimestamps.map((row) => [row[0], row[1], row[2]])).toEqual([
      ["atlas_acquired_at", "date-time | null", "no"],
      ["atlas_processed_at", "date-time | null", "no"],
      ["source_published_at", "date-time | null", "no"],
    ]);
    expect(fourTimestamps.map((row) => row[3])).toEqual([
      "When Atlas retrieved the data from the publisher. Includes a UTC offset. `null` when not recorded.",
      "When Atlas processed the data. Includes a UTC offset. It is not the response time. `null` when not recorded.",
      "When the publisher published the data. Includes a UTC offset. `null` when not recorded; do not assume the data is fresh.",
    ]);
    expect(fiveTimestamps.map((row) => [row[0], row[2], row.length])).toEqual([
      ["published_at", "date-time | null", 5],
      ["atlas_processed_at", "date-time | null", 5],
      ["upstream_updated_at", "date-time | null", 5],
      ["source_retrieved_at", "date-time | null", 5],
    ]);
    expect(fiveTimestamps[0]?.[4]).toBe(
      "Deprecated. Use `upstream_updated_at`. When the publisher published the data. The observation publisher timestamp is source_published_at."
    );
  }
});
