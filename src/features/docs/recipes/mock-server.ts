import { once } from "node:events";
import { readFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const fixtureDirectory = path.join(import.meta.dirname, "fixtures");

const COUNTY_IDS = ["01001", "08001", "36061"] as const;
const VALUE_STATE_IDS = ["08001", "36061"] as const;

const countyBody = readFixture("county-observations.json");
const valueStateBody = readFixture("value-state-observations.json");
const page1Body = readFixture("page-1.json");
const page2Body = readFixture("page-2.json");
const rateLimitedBody = readFixture("rate-limited.json");
const page1Token = readToken(page1Body);

function readFixture(name: string): string {
  return readFileSync(path.join(fixtureDirectory, name), "utf-8");
}

function readToken(body: string): string {
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed) || !isRecord(parsed.meta)) {
    throw new Error("Page fixture is missing meta");
  }
  const token = parsed.meta.next_page_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Page fixture is missing next_page_token");
  }
  return token;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface RecipeMock {
  close: () => Promise<void>;
  url: string;
}

/**
 * Local observations server for the integration recipes.
 * The second captured page is stored with next_page_token null so a recipe
 * stops after those rows. The live January query keeps paging until null.
 * The value-state query returns one 429 with Retry-After, then 200.
 */
function createRecipeServer() {
  let valueStateAttempts = 0;
  return createServer((request, response) => {
    handle(request, response, () => {
      valueStateAttempts += 1;
      return valueStateAttempts;
    });
  });
}

export async function startRecipeMock(): Promise<RecipeMock> {
  const server = createRecipeServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Recipe mock did not bind a TCP port");
  }
  return {
    close: async () => {
      server.close();
      await once(server, "close");
    },
    url: `http://127.0.0.1:${address.port}`,
  };
}

function handle(
  request: IncomingMessage,
  response: ServerResponse,
  nextValueStateAttempt: () => number
): void {
  const host = request.headers.host ?? "127.0.0.1";
  const url = new URL(request.url ?? "/", `http://${host}`);
  if (request.method !== "GET") {
    sendText(response, 405, "Method not allowed\n");
    return;
  }
  if (url.pathname === "/healthz") {
    sendText(response, 200, "ok\n");
    return;
  }
  if (url.pathname !== "/v1/observations") {
    sendProblem(response, 404);
    return;
  }

  const measure = url.searchParams.get("measure_id");
  const geographyType = url.searchParams.get("geography_type");
  const year = url.searchParams.get("year");
  const ids = url.searchParams.getAll("geography_id");
  const pageSize = url.searchParams.get("page_size");
  const pageToken = url.searchParams.get("page_token");

  if (
    measure === "nclimgrid_tavg_county_day" &&
    geographyType === "county" &&
    year === "2025" &&
    pageSize === "2" &&
    sameIds(ids, ["36061"])
  ) {
    if (pageToken === null) {
      sendJson(response, 200, page1Body);
      return;
    }
    if (pageToken === page1Token) {
      sendJson(response, 200, page2Body);
      return;
    }
    sendProblem(response, 404);
    return;
  }

  if (
    measure === "case_count_floor_2023" &&
    geographyType === "county" &&
    year === "2023" &&
    pageToken === null &&
    pageSize === null &&
    sameIds(ids, COUNTY_IDS)
  ) {
    sendJson(response, 200, countyBody);
    return;
  }

  if (
    measure === "case_count_floor_2023" &&
    geographyType === "county" &&
    year === "2023" &&
    pageToken === null &&
    pageSize === null &&
    sameIds(ids, VALUE_STATE_IDS)
  ) {
    if (nextValueStateAttempt() === 1) {
      sendJson(response, 429, rateLimitedBody, {
        "Content-Type": "application/problem+json; charset=utf-8",
        "Retry-After": "0",
      });
      return;
    }
    sendJson(response, 200, valueStateBody);
    return;
  }

  sendProblem(response, 404);
}

function sameIds(
  actual: readonly string[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().join("\n") === [...expected].sort().join("\n")
  );
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

function sendProblem(response: ServerResponse, status: number): void {
  sendJson(
    response,
    status,
    `${JSON.stringify({
      code: "RESOURCE_NOT_FOUND",
      detail: "Recipe mock has no fixture for this request.",
      status,
      title: "Not found",
      type: "https://onehealthatlas.org/problems/http-404",
    })}\n`,
    { "Content-Type": "application/problem+json; charset=utf-8" }
  );
}

function sendText(
  response: ServerResponse,
  status: number,
  body: string
): void {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Recipe mock port must be a positive integer");
  }
  createRecipeServer().listen(port, "127.0.0.1");
}
