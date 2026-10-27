import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * `openapi-to-postmanv2` hardcodes schema faking and draws example values
 * through `Math.random` captured when its JSON Schema Faker copy loads.
 * A child process seeds that generator once so the committed collection
 * matches `docs:api:check`. Item ids from `crypto` are replaced here.
 *
 * Date and date-time examples are `new Date()` minus that seeded offset,
 * then the UTC calendar date. The date changes when the wall clock crosses
 * the offset's UTC midnight. For the pinned contract that happened on
 * 27 October 2026 at 14:14 UTC, after main's Quality run and before the
 * later pull-request run. The child process pins the example clock to an
 * instant that reproduces the committed collection.
 */
const CONVERT_FLAG = "--convert-postman";
/**
 * Wall clock inside the converter child. 2026-10-27T00:00:00.000Z reproduces
 * the committed Postman collection for the pinned public contract.
 */
const POSTMAN_EXAMPLE_CLOCK_MS = Date.parse("2026-10-27T00:00:00.000Z");
const POSTMAN_SCHEMA =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

const CONVERTER_OPTIONS = {
  exampleParametersResolution: "Example",
  folderStrategy: "Tags",
  includeAuthInfoInExample: false,
  parametersResolution: "Example",
  requestNameSource: "Fallback",
  requestParametersResolution: "Example",
} as const;

type PostmanCollection = {
  info?: {
    _postman_id?: string;
    name?: string;
    schema?: string;
  };
  item?: unknown;
  variable?: { key?: string; value?: string }[];
};

export function renderPostmanCollection(specText: string): string {
  const scriptPath = import.meta.filename;
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--import",
      path.join(process.cwd(), "scripts/register-ts-extension.mjs"),
      scriptPath,
      CONVERT_FLAG,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf-8",
      input: specText,
      maxBuffer: 32 * 1024 * 1024,
    }
  );
  if (child.status !== 0) {
    const detail = `${child.stderr ?? ""}\n${child.stdout ?? ""}`.trim();
    throw new Error(
      detail.length > 0
        ? `Postman conversion failed: ${detail}`
        : "Postman conversion failed."
    );
  }
  return child.stdout;
}

function convertPinnedSpec(specText: string): string {
  let seed = 42;
  Math.random = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed - 1) / 2_147_483_646;
  };
  installStableExampleClock();
  const require = createRequire(import.meta.url);
  const converter = require("openapi-to-postmanv2") as {
    convert: (
      input: { data: unknown; type: "json" },
      options: typeof CONVERTER_OPTIONS,
      callback: (error: Error | null, result: unknown) => void
    ) => void;
  };
  const spec: unknown = JSON.parse(specText);
  const result = converterResult(converter, spec);
  if (!isRecord(result) || result.result !== true) {
    const reason = isRecord(result) ? result.reason : "unknown";
    throw new Error(`openapi-to-postmanv2 rejected the contract: ${reason}`);
  }
  const output = Array.isArray(result.output) ? result.output[0] : undefined;
  if (!isRecord(output) || !isRecord(output.data)) {
    throw new Error("openapi-to-postmanv2 returned no collection.");
  }
  const collection = stabilizeCollection(output.data);
  selectObservationExample(collection);
  if (collection.info?.schema !== POSTMAN_SCHEMA) {
    throw new Error("Postman collection is not schema v2.1.0.");
  }
  const baseUrl = collection.variable?.find(
    (variable) => variable.key === "baseUrl"
  )?.value;
  if (typeof baseUrl !== "string" || baseUrl.length === 0) {
    throw new Error("Postman collection is missing baseUrl.");
  }
  return `${JSON.stringify(collection, null, 2)}\n`;
}

function converterResult(
  converter: {
    convert: (
      input: { data: unknown; type: "json" },
      options: typeof CONVERTER_OPTIONS,
      callback: (error: Error | null, result: unknown) => void
    ) => void;
  },
  spec: unknown
): unknown {
  let settled = false;
  let value: unknown;
  let failure: Error | undefined;
  converter.convert(
    { data: spec, type: "json" },
    CONVERTER_OPTIONS,
    // openapi-to-postmanv2 exposes this synchronous callback and no promise API.
    // oxlint-disable-next-line promise/prefer-await-to-callbacks
    (error, result) => {
      settled = true;
      if (error) failure = error;
      else value = result;
    }
  );
  if (!settled) {
    throw new Error("openapi-to-postmanv2 did not finish synchronously.");
  }
  if (failure) throw failure;
  return value;
}

