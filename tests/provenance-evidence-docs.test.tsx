import fs from "node:fs";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { publishedGetCurl } from "@/features/docs/observation-query-example";
import {
  ProvenanceCitationSteps,
  ProvenanceFieldNames,
  ValueStateNullTable,
} from "@/features/docs/provenance-evidence";
import {
  checkedGapObservationFields,
  checkedMethodologyFields,
  checkedObservedValueFields,
  checkedSourceFields,
  observationNullSemantics,
  provenanceCitationPaths,
  provenanceNameRows,
} from "@/features/docs/provenance-evidence-model";
import { getDocsUrl, getPublishedApiOrigin } from "@/lib/public-origins";

const pagePath = path.join(
  process.cwd(),
  "content/docs/develop/provenance.mdx"
);
const page = fs.readFileSync(pagePath, "utf-8");

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSchema(name: string): JsonRecord {
  const spec = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "contracts/public-openapi.json"),
      "utf-8"
    )
  ) as JsonRecord;
  const components = isRecord(spec.components) ? spec.components : {};
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  const schema = schemas[name];
  if (!isRecord(schema)) {
    throw new Error(`Missing schema ${name}`);
  }
  return schema;
}

function property(schemaName: string, propertyName: string): JsonRecord {
  const schema = readSchema(schemaName);
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const field = properties[propertyName];
  if (!isRecord(field)) {
    throw new Error(`Missing ${schemaName}.${propertyName}`);
  }
  return field;
}

function requiredNames(schemaName: string): string[] {
  const required = readSchema(schemaName).required;
  if (!Array.isArray(required)) return [];
  return required.filter((name): name is string => typeof name === "string");
}

function annotatedJson(title: string): unknown {
  const marker = `\`\`\`json title="${title}"`;
  const start = page.indexOf(marker);
  const fence = page.indexOf("```", start + marker.length);
  if (start === -1 || fence === -1) {
    throw new Error(`Missing annotated JSON ${title}`);
  }
  const body = page
    .slice(start + marker.length, fence)
    .replaceAll(/\/\/ \[!code [^\]]*\]/gu, "");
  return JSON.parse(body) as unknown;
}

describe("annotated provenance documentation", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps null-semantics copy identical to the observation schema", () => {
    const required = requiredNames("Observation");
    for (const [name, field] of Object.entries(observationNullSemantics)) {
      expect(property("Observation", name).description).toBe(field.description);
      expect(required.includes(name)).toBe(field.required);
    }
    expect(readSchema("ValueState").enum).toStrictEqual([
      "OBSERVED",
      "ZERO",
      "MISSING",
      "SUPPRESSED",
      "UNAVAILABLE",
      "NO_COUNTY_LINKED_RECORD",
      "NO_RECORDS",
    ]);
  });

  it("names only real source, observation, and methodology fields", () => {
    const problems: string[] = [];
    for (const row of provenanceNameRows) {
      const field = property(row.schema, row.name);
      if (requiredNames(row.schema).includes(row.name) !== row.required) {
        problems.push(`${row.schema}.${row.name} required mismatch`);
      }
      if (Boolean(field.deprecated) !== Boolean(row.deprecated)) {
        const described =
          field.deprecated === true && row.description.includes("Deprecated.");
        if (!described) {
          problems.push(`${row.schema}.${row.name} deprecated mismatch`);
        }
      }
      if (
        typeof field.description === "string" &&
        !row.description.includes(field.description)
      ) {
        problems.push(`${row.schema}.${row.name} dropped its schema sentence`);
      }
      const paired = row.type.match(
        /^(?<schema>EvidenceReference|Methodology|Observation|Source)\.(?<name>[A-Za-z0-9_]+)$/u
      );
      if (paired?.groups?.schema && paired.groups.name) {
        const pairedField = readSchema(paired.groups.schema);
        const properties = isRecord(pairedField.properties)
          ? pairedField.properties
          : {};
        if (!isRecord(properties[paired.groups.name])) {
          problems.push(`missing paired field ${row.type}`);
        }
      }
    }
    if (property("Source", "atlas_acquired_at").deprecated !== true) {
      problems.push("Source.atlas_acquired_at must stay deprecated");
    }
    if (property("Observation", "atlas_acquired_at").deprecated !== undefined) {
      problems.push("Observation.atlas_acquired_at is not deprecated");
    }
    for (const name of ["lineage_source_id", "dataset_id", "label"] as const) {
      if (!requiredNames("Source").includes(name)) {
        problems.push(`Source.${name} is required`);
      }
    }
    if (requiredNames("Observation").includes("lineage_source_id")) {
      problems.push("Observation.lineage_source_id is not required");
    }
    expect(problems).toStrictEqual([]);
  });

  it("renders the discover, observe, and resolve requests from the published origin", () => {
    render(<ProvenanceCitationSteps />);
    const missing = [
      screen.queryByRole("heading", { name: "Discover" }),
      screen.queryByRole("heading", { name: "Observe" }),
      screen.queryByRole("heading", { name: "Resolve" }),
      ...Object.values(provenanceCitationPaths).flatMap((requestPath) => {
        const curl = publishedGetCurl(requestPath);
        return [
          screen.queryByText(curl),
          curl.includes(getPublishedApiOrigin()) ? "origin" : null,
        ];
      }),
      screen.queryByText(/source_ids/u),
    ].filter((item) => item === null);
    expect(missing).toStrictEqual([]);
  });

  it("opens the value-state schema sentence and links the docs reference", () => {
    render(<ValueStateNullTable />);
    fireEvent.click(screen.getByRole("button", { name: /value_state/u }));
    expect(
      screen.getByText(/MISSING\/SUPPRESSED\/UNAVAILABLE require null/u)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ValueState" })).toHaveAttribute(
      "href",
      `${getDocsUrl()}/api-reference/schemas#schema-valuestate`
    );
  });

  it("shows paired source and observation names", () => {
    render(<ProvenanceFieldNames />);
    fireEvent.click(screen.getByRole("button", { name: /source_label/u }));
    expect(
      screen.getByText(/source resource field with this value is label/u)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^published_at/u }));
    expect(
      screen.getByText(
        /observation publisher timestamp is source_published_at/u
      )
    ).toBeInTheDocument();
  });

  it("annotates checked production fields with Shiki comments", () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), "src/features/docs/provenance-evidence.tsx"),
      "utf-8"
    );
    const requiredSnippets = [
      'from "fumadocs-ui/components/steps"',
      'from "fumadocs-ui/components/type-table"',
      "<ProvenanceCitationSteps />",
      "<ValueStateNullTable />",
      "<ProvenanceFieldNames />",
      "// [!code highlight]",
      "// [!code word:MISSING]",
      "// [!code highlight]",
      "// [!code word:label]",
      "// [!code word:version]",
    ];
    const missing = requiredSnippets.filter(
      (snippet) => !component.includes(snippet) && !page.includes(snippet)
    );
    expect({
      examples: {
        gap: annotatedJson("Checked gap observation fields"),
        methodology: annotatedJson("Checked methodology resource"),
        observed: annotatedJson("Checked observed value"),
        source: annotatedJson("Checked source resource"),
      },
      hardcodedCurl: page.includes(
        "https://api.onehealthatlas.org/v1/sources/human"
      ),
      missing,
    }).toStrictEqual({
      examples: {
        gap: checkedGapObservationFields,
        methodology: checkedMethodologyFields,
        observed: checkedObservedValueFields,
        source: checkedSourceFields,
      },
      hardcodedCurl: false,
      missing: [],
    });
  });
});
