import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  warningCalloutCount,
  warningCalloutProblems,
} from "@/lib/docs-warning-callouts";

const docsRoot = path.join(process.cwd(), "content", "docs");
const temporaryDirectories: string[] = [];

describe("docs warning callouts", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });

  it("counts a warning callout and the guardrail component as one each", () => {
    expect(
      warningCalloutCount('<Callout title="Interpret with care" type="warn">')
    ).toBe(1);
    expect(warningCalloutCount('<Callout type="info">')).toBe(0);
    expect(warningCalloutCount("<InterpretationGuardrailCopy />")).toBe(1);
    expect(
      warningCalloutCount(
        '<Callout type="warn"></Callout>\n<InterpretationGuardrailCopy />'
      )
    ).toBe(2);
  });

  it("allows at most one warning callout on each docs page", () => {
    expect(warningCalloutProblems(docsRoot)).toStrictEqual([]);
  });

  it("still rejects a second warning and a guardrail when no exception is marked", () => {
    const directory = fs.mkdtempSync(path.join(tmpdir(), "docs-warnings-"));
    temporaryDirectories.push(directory);
    fs.writeFileSync(
      path.join(directory, "page.mdx"),
      [
        '<Callout type="warning">One.</Callout>',
        "<InterpretationGuardrailCopy />",
      ].join("\n"),
      "utf-8"
    );
    const problems = warningCalloutProblems(directory);
    expect(problems.length).toBeGreaterThan(0);
    expect(
      problems.some((problem) => problem.includes("warning-callout"))
    ).toBeTruthy();
  });

  it("honors the warning-callout exception marker in the shared gate", () => {
    const directory = fs.mkdtempSync(path.join(tmpdir(), "docs-warnings-ok-"));
    temporaryDirectories.push(directory);
    fs.writeFileSync(
      path.join(directory, "page.mdx"),
      [
        '<Callout type="warning">One.</Callout>',
        "<!-- docs-check-exception: warning-callout -->",
        '<Callout type="warn">Two.</Callout>',
      ].join("\n"),
      "utf-8"
    );
    expect(warningCalloutProblems(directory)).toStrictEqual([]);
  });

  it("passes npm run docs:check when the extra warning has the documented marker", () => {
    const fixture = path.join(
      docsRoot,
      "api-reference",
      "_warning-callout-exception.mdx"
    );
    fs.writeFileSync(
      fixture,
      [
        "---",
        "title: Warning exception fixture",
        "description: Temporary page for the warning-callout exception.",
        "---",
        "",
        '<Callout type="warning">One.</Callout>',
        "<!-- docs-check-exception: warning-callout -->",
        '<Callout type="warning">Two.</Callout>',
        "",
      ].join("\n"),
      "utf-8"
    );
    try {
      const output = execFileSync("npm", ["run", "docs:check"], {
        cwd: process.cwd(),
        encoding: "utf-8",
      });
      expect(output).toContain("Documentation validation passed");
      expect(output).toContain(
        "Documentation warning callouts passed (at most one per page)."
      );
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it("uses cards for the developer guide map", () => {
    const overview = fs.readFileSync(
      path.join(docsRoot, "develop", "index.mdx"),
      "utf-8"
    );
    expect(overview).toContain("<Cards>");
    expect(overview).toContain('title="Quickstart"');
    expect(overview).toContain(
      'description="Finish one county observation read"'
    );
    expect(overview).not.toContain("| Guide | Open it to |");
  });
});
