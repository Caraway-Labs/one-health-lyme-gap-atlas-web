// @vitest-environment node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";

import { remarkInclude } from "fumadocs-mdx/config";
import { remark } from "remark";
import remarkMdx from "remark-mdx";
import { describe, expect, it } from "vitest";

import {
  retryDelaySeconds as countyRetryDelay,
  runCountyTable,
} from "../src/features/docs/recipes/county-table";
import { startRecipeMock } from "../src/features/docs/recipes/mock-server";
import { runPageCollection } from "../src/features/docs/recipes/page-collection";
import {
  retryableStatuses,
  retryDelaySeconds,
  runValueState,
} from "../src/features/docs/recipes/value-state";

const recipeRuns = [runCountyTable, runPageCollection, runValueState] as const;

interface ScriptedResponse {
  body: string;
  headers?: Record<string, string>;
  status: number;
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const PROBLEM_HEADERS = {
  "Content-Type": "application/problem+json; charset=utf-8",
};

const keptObservation = {
  geography: { geography_id: "01001" },
  period_start: "2025-01-01",
  release_id: "rel",
  value: "kept",
  value_state: "OBSERVED",
};

const keptMeta = { next_page_token: null, release_id: "rel" };

function observationDocument(data?: unknown, meta?: unknown): string {
  return JSON.stringify({
    data: data ?? [keptObservation],
    meta: meta ?? keptMeta,
  });
}

function jsonResponse(body: string, status = 200): ScriptedResponse {
  return { body, headers: JSON_HEADERS, status };
}

async function withResponses(
  responses: readonly ScriptedResponse[],
  run: () => Promise<void>,
  mode: "cycle" | "sticky" = "sticky"
): Promise<void> {
  let index = 0;
  const server = createServer((_request, response: ServerResponse) => {
    const cursor =
      mode === "cycle"
        ? index % responses.length
        : Math.min(index, responses.length - 1);
    const next = responses[cursor];
    index += 1;
    if (!next) {
      response.writeHead(500);
      response.end("missing scripted response");
      return;
    }
    response.writeHead(next.status, next.headers ?? {});
    response.end(next.body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Scripted recipe server did not bind a TCP port");
  }
  const previous = process.env.ATLAS_API_BASE_URL;
  process.env.ATLAS_API_BASE_URL = `http://127.0.0.1:${address.port}/`;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ATLAS_API_BASE_URL;
    else process.env.ATLAS_API_BASE_URL = previous;
    server.close();
    await once(server, "close");
  }
}

async function recipeMessages(): Promise<string[]> {
  const messages: string[] = [];
  for (const run of recipeRuns) {
    try {
      messages.push(await run());
    } catch (error: unknown) {
      messages.push(error instanceof Error ? error.message : String(error));
    }
  }
  return messages;
}

async function runRecipeFile(
  script: string,
  baseUrl: string
): Promise<{ code: number | null; stderr: string; stdout: string }> {
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", script],
    {
      env: { ...process.env, ATLAS_API_BASE_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });
  const [code] = await once(child, "close");
  return {
    code: typeof code === "number" ? code : null,
    stderr: Buffer.concat(stderrChunks).toString("utf-8"),
    stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
  };
}

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

  it("reports problem details, plain failures, and exhausted retries", async () => {
    const problem = {
      body: JSON.stringify({
        code: "INVALID_PARAMETER",
        detail: "Bad filter",
        status: 422,
      }),
      headers: PROBLEM_HEADERS,
      status: 422,
    };
    const plain = {
      body: "nope",
      headers: { "Content-Type": "text/plain" },
      status: 400,
    };
    const limited = {
      body: JSON.stringify({ code: 1, detail: 2 }),
      headers: { ...PROBLEM_HEADERS, "Retry-After": "0" },
      status: 429,
    };
    const messages: string[] = [];
    await withResponses([problem], async () => {
      messages.push(...(await recipeMessages()));
    });
    await withResponses([plain], async () => {
      messages.push(...(await recipeMessages()));
    });
    await withResponses([limited], async () => {
      messages.push(...(await recipeMessages()));
    });
    expect(messages).toStrictEqual([
      "Atlas HTTP 422 Bad filter",
      "Atlas HTTP 422 Bad filter",
      "Atlas HTTP 422 Bad filter",
      "Atlas HTTP 400 ",
      "Atlas HTTP 400 ",
      "Atlas HTTP 400 ",
      "Atlas HTTP 429 after 4 attempts",
      "Atlas HTTP 429 after 4 attempts",
      "Atlas HTTP 429 after 4 attempts",
    ]);
  });

  it("rejects malformed rows and keeps a string value after a 503", async () => {
    const kept = jsonResponse(observationDocument());
    const unavailable = {
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", detail: "Busy" }),
      headers: { ...PROBLEM_HEADERS, "Retry-After": "0" },
      status: 503,
    };
    const failures = [
      jsonResponse("{}"),
      jsonResponse(observationDocument([null])),
      jsonResponse(
        observationDocument([
          {
            geography: { geography_id: 1001 },
            period_start: "2025-01-01",
            release_id: "rel",
            value: null,
            value_state: "MISSING",
          },
        ])
      ),
      jsonResponse(
        observationDocument([
          {
            geography: { geography_id: "01001" },
            period_start: "2025-01-01",
            release_id: "rel",
            value: true,
            value_state: "OBSERVED",
          },
        ])
      ),
      jsonResponse(
        observationDocument([
          {
            geography: { geography_id: "1001" },
            period_start: "2025-01-01",
            release_id: "rel",
            value: null,
            value_state: "MISSING",
          },
        ])
      ),
      jsonResponse(
        observationDocument([
          {
            geography: { geography_id: "01001" },
            period_start: "2025-01-01",
            release_id: "rel",
            value: 0,
            value_state: "SUPPRESSED",
          },
        ])
      ),
      { body: observationDocument(), status: 200 },
      jsonResponse(observationDocument([])),
    ];
    const messages: string[] = [];
    for (const failure of failures) {
      await withResponses([failure], async () => {
        messages.push(...(await recipeMessages()));
      });
    }
    await withResponses(
      [unavailable, kept],
      async () => {
        messages.push(...(await recipeMessages()));
      },
      "cycle"
    );
    const blankDelay = countyRetryDelay("  ", 1);
    const countyKept = [
      "retry: 503 SERVICE_UNAVAILABLE 0",
      "release_id: rel",
      "geography_id,value,value_state,release_id",
      "01001,kept,OBSERVED,rel",
      "",
    ].join("\n");
    const pageKept = [
      "retry: 503 SERVICE_UNAVAILABLE 0",
      "release_id: rel",
      "pages: 1",
      "next_page_token: null",
      "period_start,geography_id,value,value_state,release_id",
      "2025-01-01,01001,kept,OBSERVED,rel",
      "",
    ].join("\n");
    const pageEmpty = [
      "release_id: rel",
      "pages: 1",
      "next_page_token: null",
      "period_start,geography_id,value,value_state,release_id",
      "",
    ].join("\n");
    const missingDocument = "Atlas response is missing data or meta";
    const missingGeography = "Atlas observation is missing geography";
    const missingCountyField =
      "Atlas observation is missing geography_id, value_state, or release_id";
    const missingPageField = "Atlas observation is missing a required field";
    const badValue = "Atlas value is not a number, string, or null";
    const badFips = "FIPS must stay a 5-character string, got 1001";
    const suppressed = "SUPPRESSED for 01001 was 0, not null";
    const missingMedia = "Atlas Content-Type was missing";
    const noRows = "Atlas response had no rows";
    expect({
      blankDelayInRange: blankDelay >= 1 && blankDelay <= 1.1,
      messages,
      negativeDelay: countyRetryDelay("-1", 1) >= 1,
    }).toStrictEqual({
      blankDelayInRange: true,
      messages: [
        missingDocument,
        missingDocument,
        missingDocument,
        missingGeography,
        missingGeography,
        missingGeography,
        missingCountyField,
        missingPageField,
        missingCountyField,
        badValue,
        badValue,
        badValue,
        badFips,
        badFips,
        badFips,
        suppressed,
        suppressed,
        suppressed,
        missingMedia,
        missingMedia,
        missingMedia,
        noRows,
        pageEmpty,
        noRows,
        countyKept,
        pageKept,
        countyKept,
      ],
      negativeDelay: true,
    });
  });

  it("stops paging when the token stays set or is not text", async () => {
    const repeating = jsonResponse(
      observationDocument(undefined, {
        next_page_token: "again",
        release_id: "rel",
      })
    );
    const numericToken = jsonResponse(
      observationDocument(undefined, {
        next_page_token: 4,
        release_id: "rel",
      })
    );
    const missingRelease = jsonResponse(
      observationDocument(undefined, { next_page_token: null })
    );
    let pageStop = "";
    let tokenType = "";
    let release = "";
    await withResponses([repeating], async () => {
      try {
        await runPageCollection();
      } catch (error: unknown) {
        pageStop = error instanceof Error ? error.message : String(error);
      }
    });
    await withResponses([numericToken], async () => {
      try {
        await runPageCollection();
      } catch (error: unknown) {
        tokenType = error instanceof Error ? error.message : String(error);
      }
    });
    await withResponses([missingRelease], async () => {
      try {
        await runPageCollection();
      } catch (error: unknown) {
        release = error instanceof Error ? error.message : String(error);
      }
    });
    expect([pageStop, tokenType, release]).toStrictEqual([
      "Stopped after 100 pages because next_page_token was still set",
      "Atlas next_page_token is not a string or null",
      "Atlas response is missing release_id",
    ]);
  });

  it("answers unknown, rejected, and health requests on the recipe mock", async () => {
    const mock = await startRecipeMock();
    try {
      const method = await fetch(mock.url, { method: "POST" });
      const missing = await fetch(`${mock.url}/missing`);
      const health = await fetch(`${mock.url}/healthz`);
      const token = await fetch(
        `${mock.url}/v1/observations?measure_id=nclimgrid_tavg_county_day&geography_type=county&year=2025&page_size=2&geography_id=36061&page_token=not-the-captured-token`
      );
      const unknown = await fetch(`${mock.url}/v1/observations`);
      expect([
        method.status,
        await method.text(),
        missing.status,
        (await missing.json()).code,
        await health.text(),
        token.status,
        unknown.status,
      ]).toStrictEqual([
        405,
        "Method not allowed\n",
        404,
        "RESOURCE_NOT_FOUND",
        "ok\n",
        404,
        404,
      ]);
    } finally {
      await mock.close();
    }
  });

  it("runs the recipe files directly and the mock command", async () => {
    const mock = await startRecipeMock();
    const scripts = ["county-table.ts", "page-collection.ts", "value-state.ts"];
    const direct: string[] = [];
    try {
      for (const script of scripts) {
        const result = await runRecipeFile(
          path.join(recipeDirectory, script),
          mock.url
        );
        direct.push(`${result.code}:${result.stdout}`);
      }
    } finally {
      await mock.close();
    }
    const failed = await withResponsesResult();
    const cli = await runRecipeFile(
      path.join(recipeDirectory, "mock-server.ts"),
      "http://127.0.0.1"
    );
    expect({
      cli: cli.code === 1 && cli.stderr.includes("positive integer"),
      direct,
      failed: failed.code === 1 && failed.stderr.includes("Atlas HTTP 400"),
    }).toStrictEqual({
      cli: true,
      direct: [
        `0:${expectedOutput("county-table")}`,
        `0:${expectedOutput("page-collection")}`,
        `0:${expectedOutput("value-state")}`,
      ],
      failed: true,
    });
  });
});

async function withResponsesResult(): Promise<{
  code: number | null;
  stderr: string;
}> {
  let captured = { code: null as number | null, stderr: "" };
  await withResponses(
    [
      {
        body: "nope",
        headers: { "Content-Type": "text/plain" },
        status: 400,
      },
    ],
    async () => {
      captured = await runRecipeFile(
        path.join(recipeDirectory, "county-table.ts"),
        process.env.ATLAS_API_BASE_URL ?? ""
      );
    }
  );
  return captured;
}
