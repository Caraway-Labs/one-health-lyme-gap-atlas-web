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
 */
const CONVERT_FLAG = "--convert-postman";
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
