import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkUxResetConstitution } from "../scripts/check-ux-reset-constitution.mjs";

describe("UX Reset constitution guard", () => {
  it("passes the static constitution and AGENTS.md linkage checks", () => {
    expect(checkUxResetConstitution()).toEqual([]);
  });

  it("runs the npm script entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/check-ux-reset-constitution.mjs"],
      { encoding: "utf-8" }
    );
    expect(output).toContain("UX Reset constitution guard passed.");
  });

  it("documents the workshop source gap explicitly", () => {
    const constitution = readFileSync(
      path.join(process.cwd(), "docs/UX_RESET_CONSTITUTION.md"),
      "utf-8"
    );
    expect(constitution).toMatch(/2026-10-03/);
    expect(constitution).toMatch(/Not found in this repository/);
  });
});
