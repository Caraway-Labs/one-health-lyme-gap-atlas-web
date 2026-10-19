import { readFileSync } from "node:fs";
import path from "node:path";

import type { Document } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

import {
  PUBLIC_OPENAPI_RELATIVE_PATH,
  PUBLIC_OPENAPI_SCHEMA_ID,
} from "./public-openapi-reference";

function readPinnedPublicOpenApi(): Document {
  const parsed: unknown = JSON.parse(
    readFileSync(
      path.join(process.cwd(), PUBLIC_OPENAPI_RELATIVE_PATH),
      "utf-8"
    )
  );
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("openapi" in parsed) ||
    typeof parsed.openapi !== "string"
  ) {
    throw new Error("Pinned public OpenAPI contract must be an object.");
  }
  return parsed as Document;
}

export const openapi = createOpenAPI({
  input: {
    [PUBLIC_OPENAPI_SCHEMA_ID]: readPinnedPublicOpenApi,
  },
});
