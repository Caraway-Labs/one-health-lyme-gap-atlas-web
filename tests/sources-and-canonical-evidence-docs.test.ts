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
      "tests in the [Atlas MCP repository](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-mcp)"
    );
  });

  it("documents the released MCP evidence surface and keeps smoke-only historical", () => {
    const requiredPhrases = [
      "atlas_discover_indicators",
      "atlas_get_county_profile",
      "atlas_get_evidence_provenance",
      "atlas_resolve_geographies",
      "docs/public-evidence-tools.md",
      "docs/adr/0003-public-evidence-tools.md",
      "does not establish that evidence exists",
      "smoke tools only is historical",
      "Live EHR connectivity, TEFCA",
    ];
    const missing = requiredPhrases.filter(
      (phrase) => !sourcePage.includes(phrase)
    );
    const accessPage = readDoc("api-mcp-and-access.mdx");
    const provenancePage = readDoc("develop/provenance.mdx");
    const linkedPagesMissing = [
      "atlas_get_county_profile",
      "atlas_get_evidence_provenance",
      "public-evidence-tools.md",
      "smoke-only",
      "historical",
    ].filter(
      (phrase) =>
        !accessPage.includes(phrase) || !provenancePage.includes(phrase)
    );

    const accessFacts = [
      "issuecomment-6116902766",
      "exactly six tools; that receipt is historical",
      "exactly four tools",
      "](/docs/develop/mcp-clients)",
    ].filter((phrase) => accessPage.split(phrase).length === 1);

    expect(missing).toStrictEqual([]);
    expect(linkedPagesMissing).toStrictEqual([]);
    expect(accessFacts).toStrictEqual([]);
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

  it("does not claim unreleased clinical connectivity or include Alaska and Hawaii", () => {
    const corpus = [
      sourcePage,
      readDoc("evidence-and-uncertainty.mdx"),
      readDoc("develop/provenance.mdx"),
      readDoc("api-mcp-and-access.mdx"),
      readDoc("current-capabilities.mdx"),
      readDoc("faq-and-troubleshooting.mdx"),
    ].join("\n");
    const coverage = "lower 48 states and the District of Columbia";
    const violations = [
      ...falseGeographyInclusions(corpus),
      sourcePage.includes(coverage)
        ? undefined
        : `missing coverage: ${coverage}`,
      falseGeographyInclusions("Alaska and Hawaii are not supported.")
        .length === 0
        ? undefined
        : "not-supported wording was rejected",
      falseGeographyInclusions("Coverage includes Alaska and Hawaii.")
        .length === 1
        ? undefined
        : "false inclusion wording was accepted",
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

  it("rejects a current-release claim that MCP is smoke tools only", () => {
    const contentFiles = collectDocFiles(docsRoot);
    const bannedPhrases = [
      "Production MCP does not serve",
      "Production Atlas-data MCP is not available",
      "REST remains the way to read Atlas data",
      "REST remains the supported interface for Atlas data",
      "does not return Atlas evidence",
      "development MCP server does not read",
      "production MCP is not the data interface",
      "exposes smoke tools only",
      "with smoke tools only",
    ];
    const problems: string[] = [];

    for (const file of contentFiles) {
      const relativeFile = path.relative(process.cwd(), file);
      const text = fs.readFileSync(file, "utf-8");
      for (const phrase of bannedPhrases) {
        if (text.includes(phrase)) {
          problems.push(`${relativeFile}: ${phrase}`);
        }
      }
      for (const sentence of text.split(/\n|(?<=\.)\s+/u)) {
        const claimsSmokeOnly = /smoke tools only|smoke-only/iu.test(sentence);
        const labelsHistorical = /\bhistorical\b/iu.test(sentence);
        if (claimsSmokeOnly && !labelsHistorical) {
          problems.push(`${relativeFile}: ${sentence.trim()}`);
        }
      }
    }

    expect(problems).toStrictEqual([]);
  });
});

function falseGeographyInclusions(text: string): string[] {
  const place = /\b(?:Alaska|Hawaii)\b/u;
  const exclusion =
    /\b(?:not supported|not included|does not include|do not include|are not|is not|outside|excluded|excluding|never|unsupported)\b/iu;
  const inclusion =
    /\b(?:included|includes|including|supported|supports|covered|covers|covering|in scope|available)\b/iu;
  const problems: string[] = [];

  for (const sentence of text.split(/\n|(?<=\.)\s+/u)) {
    if (!place.test(sentence) || exclusion.test(sentence)) {
      continue;
    }
    if (inclusion.test(sentence)) {
      problems.push(sentence.trim());
    }
  }
  return problems;
}

function collectDocFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDocFiles(fullPath));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}
