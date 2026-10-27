import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const NULL_STATES = new Set(["MISSING", "SUPPRESSED", "UNAVAILABLE"]);
const RETRYABLE_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 4;

interface ObservationRecord {
  geographyId: string;
  releaseId: string;
  value: number | string | null;
  valueState: string;
}

export const retryableStatuses = RETRYABLE_STATUSES;

export function retryDelaySeconds(
  header: string | null,
  attempt: number
): number {
  if (header !== null && header.trim() !== "") {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  }
  const base = Math.min(60, 2 ** (attempt - 1));
  const jitter = Math.random() * Math.min(1, base * 0.1);
  return Math.min(60, base + jitter);
}

export async function runValueState(): Promise<string> {
  const { notes, rows } = await fetchObservations([
    ["measure_id", "case_count_floor_2023"],
    ["geography_type", "county"],
    ["geography_id", "08001"],
    ["geography_id", "36061"],
    ["year", "2023"],
  ]);
  assertFips(rows);
  assertNullStates(rows);
  return `${notes.join("")}${renderTable(rows)}`;
}

async function fetchObservations(
  params: readonly (readonly [string, string])[]
): Promise<{ notes: string[]; rows: ObservationRecord[] }> {
  const notes: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(collectionUrl(params), {
      signal: AbortSignal.timeout(30_000),
    });
    if (RETRYABLE_STATUSES.has(response.status)) {
      const code = await problemCode(response);
      const delay = retryDelaySeconds(
        response.headers.get("Retry-After"),
        attempt
      );
      const codeText = code === undefined ? "" : ` ${code}`;
      notes.push(
        `retry: ${response.status}${codeText} ${formatDelay(delay)}\n`
      );
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Atlas HTTP ${response.status} after ${MAX_ATTEMPTS} attempts`
        );
      }
      await delaySeconds(delay);
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `Atlas HTTP ${response.status} ${await problemDetail(response)}`
      );
    }
    return { notes, rows: await readRows(response) };
  }
  throw new Error("Atlas retry loop ended");
}

function collectionUrl(params: readonly (readonly [string, string])[]): URL {
  const base = (
    process.env.ATLAS_API_BASE_URL ?? "https://api.onehealthatlas.org"
  ).replace(/\/$/u, "");
  const url = new URL("/v1/observations", `${base}/`);
  for (const [name, value] of params) url.searchParams.append(name, value);
  return url;
}

async function readRows(response: Response): Promise<ObservationRecord[]> {
  assertMedia(response, "application/json");
  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    throw new Error("Atlas response is missing data or meta");
  }
  return body.data.map(readObservation);
}

function readObservation(value: unknown): ObservationRecord {
  if (!isRecord(value) || !isRecord(value.geography)) {
    throw new Error("Atlas observation is missing geography");
  }
  const geographyId = value.geography.geography_id;
  const releaseId = value.release_id;
  const valueState = value.value_state;
  if (
    typeof geographyId !== "string" ||
    typeof releaseId !== "string" ||
    typeof valueState !== "string"
  ) {
    throw new TypeError(
      "Atlas observation is missing geography_id, value_state, or release_id"
    );
  }
  return {
    geographyId,
    releaseId,
    value: readReportedValue(value.value),
    valueState,
  };
}

function readReportedValue(value: unknown): number | string | null {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  throw new Error("Atlas value is not a number, string, or null");
}

async function problemCode(response: Response): Promise<string | undefined> {
  const problem = await problemBody(response);
  return typeof problem?.code === "string" ? problem.code : undefined;
}

async function problemDetail(response: Response): Promise<string> {
  const problem = await problemBody(response);
  return typeof problem?.detail === "string" ? problem.detail : "";
}

async function problemBody(
  response: Response
): Promise<Record<string, unknown> | undefined> {
  if (mediaType(response) !== "application/problem+json") return undefined;
  const body: unknown = await response.json();
  return isRecord(body) ? body : undefined;
}

function assertMedia(response: Response, expected: string): void {
  if (mediaType(response) !== expected) {
    throw new Error(
      `Atlas Content-Type was ${mediaType(response) ?? "missing"}`
    );
  }
}

function mediaType(response: Response): string | undefined {
  return response.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
}

function assertFips(rows: readonly ObservationRecord[]): void {
  for (const row of rows) {
    if (!/^\d{5}$/u.test(row.geographyId)) {
      throw new Error(
        `FIPS must stay a 5-character string, got ${row.geographyId}`
      );
    }
  }
}

function assertNullStates(rows: readonly ObservationRecord[]): void {
  for (const row of rows) {
    if (!NULL_STATES.has(row.valueState) || row.value === null) continue;
    throw new Error(
      `${row.valueState} for ${row.geographyId} was ${String(row.value)}, not null`
    );
  }
}

function renderTable(rows: readonly ObservationRecord[]): string {
  const releaseId = rows[0]?.releaseId;
  if (!releaseId) throw new Error("Atlas response had no rows");
  const lines = [
    `release_id: ${releaseId}`,
    "geography_id,value,value_state,release_id",
  ];
  for (const row of rows) {
    lines.push(
      `${row.geographyId},${formatValue(row.value)},${row.valueState},${row.releaseId}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function formatValue(value: number | string | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (!Number.isFinite(value)) throw new Error("Atlas value is not finite");
  if (Number.isInteger(value)) return String(value);
  return JSON.stringify(value);
}

function formatDelay(delay: number): string {
  return Number.isInteger(delay) ? String(delay) : String(delay);
}

function delaySeconds(seconds: number): Promise<void> {
  return delay(seconds * 1000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  try {
    process.stdout.write(await runValueState());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
