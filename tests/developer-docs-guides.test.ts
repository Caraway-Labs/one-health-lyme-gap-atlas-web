import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const docsRoot = path.join(process.cwd(), "content", "docs");
const developRoot = path.join(docsRoot, "develop");

const developPages = [
  "index",
  "quickstart",
  "rest",
  "geography",
  "resources",
  "provenance",
  "workflows",
  "support",
] as const;

function readPage(slug: string): string {
  return fs.readFileSync(path.join(developRoot, `${slug}.mdx`), "utf-8");
}

const developText = developPages.map((slug) => readPage(slug)).join("\n");

describe("developer documentation guides", () => {
  it("lists the MVP guide order in the developers folder", () => {
    const folderNavigation = JSON.parse(
      fs.readFileSync(path.join(developRoot, "meta.json"), "utf-8")
    ) as { title?: string; pages?: string[] };
    const rootNavigation = JSON.parse(
      fs.readFileSync(path.join(docsRoot, "meta.json"), "utf-8")
    ) as { pages?: string[] };

    expect(folderNavigation.title).toBe("Developers");
    expect(folderNavigation.pages).toStrictEqual([...developPages]);
    expect(rootNavigation.pages).toContain("develop");
  });

  it("gives every guide a title and description", () => {
    const missingFrontmatter = developPages.filter((slug) => {
      const content = readPage(slug);
      return !(
        content.startsWith("---\n") &&
        /^title:\s+\S.+$/m.test(content) &&
        /^description:\s+\S.+$/m.test(content)
      );
    });

    expect(missingFrontmatter).toStrictEqual([]);
  });

  it("keeps public reads anonymous and inside the published contract", () => {
    const requiredPhrases = [
      "https://api.onehealthatlas.org",
      "https://api.onehealthatlas.org/openapi.json",
      "/docs/api-reference",
      "case_count_floor_2023",
      "geography_id=36061",
      "RATE_LIMITED",
      "Retry-After",
      "RESOURCE_NOT_FOUND",
      "UNSUPPORTED_FILTER",
      "UNSUPPORTED_STRATIFICATION",
      "QUERY_TOO_BROAD",
      "CANONICAL_DATA_UNAVAILABLE",
      "environmental_context",
      "no API key",
      "OBSERVED",
      "ZERO",
      "MISSING",
      "SUPPRESSED",
      "UNAVAILABLE",
      "NO_COUNTY_LINKED_RECORD",
      "NO_RECORDS",
    ];
    const missingPhrases = requiredPhrases.filter(
      (phrase) => !developText.includes(phrase)
    );

    expect(missingPhrases).toStrictEqual([]);
    expect(developText).not.toContain("](/docs/api-reference");
  });

  it("does not invent credentials, SDKs, quotas, or out-of-scope states", () => {
    const violations = [
      developText.match(/Alaska|Hawaii/)?.[0],
      developText.match(/\b(?<postal>AK|HI)\b/)?.[0],
      developText.includes("60 requests") ? "60 requests" : undefined,
      developText.match(/Bearer |API token|install the SDK/i)?.[0],
      developText.includes("npm install") ? "npm install" : undefined,
    ].filter((violation) => violation !== undefined);

    expect(violations).toStrictEqual([]);
  });
});
