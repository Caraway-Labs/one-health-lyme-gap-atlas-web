import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  warningCalloutCount,
  warningCalloutProblems,
} from "@/lib/docs-warning-callouts";

const docsRoot = path.join(process.cwd(), "content", "docs");

describe("docs warning callouts", () => {
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
