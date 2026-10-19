import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

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
  expect(index).toContain("# Atlas documentation");
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
  expect(await indexPage.text()).toContain("Start with Atlas Lyme");

  const missing = await request.get("/docs/not-a-published-page.md");
  expect(missing.status()).toBe(404);
});

const observationsMarkdownPath =
  "/docs/api-reference/observations/observations_v1_observations_get.md";

test("renders operation pages, guardrails, and client examples into Markdown", async ({
  request,
}) => {
  const observations = await request.get(observationsMarkdownPath);
  expect(observations.status()).toBe(200);
  const observationsText = await observations.text();
  expect(observationsText).toContain("#### geography_id");
  expect(observationsText).toContain("query, required.");
  expect(observationsText).toContain('"08001"');
  expect(observationsText).toContain("#### page_size");
  expect(observationsText).toContain("- Default: 100");
  expect(observationsText).toContain("- Minimum: 1");
  expect(observationsText).toContain("- Maximum: 500");
  expect(observationsText).toContain("- Media type: `application/json`");
  expect(observationsText).toContain(
    "- Media type: `application/problem+json`"
  );
  expect(observationsText).toContain(
    "- Header `Retry-After`: Seconds before retry when supplied by the service."
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
  expect(full).toContain("#### geography_id");
  expect(full).toContain("- Default: 100");
  expect(full).toContain("- Minimum: 1");
  expect(full).toContain("- Maximum: 500");
  expect(full).toContain("- Media type: `application/json`");
  expect(full).toContain("- Media type: `application/problem+json`");
  expect(full).toContain(
    "- Header `Retry-After`: Seconds before retry when supplied by the service."
  );
  expect(full).toContain("Missing is not zero.");
  expect(full).toContain("import httpx");
  expect(full).toContain("library(httr2)");
  expect(full).toContain("await fetch");
  expect(full).not.toContain("<InterpretationGuardrailCopy");
  expect(full).not.toContain("<HttpClientTabs");
  expect(full).not.toContain("<OpenAPIPage");
});
