import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadInvestigatePdf } from "@/features/ux-reset/investigate/download-investigate-pdf";
import type { InvestigatePdfContext } from "@/features/ux-reset/investigate/investigate-next-step";
import { InvestigatePdfExport } from "@/features/ux-reset/investigate/investigate-pdf-export";
import { readDatedObservations } from "@/features/ux-reset/review/dated-observation-envelope";
import {
  countyReportPdfV1CountiesFipsReportPdfGet,
  stateReportPdfV1StatesStateReportPdfGet,
} from "@/generated/atlas";
import type { Observation } from "@/generated/models";
import { ObservationsV1ObservationsGetResponse } from "@/generated/zod/atlas";
import { apiMutator } from "@/lib/api-mutator";
import type { ScoreSettings } from "@/lib/atlas-ui";
import { downloadPdfReport } from "@/lib/pdf-export";

import {
  ADAMS_COUNTY_PDF_TEXT,
  BOULDER_COUNTY_PDF_TEXT,
  adamsCountyPdfFixture,
  boulderCountyPdfFixture,
  buildPdfFixture,
  openPdfFixture,
} from "./fixtures/county-report-pdf-fixture";
import {
  INVESTIGATE_TICK_LIMITATION,
  INVESTIGATE_TICK_MEASURE_ID,
  investigateObservationsFor,
} from "./fixtures/investigate-api-fixtures";

const ADAMS_DOWNLOAD_NAME = "atlas-county-08001-2023-01-01-2023-12-31.pdf";
const MATCHING_PDF = "A matching PDF is unavailable.";
const COLORADO_STATE_PDF_TEXT =
  "Colorado state export fixture. Test fixture only.";
const coloradoStatePdf = buildPdfFixture(COLORADO_STATE_PDF_TEXT);
const legacySettings: ScoreSettings = {
  ecological_share: 65,
  smooth_k: 50,
  missing_human_weakness: 75,
};

type ReportBody = "adams-pdf" | "boulder-pdf" | "empty" | "json" | "text";

type ResponseTransport = {
  body: ReportBody;
  cacheControl: string | null;
  contentDisposition: string | null;
  contentType: string | null;
  mode: "late-after-response" | "response";
  status: number;
};

type Transport =
  | ResponseTransport
  | {
      mode: "abort-before" | "abort-during" | "network" | "stale-before-report";
    };

type DownloadExpectation =
  | {
      filename: string;
      kind: "saved";
      observations: number;
      reports: number;
    }
  | {
      kind: "discarded";
      observations: number;
      reports: number;
    }
  | {
      kind: "rejected";
      message: string;
      observations: number;
      reports: number;
      status?: number;
    };

type DownloadCase = {
  expectation: DownloadExpectation;
  name: string;
  transport: Transport;
};

type MutatorExpectation =
  | { bytes: Uint8Array; kind: "blob" }
  | { kind: "json"; value: unknown }
  | { kind: "text"; value: string }
  | { kind: "error"; message: string; status: number };

type MutatorCase = {
  body: string;
  bytes?: Uint8Array;
  contentType: string | null;
  entry: "county" | "mutator" | "state";
  expectation: MutatorExpectation;
  name: string;
  path: string;
  status: number;
};

type LegacyExpectation =
  | { filename: string; kind: "saved" }
  | { kind: "discarded" }
  | { kind: "rejected"; message: string };

type LegacyCase = {
  body: "colorado-pdf" | "county-pdf" | "empty";
  contentDisposition: string | null;
  contentType: string;
  expectation: LegacyExpectation;
  identifier: string;
  level: "county" | "state";
  mode: "abort" | "network" | "response" | "stale-after-response";
  name: string;
  status: number;
};

let blobs: Blob[] = [];
let clicks: string[] = [];

function isBlobLike(value: unknown): value is Blob {
  if (value instanceof Blob) {
    return true;
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("size" in value) || typeof value.size !== "number") {
    return false;
  }
  return "arrayBuffer" in value && typeof value.arrayBuffer === "function";
}

const realmBytes = new WeakMap<Blob, Uint8Array>();

async function bytesFromBlob(blob: Blob): Promise<Uint8Array> {
  const known = realmBytes.get(blob);
  if (known) {
    return known;
  }
  return new Uint8Array(await blob.arrayBuffer());
}

function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect([...actual]).toStrictEqual([...expected]);
}

/**
 * jsdom and Node fetch each have a Blob realm. The downloader's Blob guard
 * uses the page realm, so a stubbed response exposes that Blob.
 */
