import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readDoc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

describe("professional workspace Amplitude production checklist", () => {
  it("documents the project 856061 procedure on the analytics contract", () => {
    const contract = readDoc("docs/amplitude-analytics-contract.md");

    expect(contract).toContain(
      "Professional workspace production check (#919)"
    );
    expect(contract).toContain("`route_id` `atlas_explorer`");
    expect(contract).toContain("`/app/settings`");
    expect(contract).toContain(
      "evidence/web-919-production-amplitude-verification.md"
    );
    expect(contract).toContain(
      "https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/381"
    );
  });

  it("records the empty production key and the #380/#381 follow-up", () => {
    const record = readDoc(
      "docs/evidence/web-919-production-amplitude-verification.md"
    );

    expect(record).toContain("856061");
    expect(record).toContain(
      "https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/380"
    );
    expect(record).toContain(
      "https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/381"
    );
    expect(record).toContain('return"".trim()||void 0');
    expect(record).toContain("**Result: key absent.**");
  });

  it("leaves signed-in explore and Settings egress unverified", () => {
    const record = readDoc(
      "docs/evidence/web-919-production-amplitude-verification.md"
    );

    expect(record).toContain("**Result: not observed.**");
    expect(record).toContain("**Result: not run on Settings.**");
    expect(record).toContain("No product UI changed for this verification.");
  });
});
