import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  glossaryTermProblems,
  listGlossaryTerms,
  lookupGlossaryTerm,
} from "@/features/docs/glossary-terms";

const API_DEFINITIONS = {
  availability:
    "Whether Atlas has published results for the selection. It does not describe biological presence.",
  fips: "Five-digit county FIPS code, with leading zeros.",
  indicator: "A public-health concept that groups related measures.",
  limitations:
    "Factual notes on what the result does not show or where its evidence is bounded. Keep them with the value when you display or store it.",
  measure:
    "One variable you can query, such as a case count. It belongs to one indicator.",
  methodology:
    "The method Atlas used to produce or interpret a measure's values.",
  provenance_ref:
    "Identifies the provenance record for this observation. It is not a literature citation.",
  release: "The data release this record came from.",
  release_id:
    "Identifies the published data release the result came from. Results from different releases are not directly comparable.",
  value_state: "How to read `value`. Never treat a `null` value as zero.",
  vintage: "Reference year or period of the source dataset.",
} as const;

function sentences(definition: string): string[] {
  return definition
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => sentence.length > 0);
}

function mdxFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...mdxFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".mdx")) files.push(fullPath);
  }
  return files;
}

describe("glossary terms", () => {
  it("lists at least 25 terms in alphabetical order with one or two sentences", () => {
    const terms = listGlossaryTerms();
    const labels = terms.map((term) => term.label);
    const longDefinitions = terms
      .filter((term) => sentences(term.definition).length > 2)
      .map((term) => term.id);

    expect(terms.length).toBeGreaterThanOrEqual(25);
    expect(longDefinitions).toStrictEqual([]);
    expect(labels).toStrictEqual(
      [...labels].sort((left, right) =>
        left.localeCompare(right, "en", { sensitivity: "base" })
      )
    );
    expect(new Set(terms.map((term) => term.id)).size).toBe(terms.length);
  });

  it("copies API field and concept sentences for the shared vocabulary", () => {
    expect({
      availability: lookupGlossaryTerm("availability").definition,
      fips: lookupGlossaryTerm("fips").definition,
      indicator: lookupGlossaryTerm("indicator").definition,
      limitations: lookupGlossaryTerm("limitations").definition,
      measure: lookupGlossaryTerm("measure").definition,
      methodology: lookupGlossaryTerm("methodology").definition,
      provenance: lookupGlossaryTerm("provenance_ref").definition,
      release: lookupGlossaryTerm("release").definition,
      releaseId: lookupGlossaryTerm("release_id").definition,
      valueState: lookupGlossaryTerm("value_state").definition,
      vintage: lookupGlossaryTerm("vintage").definition,
    }).toStrictEqual({
      availability: API_DEFINITIONS.availability,
      fips: API_DEFINITIONS.fips,
      indicator: API_DEFINITIONS.indicator,
      limitations: API_DEFINITIONS.limitations,
      measure: API_DEFINITIONS.measure,
      methodology: API_DEFINITIONS.methodology,
      provenance: API_DEFINITIONS.provenance_ref,
      release: API_DEFINITIONS.release,
      releaseId: API_DEFINITIONS.release_id,
      valueState: API_DEFINITIONS.value_state,
      vintage: API_DEFINITIONS.vintage,
    });
  });

  it("fails the docs build check when a term id is missing", () => {
    expect(() => lookupGlossaryTerm("not-a-term")).toThrow(
      'Unknown glossary term "not-a-term".'
    );
    expect(
      glossaryTermProblems(
        '<p><Term id="not-a-term" /></p>',
        "content/docs/develop/quickstart.mdx"
      )
    ).toStrictEqual([
      'content/docs/develop/quickstart.mdx: unknown glossary term "not-a-term". Add it to src/features/docs/glossary-terms.ts.',
    ]);
    expect(
      glossaryTermProblems("<Term>value</Term>", "content/docs/glossary.mdx")
    ).toStrictEqual(["content/docs/glossary.mdx: <Term> requires an id."]);
  });

  it("accepts the glossary ids used in the current docs", () => {
    const docsRoot = path.join(process.cwd(), "content", "docs");
    const problems: string[] = [];
    for (const file of mdxFiles(docsRoot)) {
      problems.push(
        ...glossaryTermProblems(
          readFileSync(file, "utf-8"),
          path.relative(process.cwd(), file)
        )
      );
    }
    expect(problems).toStrictEqual([]);
  });
});