function realmBlobResponse(response: Response): Response {
  const readBlob = response.blob.bind(response);
  Object.defineProperty(response, "blob", {
    value: async () => {
      const bytes = new Uint8Array(await (await readBlob()).arrayBuffer());
      const blob = new Blob([bytes], {
        type: response.headers.get("content-type") ?? "",
      });
      realmBytes.set(blob, bytes);
      return blob;
    },
  });
  return response;
}

function adamsObservations() {
  return ObservationsV1ObservationsGetResponse.parse({
    data: investigateObservationsFor({
      fips: "08001",
      measureId: INVESTIGATE_TICK_MEASURE_ID,
      scenario: "mixed",
    }),
    links: { self: "/v1/observations" },
    meta: { next_page_token: null },
  });
}

function adamsContext(
  observations: readonly Observation[]
): InvestigatePdfContext {
  return {
    caveats: [INVESTIGATE_TICK_LIMITATION],
    countyFips: "08001",
    observations,
    periods: ["2023"],
    releaseId: "alpha-2026",
    requestedPeriod: "2023-01-01",
    sources: ["Tick survey"],
  };
}

function responseTransport(
  overrides: Partial<ResponseTransport> = {}
): ResponseTransport {
  return {
    body: "adams-pdf",
    cacheControl: "no-store",
    contentDisposition: null,
    contentType: "application/pdf",
    mode: "response",
    status: 200,
    ...overrides,
  };
}

function saved(
  name: string,
  overrides: Partial<ResponseTransport> = {}
): DownloadCase {
  return {
    expectation: {
      filename: ADAMS_DOWNLOAD_NAME,
      kind: "saved",
      observations: 2,
      reports: 1,
    },
    name,
    transport: responseTransport(overrides),
  };
}

function rejected(
  name: string,
  transport: Transport,
  expectation: Omit<Extract<DownloadExpectation, { kind: "rejected" }>, "kind">
): DownloadCase {
  return {
    expectation: { kind: "rejected", ...expectation },
    name,
    transport,
  };
}

function discarded(
  name: string,
  transport: Transport,
  counts: { observations: number; reports: number }
): DownloadCase {
  return {
    expectation: { kind: "discarded", ...counts },
    name,
    transport,
  };
}

