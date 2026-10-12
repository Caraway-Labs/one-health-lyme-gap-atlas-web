import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const docsRoot = path.join(process.cwd(), "content", "docs");

function readDoc(relativePath: string): string {
  return fs.readFileSync(path.join(docsRoot, relativePath), "utf-8");
}

const sourcePage = readDoc("sources-and-canonical-evidence.mdx");

describe("sources and canonical evidence documentation", () => {
  it("places the page with the evidence guides", () => {
    const navigation = JSON.parse(
      fs.readFileSync(path.join(docsRoot, "meta.json"), "utf-8")
    ) as { pages?: string[] };

    expect(navigation.pages).toStrictEqual(
      expect.arrayContaining(["sources-and-canonical-evidence"])
    );
    const pages = navigation.pages ?? [];
    expect(pages.indexOf("sources-and-canonical-evidence")).toBe(
      pages.indexOf("evidence-and-uncertainty") + 1
    );
  });

  it("explains the adapter path and the preserved evidence facts", () => {
    const requiredPhrases = [
      "source-specific adapter",
      "terminology/semantic mapping",
      "canonical Atlas evidence and provenance",
      "Source and publisher",
      "Dataset, version, and vintage",
      "Observation period",
      "Units and denominators",
      "Transformation and method",
      "Lineage and provenance",
      "CSV, XLSX, an API, a scientific file",
      "Transport format and source authorization are separate",
      "open-data-first",
    ];
    const missing = requiredPhrases.filter(
      (phrase) => !sourcePage.includes(phrase)
    );

    expect(missing).toStrictEqual([]);
  });

  it("enumerates missing, suppressed, unavailable, and uncertain states", () => {
    const states = [
      "**Missing**",
      "**Suppressed**",
      "**Unavailable**",
      "**Uncertain**",
    ];
    const missing = states.filter((state) => !sourcePage.includes(state));
    const contractStates = [
      "`OBSERVED`",
      "`ZERO`",
      "`MISSING`",
      "`SUPPRESSED`",
      "`UNAVAILABLE`",
      "`NO_COUNTY_LINKED_RECORD`",
    ];
    const missingContractStates = contractStates.filter(
      (state) => !sourcePage.includes(state)
    );

    expect(missing).toStrictEqual([]);
    expect(missingContractStates).toStrictEqual([]);
    expect(sourcePage).toContain("not an extra public value-state code");
  });

  it("distinguishes released capability from architectural intent", () => {
    const requiredPhrases = [
      "Available now",
      "Planned",
      "Not supported",
      "CDC Lyme/TBRD Message Mapping Guide (MMG)",
      "PHIN VADS",
      "USCDI",
      "FHIR R4",
      "US Core",
      "Bulk FHIR",
      "LOINC",
      "every future source must be FHIR",
      "Live EHR connectivity, TEFCA",
    ];
    const missing = requiredPhrases.filter(
      (phrase) => !sourcePage.includes(phrase)
    );

    expect(missing).toStrictEqual([]);
  });

  it("points at the owning provenance, API, MCP, and methodology pages", () => {
    const links = [
      "](/docs/evidence-and-uncertainty)",
      "](/docs/releases-and-methodology)",
      "](/docs/develop/provenance)",
      "](/docs/develop/resources)",
      "](/docs/develop/geography)",
      "](/docs/develop).",
      "](/docs/api-reference)",
      "](/docs/api-reference/provenance)",
      "](/docs/api-reference/observations)",
      "](/docs/api-reference/schemas)",
      "](/docs/api-mcp-and-access)",
      "](/docs/current-capabilities)",
      "](https://api.onehealthatlas.org/openapi.json)",
      "](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-mcp)",
    ];
    const missing = links.filter((link) => !sourcePage.includes(link));

    expect(missing).toStrictEqual([]);
    expect(sourcePage).toContain("does not copy those schemas");
    expect(sourcePage).toContain(
      "MCP contracts and tests in the [Atlas MCP repository]"
    );
  });

  it("keeps the flexible-source story on the provenance pages", () => {
    const provenancePages = [
      "evidence-and-uncertainty.mdx",
      "develop/provenance.mdx",
      "api-mcp-and-access.mdx",
      "releases-and-methodology.mdx",
    ];

    const missingLinks = provenancePages.filter(
      (page) =>
        !readDoc(page).includes("](/docs/sources-and-canonical-evidence)")
    );

    expect(missingLinks).toStrictEqual([]);
    expect(readDoc("develop/provenance.mdx")).toContain(
      "Source identity survives normalization"
    );
    expect(readDoc("evidence-and-uncertainty.mdx")).toContain(
      "Missing, suppressed, unavailable, and uncertain inputs stay visible"
    );
  });

  it("does not claim unreleased clinical connectivity or excluded geographies", () => {
    const corpus = [
      sourcePage,
      readDoc("evidence-and-uncertainty.mdx"),
      readDoc("develop/provenance.mdx"),
      readDoc("api-mcp-and-access.mdx"),
      readDoc("current-capabilities.mdx"),
      readDoc("faq-and-troubleshooting.mdx"),
    ].join("\n");
    const violations = [
      corpus.match(/Alaska|Hawaii/)?.[0],
      corpus.includes("live EHR connection is available")
        ? "live EHR connection is available"
        : undefined,
      corpus.includes("production clinical-laboratory feed is available")
        ? "production clinical-laboratory feed is available"
        : undefined,
      corpus.includes("every Atlas source is FHIR")
        ? "every Atlas source is FHIR"
        : undefined,
      corpus.includes("interoperability certification is complete")
        ? "interoperability certification is complete"
        : undefined,
    ].filter((violation) => violation !== undefined);

    expect(violations).toStrictEqual([]);
  });
});
