import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BANNED_TERMS } from "../scripts/docs-banned-terms.mjs";
import {
  DEVELOPER_PAGE_WORD_BUDGET,
  checkBannedTerms,
  checkDatedTestLog,
  checkDocsCopyStructure,
  checkMissingDescription,
  checkTabGroupIds,
  checkWarningCallouts,
  checkWordBudget,
  formatDocsCheckFinding,
  isDeveloperDocsPage,
  proseWordCount,
} from "../scripts/docs-check-rules.mjs";

const developerPage = "content/docs/develop/example.mdx";
const productPage = "content/docs/example.mdx";

function page(body: string, description = "What this page is for."): string {
  return `---\ntitle: Example\ndescription: ${description}\n---\n\n${body}\n`;
}

function words(count: number): string {
  return Array.from({ length: count }, () => "word").join(" ");
}

describe("dated test-log sentences", () => {
  it("fails a developer page that starts a sentence with a calendar date", () => {
    const findings = checkDatedTestLog(
      developerPage,
      page("On 25 October 2026, the sample returned HTTP 200.")
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(6);
    expect(findings[0]?.rule).toBe("dated-test-log");
    expect(formatDocsCheckFinding(findings[0])).toContain(
      `${developerPage}:6: dated-test-log:`
    );
  });

  it("fails a developer page that records when a payload was retrieved", () => {
    const findings = checkDatedTestLog(
      developerPage,
      page("Values were retrieved on 18 October 2026 from the sample.")
    );
    expect(findings.map((finding) => finding.rule)).toStrictEqual([
      "dated-test-log",
    ]);
  });

  it("passes a sample that does not record a test date", () => {
    expect(
      checkDatedTestLog(
        developerPage,
        page("A sample GET returned HTTP 200. source_retrieved_at was null.")
      )
    ).toStrictEqual([]);
  });

  it("passes the same dated sentence on a product page", () => {
    expect(
      checkDatedTestLog(
        productPage,
        page("On 25 October 2026, the sample returned HTTP 200.")
      )
    ).toStrictEqual([]);
  });

  it("passes a dated sentence marked as an exception", () => {
    expect(
      checkDatedTestLog(
        developerPage,
        page(
          "<!-- docs-check-exception: dated-test-log -->\nOn 25 October 2026, the sample returned HTTP 200."
        )
      )
    ).toStrictEqual([]);
  });
});

describe("developer page word budget", () => {
  it("fails a developer page above the budget", () => {
    const findings = checkWordBudget(
      developerPage,
      page(words(DEVELOPER_PAGE_WORD_BUDGET + 1))
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("word-budget");
    expect(findings[0]?.fix).toContain(String(DEVELOPER_PAGE_WORD_BUDGET));
    expect(proseWordCount(page(words(DEVELOPER_PAGE_WORD_BUDGET + 1)))).toBe(
      DEVELOPER_PAGE_WORD_BUDGET + 1
    );
  });

  it("passes a developer page at the budget and ignores fenced code", () => {
    const fenced = `\`\`\`json\n${words(500)}\n\`\`\``;
    expect(
      checkWordBudget(
        developerPage,
        page(`${words(DEVELOPER_PAGE_WORD_BUDGET)}\n\n${fenced}`)
      )
    ).toStrictEqual([]);
  });

  it("passes a long product page", () => {
    expect(
      checkWordBudget(productPage, page(words(DEVELOPER_PAGE_WORD_BUDGET + 50)))
    ).toStrictEqual([]);
  });

  it("passes a developer page with a documented word-budget exception", () => {
    expect(
      checkWordBudget(
        developerPage,
        `---\ntitle: Example\ndescription: What this page is for.\n---\n<!-- docs-check-exception: word-budget: reference tables stay together -->\n\n${words(DEVELOPER_PAGE_WORD_BUDGET + 5)}\n`
      )
    ).toStrictEqual([]);
  });
});

describe("page description", () => {
  it("fails a page with no description", () => {
    const findings = checkMissingDescription(
      productPage,
      "---\ntitle: Example\n---\n\nBody\n"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("missing-description");
    expect(findings[0]?.line).toBe(1);
    expect(findings[0]?.fix).toContain("description");
  });

  it("fails an empty description on its own line", () => {
    const findings = checkMissingDescription(
      productPage,
      "---\ntitle: Example\ndescription:\n---\n"
    );
    expect(findings[0]?.line).toBe(3);
    expect(findings[0]?.rule).toBe("missing-description");
  });

  it("passes a page with a description", () => {
    expect(checkMissingDescription(productPage, page("Body"))).toStrictEqual(
      []
    );
  });
});

describe("warning callouts", () => {
  it("fails a page with a second warning callout", () => {
    const findings = checkWarningCallouts(
      productPage,
      page(
        '<Callout type="warning">Once.</Callout>\n<Callout type="warn">Twice.</Callout>'
      )
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("warning-callout");
    expect(findings[0]?.line).toBe(7);
    expect(findings[0]?.fix).toContain("one warning Callout");
  });

  it("passes one warning callout and extra info callouts", () => {
    expect(
      checkWarningCallouts(
        productPage,
        page(
          '<Callout type="warning">Once.</Callout>\n<Callout type="info">Note.</Callout>'
        )
      )
    ).toStrictEqual([]);
  });

  it("passes a second warning callout with an exception marker", () => {
    expect(
      checkWarningCallouts(
        productPage,
        page(
          '<Callout type="warning">Once.</Callout>\n<!-- docs-check-exception: warning-callout -->\n<Callout type="warn">Twice.</Callout>'
        )
      )
    ).toStrictEqual([]);
  });
});

describe("tab group ids", () => {
  it("fails a tab group without a groupId", () => {
    const findings = checkTabGroupIds(
      developerPage,
      page('<Tabs items={["Scoring", "Evidence"]}>')
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("tab-group-id");
    expect(findings[0]?.line).toBe(6);
    expect(findings[0]?.fix).toContain("groupId");
  });

  it("passes a tab group with a persistent groupId", () => {
    expect(
      checkTabGroupIds(
        developerPage,
        page(
          '<Tabs groupId="atlas-county-report-template" items={["Scoring"]} persist>'
        )
      )
    ).toStrictEqual([]);
  });

  it("passes a tab group whose missing groupId is an exception", () => {
    expect(
      checkTabGroupIds(
        developerPage,
        page(
          '<!-- docs-check-exception: tab-group-id -->\n<Tabs items={["Scoring"]}>'
        )
      )
    ).toStrictEqual([]);
  });
});

describe("banned terms", () => {
  it("fails prose that uses a banned term", () => {
    const findings = checkBannedTerms(
      developerPage,
      page(
        "The public overview states a default pre-execution logical-result ceiling of 10,000."
      )
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("banned-term");
    expect(findings[0]?.line).toBe(6);
    expect(findings[0]?.fix).toContain("result limit");
    expect(formatDocsCheckFinding(findings[0])).toMatch(
      /^content\/docs\/develop\/example\.mdx:6: banned-term: /
    );
  });

  it("passes the replacement wording and an exact token in code", () => {
    expect(
      checkBannedTerms(
        developerPage,
        page(
          "The default result limit is 10,000. Responses use `Cache-Control: no-store`."
        )
      )
    ).toStrictEqual([]);
  });

  it("passes a banned term marked as an exception", () => {
    expect(
      checkBannedTerms(
        developerPage,
        page(
          "<!-- docs-check-exception: banned-term -->\nThe page says consumer-safe once."
        )
      )
    ).toStrictEqual([]);
  });

  it("keeps the banned-term list in one file copied from the API style guide", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/docs-banned-terms.mjs"),
      "utf-8"
    );
    const rules = fs.readFileSync(
      path.join(process.cwd(), "scripts/docs-check-rules.mjs"),
      "utf-8"
    );
    expect(source).toContain(
      "one-health-lyme-gap-atlas-api/blob/main/docs/api-writing-style.md"
    );
    expect(rules).not.toContain("logical-result ceiling");
    expect(
      BANNED_TERMS.some(
        (term) => term.avoid === "pre-execution logical-result ceiling"
      )
    ).toBeTruthy();
    expect(BANNED_TERMS.some((term) => term.mechanical === false)).toBeTruthy();
  });
});

describe("current documentation pages", () => {
  it("treats develop pages and the access guide as developer pages", () => {
    expect(
      isDeveloperDocsPage("content/docs/develop/geography.mdx")
    ).toBeTruthy();
    expect(
      isDeveloperDocsPage("content/docs/api-mcp-and-access.mdx")
    ).toBeTruthy();
    expect(
      isDeveloperDocsPage("content/docs/api-reference/counties/index.mdx")
    ).toBeFalsy();
  });

  it("passes every current docs page", () => {
    const root = path.join(process.cwd(), "content/docs");
    const findings = walk(root).flatMap((file) =>
      checkDocsCopyStructure(
        path.relative(process.cwd(), file),
        fs.readFileSync(file, "utf-8")
      )
    );
    expect(findings.map(formatDocsCheckFinding)).toStrictEqual([]);
  });
});

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}