function headersFor(transport: ResponseTransport): Headers {
  const headers = new Headers();
  if (transport.contentType !== null) {
    headers.set("content-type", transport.contentType);
  }
  if (transport.cacheControl !== null) {
    headers.set("cache-control", transport.cacheControl);
  }
  if (transport.contentDisposition !== null) {
    headers.set("content-disposition", transport.contentDisposition);
  }
  return headers;
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function bodyFor(body: ReportBody): BodyInit {
  switch (body) {
    case "adams-pdf": {
      return copyBytes(adamsCountyPdfFixture);
    }
    case "boulder-pdf": {
      return copyBytes(boulderCountyPdfFixture);
    }
    case "empty": {
      return new ArrayBuffer(0);
    }
    case "json": {
      return JSON.stringify({ detail: "not a pdf" });
    }
    case "text": {
      return "not-a-pdf";
    }
    default: {
      const unreachable: never = body;
      throw new Error(`Unhandled report body ${String(unreachable)}`);
    }
  }
}

function responseFor(transport: ResponseTransport): Response {
  const headers = headersFor(transport);
  if (transport.status === 304) {
    return new Response(null, { headers, status: 304 });
  }
  return realmBlobResponse(
    new Response(bodyFor(transport.body), {
      headers,
      status: transport.status,
    })
  );
}

function rejectOutsideLower48(url: string): void {
  if (
    url.includes("/states/AK") ||
    url.includes("/states/HI") ||
    url.includes("/counties/02") ||
    url.includes("/counties/15")
  ) {
    throw new Error(`Outside the lower 48: ${url}`);
  }
}

function assertReportUrl(url: string): void {
  const parsed = new URL(url);
  rejectOutsideLower48(url);
  expect({
    dataset: parsed.searchParams.get("dataset_version"),
    end: parsed.searchParams.get("period_end"),
    measures: parsed.searchParams.getAll("measure_id"),
    path: parsed.pathname,
    start: parsed.searchParams.get("period_start"),
    template: parsed.searchParams.get("template"),
  }).toStrictEqual({
    dataset: "alpha-2026",
    end: "2023-12-31",
    measures: [INVESTIGATE_TICK_MEASURE_ID],
    path: "/v1/counties/08001/report.pdf",
    start: "2023-01-01",
    template: "county-v2",
  });
}

async function expectSavedDownload(
  pending: Promise<unknown>,
  filename: string
): Promise<void> {
  await expect(pending).resolves.toStrictEqual({ committed: true });
  expect(clicks).toStrictEqual([filename]);
  const savedBlob = blobs[0];
  if (!savedBlob) {
    throw new Error("The download blob is missing.");
  }
  const bytes = await bytesFromBlob(savedBlob);
  expectSameBytes(bytes, adamsCountyPdfFixture);
  expect(openPdfFixture(bytes).text).toBe(ADAMS_COUNTY_PDF_TEXT);
}

async function expectDiscardedDownload(
  pending: Promise<unknown>
): Promise<void> {
  await expect(pending).resolves.toStrictEqual({ committed: false });
  expect(clicks).toStrictEqual([]);
  expect(blobs).toStrictEqual([]);
}

async function expectRejectedDownload(
  pending: Promise<unknown>,
  message: string,
  status?: number
): Promise<void> {
  const expected: { message: string; status?: number } = { message };
  if (status !== undefined) {
    expected.status = status;
  }
  await expect(pending).rejects.toMatchObject(expected);
  expect(clicks).toStrictEqual([]);
  expect(blobs).toStrictEqual([]);
}

async function expectDownload(
  pending: Promise<unknown>,
  expectation: DownloadExpectation,
  reportUrls: readonly string[]
): Promise<void> {
  switch (expectation.kind) {
    case "saved": {
      await expectSavedDownload(pending, expectation.filename);
      break;
    }
    case "discarded": {
      await expectDiscardedDownload(pending);
      break;
    }
    case "rejected": {
      await expectRejectedDownload(
        pending,
        expectation.message,
        expectation.status
      );
      break;
    }
    default: {
      const unreachable: never = expectation;
      throw new Error(`Unhandled download outcome ${String(unreachable)}`);
    }
  }
  expect(reportUrls).toHaveLength(expectation.reports);
  for (const url of reportUrls) {
    assertReportUrl(url);
  }
}

const downloadCases: readonly DownloadCase[] = [
  saved("success lower-case application/pdf"),
  saved("success mixed-case PDF with parameters", {
    cacheControl: "NO-STORE",
    contentDisposition: 'attachment; filename="atlas-county-08013.pdf"',
    contentType: "Application/PDF; charset=binary",
  }),
  saved("success PDF parameters without a space and an empty filename", {
    contentDisposition: "attachment; filename=",
    contentType: "application/pdf;charset=binary",
  }),
  saved("success PDF whose parameter text contains json", {
    contentType: 'application/pdf; charset=binary; name="report.json"',
  }),
  rejected(
    "304 does not download a cached report",
    responseTransport({
      body: "empty",
      cacheControl: null,
      contentType: "application/pdf",
      status: 304,
    }),
    {
      message: "Atlas API request failed (304)",
      observations: 1,
      reports: 1,
      status: 304,
    }
  ),
  rejected(
    "404 problem response does not download",
    responseTransport({
      body: "json",
      cacheControl: "no-store",
      contentType: "application/problem+json",
      status: 404,
    }),
    {
      message: "County report was not found.",
      observations: 1,
      reports: 1,
      status: 404,
    }
  ),
  rejected(
    "422 problem response does not download",
    responseTransport({
      body: "json",
      contentType: "application/problem+json",
      status: 422,
    }),
    {
      message: "Report selectors were rejected.",
      observations: 1,
      reports: 1,
      status: 422,
    }
  ),
  rejected(
    "503 problem response does not download",
    responseTransport({
      body: "json",
      contentType: "application/problem+json",
      status: 503,
    }),
    {
      message: "Renderer unavailable.",
      observations: 1,
      reports: 1,
      status: 503,
    }
  ),
  rejected(
    "network failure does not download",
    { mode: "network" },
    {
      message: "Failed to fetch",
      observations: 1,
      reports: 1,
    }
  ),
  discarded(
    "abort before the request does not download",
    { mode: "abort-before" },
    { observations: 0, reports: 0 }
  ),
  rejected(
    "abort during the report does not download",
    { mode: "abort-during" },
    {
      message: "The operation was aborted.",
      observations: 1,
      reports: 1,
    }
  ),
  discarded(
    "stale context before the report does not download",
    { mode: "stale-before-report" },
    { observations: 1, reports: 0 }
  ),
  discarded(
    "late response after the context changes does not download",
    responseTransport({
      body: "boulder-pdf",
      contentDisposition: 'attachment; filename="atlas-county-08013.pdf"',
      mode: "late-after-response",
    }),
    { observations: 2, reports: 1 }
  ),
  rejected(
    "application/pdf+json cannot download",
    responseTransport({
      body: "json",
      contentType: "application/pdf+json",
    }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "application/pdf-error cannot download",
    responseTransport({
      body: "text",
      contentType: "application/pdf-error",
    }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "application/json cannot download",
    responseTransport({
      body: "json",
      contentType: "application/json",
    }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "text/html around PDF bytes cannot download",
    responseTransport({ contentType: "text/html" }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "missing content-type cannot download",
    responseTransport({ contentType: null }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "malformed content-type cannot download",
    responseTransport({ body: "text", contentType: ";;;" }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "empty PDF body cannot download",
    responseTransport({ body: "empty" }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "missing cache-control cannot download",
    responseTransport({ cacheControl: null }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
  rejected(
    "cacheable PDF cannot download",
    responseTransport({ cacheControl: "public, max-age=300" }),
    { message: MATCHING_PDF, observations: 1, reports: 1 }
  ),
];

const mutatorCases: readonly MutatorCase[] = [
  {
    body: JSON.stringify({ ok: true }),
    contentType: "application/json",
    entry: "mutator",
    expectation: { kind: "json", value: { ok: true } },
    name: "application/json",
    path: "/v1/observations",
    status: 200,
  },
  {
    body: JSON.stringify({ detail: "unavailable" }),
    contentType: "application/problem+json; charset=utf-8",
    entry: "mutator",
    expectation: { kind: "json", value: { detail: "unavailable" } },
    name: "application/problem+json with parameters",
    path: "/v1/atlas/metadata",
    status: 200,
  },
  {
    body: JSON.stringify({ features: [], type: "FeatureCollection" }),
    contentType: "application/geo+json",
    entry: "mutator",
    expectation: {
      kind: "json",
      value: { features: [], type: "FeatureCollection" },
    },
    name: "application/geo+json",
    path: "/v1/atlas/geometry",
    status: 200,
  },
  {
    body: JSON.stringify({ features: [], type: "FeatureCollection" }),
    contentType: "application/vnd.geo+json",
    entry: "mutator",
    expectation: {
      kind: "json",
      value: { features: [], type: "FeatureCollection" },
    },
    name: "vendor geo+json",
    path: "/v1/atlas/geometry",
    status: 200,
  },
  {
    body: '{"ok":true}',
    contentType: "Application/JSON",
    entry: "mutator",
    expectation: { kind: "text", value: '{"ok":true}' },
    name: "case-sensitive JSON decoding stays unchanged",
    path: "/v1/atlas/metadata",
    status: 200,
  },
  {
    body: "plain",
    contentType: "text/plain",
    entry: "mutator",
    expectation: { kind: "text", value: "plain" },
    name: "text/plain",
    path: "/v1/atlas/metadata",
    status: 200,
  },
  {
    body: "bytes",
    contentType: null,
    entry: "mutator",
    expectation: { kind: "text", value: "bytes" },
    name: "missing content-type",
    path: "/v1/atlas/metadata",
    status: 200,
  },
  {
    body: "",
    bytes: adamsCountyPdfFixture,
    contentType: "application/pdf",
    entry: "county",
    expectation: { bytes: adamsCountyPdfFixture, kind: "blob" },
    name: "generated county client lower-case PDF",
    path: "/v1/counties/08001/report.pdf",
    status: 200,
  },
  {
    body: "",
    bytes: adamsCountyPdfFixture,
    contentType: "Application/PDF; charset=binary",
    entry: "county",
    expectation: { bytes: adamsCountyPdfFixture, kind: "blob" },
    name: "generated county client mixed-case PDF",
    path: "/v1/counties/08001/report.pdf",
    status: 200,
  },
  {
    body: "",
    bytes: coloradoStatePdf,
    contentType: "application/pdf",
    entry: "state",
    expectation: { bytes: coloradoStatePdf, kind: "blob" },
    name: "generated Colorado state client PDF",
    path: "/v1/states/CO/report.pdf",
    status: 200,
  },
  {
    body: JSON.stringify({ detail: "not a pdf" }),
    contentType: "application/pdf+json",
    entry: "county",
    expectation: { kind: "json", value: { detail: "not a pdf" } },
    name: "generated county client rejects pdf+json as a blob",
    path: "/v1/counties/08001/report.pdf",
    status: 200,
  },
  {
    body: "not-a-pdf",
    contentType: "application/pdf-error",
    entry: "state",
    expectation: { kind: "text", value: "not-a-pdf" },
    name: "generated state client rejects pdf-error as a blob",
    path: "/v1/states/CO/report.pdf",
    status: 200,
  },
  {
    body: JSON.stringify({ detail: "Renderer unavailable." }),
    contentType: "application/problem+json",
    entry: "state",
    expectation: {
      kind: "error",
      message: "Renderer unavailable.",
      status: 503,
    },
    name: "generated state client 503 problem response",
    path: "/v1/states/CO/report.pdf",
    status: 503,
  },
];

function mutatorBody(transportCase: MutatorCase): BodyInit {
  return transportCase.bytes
    ? copyBytes(transportCase.bytes)
    : transportCase.body;
}

async function runMutatorCase(transportCase: MutatorCase): Promise<unknown> {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    rejectOutsideLower48(url);
    if (
      !url.startsWith("http://localhost:8000") ||
      !url.includes(transportCase.path)
    ) {
      throw new Error(`Unexpected mutator request ${url}`);
    }
    const headers = new Headers();
    if (transportCase.contentType !== null) {
      headers.set("content-type", transportCase.contentType);
    }
    if (transportCase.status === 304) {
      return Promise.resolve(new Response(null, { headers, status: 304 }));
    }
    return Promise.resolve(
      new Response(mutatorBody(transportCase), {
        headers,
        status: transportCase.status,
      })
    );
  });
  switch (transportCase.entry) {
    case "mutator": {
      return await apiMutator(transportCase.path, { method: "GET" });
    }
    case "county": {
      return await countyReportPdfV1CountiesFipsReportPdfGet("08001");
    }
    case "state": {
      return await stateReportPdfV1StatesStateReportPdfGet("CO");
    }
    default: {
      const unreachable: never = transportCase.entry;
      throw new Error(`Unhandled client ${String(unreachable)}`);
    }
  }
}

function payloadOf(result: unknown): unknown {
  if (typeof result !== "object" || result === null || !("data" in result)) {
    throw new Error("Transport result is missing data.");
  }
  return result.data;
}

async function expectBlobPayload(
  result: unknown,
  bytes: Uint8Array
): Promise<void> {
  expect(result).toMatchObject({ status: 200 });
  const data = payloadOf(result);
  if (!isBlobLike(data)) {
    throw new Error("Transport did not return a PDF blob.");
  }
  const actual = await bytesFromBlob(data);
  expectSameBytes(actual, bytes);
  expect(openPdfFixture(actual).text).toBeTruthy();
}

function expectJsonPayload(result: unknown, value: unknown): void {
  expect(result).toMatchObject({ data: value, status: 200 });
  if (isBlobLike(payloadOf(result))) {
    throw new Error("JSON transport returned a blob.");
  }
}

function expectTextPayload(result: unknown, value: string): void {
  expect(result).toMatchObject({ data: value, status: 200 });
  if (isBlobLike(payloadOf(result))) {
    throw new Error("Text transport returned a blob.");
  }
}

async function expectMutator(transportCase: MutatorCase): Promise<void> {
  const expectation = transportCase.expectation;
  if (expectation.kind === "error") {
    await expectRejectedDownload(
      runMutatorCase(transportCase),
      expectation.message,
      expectation.status
    );
    return;
  }
  const result = await runMutatorCase(transportCase);
  switch (expectation.kind) {
    case "blob": {
      await expectBlobPayload(result, expectation.bytes);
      return;
    }
    case "json": {
      expectJsonPayload(result, expectation.value);
      return;
    }
    case "text": {
      expectTextPayload(result, expectation.value);
      return;
    }
    default: {
      const unreachable: never = expectation;
      throw new Error(`Unhandled mutator outcome ${String(unreachable)}`);
    }
  }
}

function legacyBody(body: LegacyCase["body"]): ArrayBuffer {
  switch (body) {
    case "empty": {
      return new ArrayBuffer(0);
    }
    case "colorado-pdf": {
      return copyBytes(coloradoStatePdf);
    }
    case "county-pdf": {
      return copyBytes(adamsCountyPdfFixture);
    }
    default: {
      const unreachable: never = body;
      throw new Error(`Unhandled legacy body ${String(unreachable)}`);
    }
  }
}

function legacyFixtureText(body: LegacyCase["body"]): string {
  if (body === "colorado-pdf") {
    return COLORADO_STATE_PDF_TEXT;
  }
  return ADAMS_COUNTY_PDF_TEXT;
}

async function expectLegacySaved(
  pending: Promise<unknown>,
  filename: string,
  body: LegacyCase["body"]
): Promise<void> {
  await expect(pending).resolves.toStrictEqual({ committed: true });
  expect(clicks).toStrictEqual([filename]);
  const savedBlob = blobs[0];
  if (!savedBlob) {
    throw new Error("The legacy download blob is missing.");
  }
  const bytes = await bytesFromBlob(savedBlob);
  const expectedBytes =
    body === "colorado-pdf" ? coloradoStatePdf : adamsCountyPdfFixture;
  expectSameBytes(bytes, expectedBytes);
  expect(openPdfFixture(bytes).text).toBe(legacyFixtureText(body));
}

async function expectLegacyRejected(
  pending: Promise<unknown>,
  message: string
): Promise<void> {
  await expect(pending).rejects.toThrow(message);
  expect(clicks).toStrictEqual([]);
  expect(blobs).toStrictEqual([]);
}

async function expectLegacy(
  pending: Promise<unknown>,
  transportCase: LegacyCase
): Promise<void> {
  switch (transportCase.expectation.kind) {
    case "saved": {
      await expectLegacySaved(
        pending,
        transportCase.expectation.filename,
        transportCase.body
      );
      return;
    }
    case "discarded": {
      await expectDiscardedDownload(pending);
      return;
    }
    case "rejected": {
      await expectLegacyRejected(pending, transportCase.expectation.message);
      return;
    }
    default: {
      const unreachable: never = transportCase.expectation;
      throw new Error(`Unhandled legacy outcome ${String(unreachable)}`);
    }
  }
}

describe("PDF transport", () => {
  beforeEach(() => {
    blobs = [];
    clicks = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: ((value: Blob | MediaSource) => {
          if (isBlobLike(value)) {
            blobs.push(value);
          }
          return "blob:report";
        }) satisfies typeof URL.createObjectURL,
        revokeObjectURL: (() => {
          /* Object URLs are revoked by the downloader. */
        }) satisfies typeof URL.revokeObjectURL,
      })
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        clicks.push(this.download);
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens the deterministic fixture and rejects placeholder bytes", () => {
    expect(openPdfFixture(adamsCountyPdfFixture)).toStrictEqual({
      objectCount: 5,
      text: ADAMS_COUNTY_PDF_TEXT,
      version: "1.4",
    });
    expect(openPdfFixture(boulderCountyPdfFixture).text).toBe(
      BOULDER_COUNTY_PDF_TEXT
    );
    expect([...buildPdfFixture(ADAMS_COUNTY_PDF_TEXT)]).toStrictEqual([
      ...adamsCountyPdfFixture,
    ]);
    expect(() =>
      openPdfFixture(new TextEncoder().encode("%PDF-1.7 fixture"))
    ).toThrow("PDF header is missing.");
  });

  it.each(mutatorCases)(
    "decodes $name through the real transport",
    async (transportCase) => {
      await expectMutator(transportCase);
      expect(transportCase.path.startsWith("/v1/")).toBeTruthy();
    }
  );

  it.each(downloadCases)("Investigate $name", async (transportCase) => {
    const observations = adamsObservations();
    const reportUrls: string[] = [];
    let observationRequests = 0;
    const commit = { current: true };
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      rejectOutsideLower48(url);
      if (!url.startsWith("http://localhost:8000")) {
        return Promise.reject(new Error(`Unexpected origin ${url}`));
      }
      if (url.includes("/v1/observations")) {
        observationRequests += 1;
        if (transportCase.transport.mode === "stale-before-report") {
          commit.current = false;
        }
        return Promise.resolve(Response.json(observations));
      }
      if (!url.includes("/report.pdf")) {
        return Promise.reject(new Error(`Unexpected request ${url}`));
      }
      if (
        new Headers(init?.headers).get("accept") !== "application/pdf" ||
        init?.cache !== "no-store"
      ) {
        return Promise.reject(
          new Error(`Report request was not uncached PDF: ${url}`)
        );
      }
      reportUrls.push(url);
      switch (transportCase.transport.mode) {
        case "network": {
          return Promise.reject(new TypeError("Failed to fetch"));
        }
        case "abort-during": {
          return Promise.reject(
            new DOMException("The operation was aborted.", "AbortError")
          );
        }
        case "abort-before":
        case "stale-before-report": {
          return Promise.reject(new Error(`Unexpected report request ${url}`));
        }
        case "late-after-response": {
          commit.current = false;
          return Promise.resolve(responseFor(transportCase.transport));
        }
        case "response": {
          const transport = transportCase.transport;
          if (transport.status === 404) {
            return Promise.resolve(
              Response.json(
                { detail: "County report was not found." },
                { headers: headersFor(transport), status: 404 }
              )
            );
          }
          if (transport.status === 422) {
            return Promise.resolve(
              Response.json(
                { detail: "Report selectors were rejected." },
                { headers: headersFor(transport), status: 422 }
              )
            );
          }
          if (transport.status === 503) {
            return Promise.resolve(
              Response.json(
                { detail: "Renderer unavailable." },
                { headers: headersFor(transport), status: 503 }
              )
            );
          }
          return Promise.resolve(responseFor(transport));
        }
        default: {
          const unreachable: never = transportCase.transport;
          return Promise.reject(
            new Error(`Unhandled transport ${String(unreachable)}`)
          );
        }
      }
    });
    const controller = new AbortController();
    if (transportCase.transport.mode === "abort-before") {
      controller.abort();
    }
    const pending = downloadInvestigatePdf(
      adamsContext(readDatedObservations(observations.data)),
      {
        shouldCommit: () => commit.current,
        signal: controller.signal,
      }
    );
    await expectDownload(pending, transportCase.expectation, reportUrls);
    expect(observationRequests).toStrictEqual(
      transportCase.expectation.observations
    );
  });

  it("does not replace an earlier file when a later report fails", async () => {
    const observations = adamsObservations();
    let reports = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/v1/observations")) {
        return Promise.resolve(Response.json(observations));
      }
      reports += 1;
      assertReportUrl(url);
      if (reports === 1) {
        return Promise.resolve(
          responseFor(
            responseTransport({
              contentType: "Application/PDF; charset=binary",
            })
          )
        );
      }
      return Promise.resolve(
        Response.json(
          { detail: "Renderer unavailable." },
          {
            headers: { "content-type": "application/problem+json" },
            status: 503,
          }
        )
      );
    });
    await expect(
      downloadInvestigatePdf(
        adamsContext(readDatedObservations(observations.data)),
        {}
      )
    ).resolves.toStrictEqual({ committed: true });
    await expect(
      downloadInvestigatePdf(
        adamsContext(readDatedObservations(observations.data)),
        {}
      )
    ).rejects.toMatchObject({
      message: "Renderer unavailable.",
      status: 503,
    });
    expect(clicks).toStrictEqual([ADAMS_DOWNLOAD_NAME]);
    expect(blobs).toHaveLength(1);
    const savedBlob = blobs[0];
    if (!savedBlob) {
      throw new Error("The first download blob is missing.");
    }
    expectSameBytes(await bytesFromBlob(savedBlob), adamsCountyPdfFixture);
  });

  it("discards a late Adams report after the county changes", async () => {
    const observations = adamsObservations();
    const reportUrls: string[] = [];
    const reportStarted = Promise.withResolvers<boolean>();
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/v1/observations")) {
        return Promise.resolve(Response.json(observations));
      }
      reportUrls.push(url);
      const pendingReport = Promise.withResolvers<Response>();
      const abort = () => {
        pendingReport.reject(
          new DOMException("The operation was aborted.", "AbortError")
        );
      };
      if (init?.signal?.aborted) {
        abort();
      } else {
        init?.signal?.addEventListener("abort", abort, { once: true });
      }
      reportStarted.resolve(true);
      return pendingReport.promise;
    });
    const view = render(
      <InvestigatePdfExport
        context={adamsContext(readDatedObservations(observations.data))}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await reportStarted.promise;
    view.rerender(
      <InvestigatePdfExport
        context={{
          ...adamsContext(readDatedObservations(observations.data)),
          countyFips: "08013",
        }}
      />
    );
    await waitFor(() => {
      expect(clicks).toStrictEqual([]);
    });
    const reportUrl = reportUrls[0] ?? "";
    if (reportUrl.includes("08013")) {
      throw new Error("A changed county received the previous report.");
    }
    expect({
      alert: screen.queryByRole("alert"),
      blobs,
      reportUrl,
    }).toStrictEqual({
      alert: null,
      blobs: [],
      reportUrl: expect.stringContaining("/v1/counties/08001/report.pdf"),
    });
  });

  const legacyCases: readonly LegacyCase[] = [
    {
      body: "county-pdf",
      contentDisposition: 'attachment; filename="adams-county.pdf"',
      contentType: "application/pdf",
      expectation: { filename: "adams-county.pdf", kind: "saved" },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "county success uses the server filename",
      status: 200,
    },
    {
      body: "colorado-pdf",
      contentDisposition: 'attachment; filename="colorado.pdf"',
      contentType: "Application/PDF; charset=binary",
      expectation: { filename: "colorado.pdf", kind: "saved" },
      identifier: "CO",
      level: "state",
      mode: "response",
      name: "Colorado state success keeps mixed-case PDF bytes",
      status: 200,
    },
    {
      body: "county-pdf",
      contentDisposition: null,
      contentType: "application/pdf",
      expectation: {
        filename: "lyme-gap-atlas-county-08001.pdf",
        kind: "saved",
      },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "missing content-disposition uses the fallback filename",
      status: 200,
    },
    {
      body: "county-pdf",
      contentDisposition: "attachment; filename=",
      contentType: "application/pdf",
      expectation: {
        filename: "lyme-gap-atlas-county-08001.pdf",
        kind: "saved",
      },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "malformed content-disposition uses the fallback filename",
      status: 200,
    },
    {
      body: "empty",
      contentDisposition: null,
      contentType: "application/pdf",
      expectation: { kind: "rejected", message: "PDF export failed (304)" },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "304 does not download",
      status: 304,
    },
    {
      body: "empty",
      contentDisposition: null,
      contentType: "application/problem+json",
      expectation: { kind: "rejected", message: "PDF export failed (404)" },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "404 does not download",
      status: 404,
    },
    {
      body: "empty",
      contentDisposition: null,
      contentType: "application/problem+json",
      expectation: { kind: "rejected", message: "PDF export failed (422)" },
      identifier: "CO",
      level: "state",
      mode: "response",
      name: "422 does not download",
      status: 422,
    },
    {
      body: "empty",
      contentDisposition: null,
      contentType: "application/problem+json",
      expectation: { kind: "rejected", message: "PDF export failed (503)" },
      identifier: "CO",
      level: "state",
      mode: "response",
      name: "503 does not download",
      status: 503,
    },
    {
      body: "county-pdf",
      contentDisposition: null,
      contentType: "application/pdf",
      expectation: { kind: "rejected", message: "Failed to fetch" },
      identifier: "08001",
      level: "county",
      mode: "network",
      name: "network failure does not download",
      status: 200,
    },
    {
      body: "county-pdf",
      contentDisposition: null,
      contentType: "application/pdf",
      expectation: { kind: "discarded" },
      identifier: "08001",
      level: "county",
      mode: "abort",
      name: "abort does not download",
      status: 200,
    },
    {
      body: "county-pdf",
      contentDisposition: 'attachment; filename="adams-county.pdf"',
      contentType: "application/pdf",
      expectation: { kind: "discarded" },
      identifier: "08001",
      level: "county",
      mode: "stale-after-response",
      name: "stale context after the response does not download",
      status: 200,
    },
    {
      body: "empty",
      contentDisposition: null,
      contentType: "application/pdf",
      expectation: {
        kind: "rejected",
        message: "PDF export failed (empty file).",
      },
      identifier: "08001",
      level: "county",
      mode: "response",
      name: "empty body does not download",
      status: 200,
    },
  ];

  it.each(legacyCases)("legacy $name", async (transportCase) => {
    const commit = { current: true };
    const controller = new AbortController();
    if (transportCase.mode === "abort") {
      controller.abort();
    }
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      const expectedPath =
        transportCase.level === "county"
          ? `/v1/counties/${transportCase.identifier}/report.pdf`
          : `/v1/states/${transportCase.identifier}/report.pdf`;
      rejectOutsideLower48(url);
      if (!url.includes(expectedPath)) {
        return Promise.reject(new Error(`Unexpected legacy report ${url}`));
      }
      if (transportCase.mode === "network") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      if (transportCase.mode === "stale-after-response") {
        commit.current = false;
      }
      if (transportCase.status === 304) {
        return Promise.resolve(new Response(null, { status: 304 }));
      }
      const headers = new Headers({
        "content-type": transportCase.contentType,
      });
      if (transportCase.contentDisposition !== null) {
        headers.set("content-disposition", transportCase.contentDisposition);
      }
      const body = legacyBody(transportCase.body);
      return Promise.resolve(
        new Response(body, { headers, status: transportCase.status })
      );
    });
    const pending = downloadPdfReport(
      { identifier: transportCase.identifier, level: transportCase.level },
      legacySettings,
      "alpha-2026",
      {
        shouldCommit: () => commit.current,
        signal: controller.signal,
      }
    );
    await expectLegacy(pending, transportCase);
    expect(
      transportCase.identifier === "08001" || transportCase.identifier === "CO"
    ).toBeTruthy();
  });
});
