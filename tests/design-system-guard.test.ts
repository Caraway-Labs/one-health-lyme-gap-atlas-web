import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("design-system static guard", () => {
  it("rejects leftover generic button/card classes and chrome hex", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/check-design-system.mjs"],
      { encoding: "utf-8" }
    );
    expect(output).toContain("Design-system guard passed.");
  });
});