function stabilizeCollection(value: unknown): PostmanCollection {
  return stabilizeNode(value, "collection") as PostmanCollection;
}

function stabilizeNode(value: unknown, nodePath: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      stabilizeNode(item, `${nodePath}[${index}]`)
    );
  }
  if (!isRecord(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "id" || key === "_postman_id") {
      copy[key] = deterministicId(`${nodePath}.${key}`);
      continue;
    }
    copy[key] = stabilizeNode(child, `${nodePath}.${key}`);
  }
  return copy;
}

const OBSERVATION_REQUEST_NAME = "Query county observations";
const ANNUAL_SURVEILLANCE_MEASURE = "case_count_floor_2023";
const ANNUAL_SURVEILLANCE_YEAR = "2023";
const INCOMPATIBLE_WITH_YEAR = new Set([
  "end_date",
  "start_date",
  "stratification",
  "vintage_year",
]);

/**
 * The converter enables every query parameter at once. For
 * `case_count_floor_2023`, the observation guide accepts `year` 2023 and
 * rejects that year together with a date range, `vintage_year`, or any
 * `stratification`. Placeholder paging tokens are not a real next page.
 */
function selectObservationExample(collection: PostmanCollection): void {
  const visit = (node: unknown) => {
    if (!isRecord(node)) return;
    if (node.name === OBSERVATION_REQUEST_NAME && isRecord(node.request)) {
      applyAnnualSurveillanceSelection(node.request);
      if (Array.isArray(node.response)) {
        for (const example of node.response) {
          if (isRecord(example) && isRecord(example.originalRequest)) {
            applyAnnualSurveillanceSelection(example.originalRequest);
          }
        }
      }
    }
    if (!Array.isArray(node.item)) return;
    for (const child of node.item) visit(child);
  };
  visit(collection);
}

function applyAnnualSurveillanceSelection(
  request: Record<string, unknown>
): void {
  const url = request.url;
  if (!isRecord(url) || !Array.isArray(url.query)) {
    throw new Error("Query county observations is missing query parameters.");
  }
  const measure = url.query.find(
    (param) => isQueryParam(param) && param.key === "measure_id"
  );
  if (!isQueryParam(measure) || measure.value !== ANNUAL_SURVEILLANCE_MEASURE) {
    throw new Error(
      "Observation example measure is not case_count_floor_2023."
    );
  }
  let year = false;
  for (const param of url.query) {
    if (!isQueryParam(param)) {
      throw new Error("Observation query parameter is malformed.");
    }
    if (param.key === "year") {
      param.value = ANNUAL_SURVEILLANCE_YEAR;
      param.disabled = false;
      year = true;
      continue;
    }
    if (
      INCOMPATIBLE_WITH_YEAR.has(param.key) ||
      (param.key === "page_token" && param.value === "string")
    ) {
      param.disabled = true;
    }
  }
  if (!year) {
    throw new Error("Observation example is missing year.");
  }
}

type QueryParam = {
  disabled?: boolean;
  key: string;
  value?: string;
};

function isQueryParam(value: unknown): value is QueryParam {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    (value.value === undefined || typeof value.value === "string") &&
    (value.disabled === undefined || typeof value.disabled === "boolean")
  );
}

function installStableExampleClock(): void {
  const realDate = globalThis.Date;
  const stableDate = new Proxy(realDate, {
    apply() {
      return new realDate(POSTMAN_EXAMPLE_CLOCK_MS).toString();
    },
    construct(target, args) {
      if (args.length === 0) {
        return new realDate(POSTMAN_EXAMPLE_CLOCK_MS);
      }
      return Reflect.construct(target, args);
    },
    get(target, property, receiver) {
      if (property === "now") {
        return () => POSTMAN_EXAMPLE_CLOCK_MS;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  globalThis.Date = stableDate;
}

function deterministicId(nodePath: string): string {
  const digest = createHash("sha256").update(nodePath).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const invokedDirectly =
  process.argv[1]?.endsWith("render-postman-collection.ts") === true &&
  process.argv.includes(CONVERT_FLAG);

if (invokedDirectly) {
  const specText = readFileSync(0, "utf-8");
  try {
    process.stdout.write(convertPinnedSpec(specText));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "conversion failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
