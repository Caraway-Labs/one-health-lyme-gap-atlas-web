import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkUxResetConstitution,
  validateConstitutionText,
} from "../scripts/check-ux-reset-constitution.mjs";

const FIXTURES = path.join(
  process.cwd(),
  "tests/fixtures/ux-reset-constitution"
);

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

  it("fails when the constitution file is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ux-reset-missing-"));
    const issues = checkUxResetConstitution(dir);
    expect(issues.some((issue) => issue.includes("is missing"))).toBe(true);
  });

  it("fails when a required section heading is missing", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ux-reset-heading-"));
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    writeFileSync(
      path.join(dir, "docs/UX_RESET_CONSTITUTION.md"),
      "# incomplete\n\n## Agent and contributor governance\n",
      "utf-8"
    );
    writeFileSync(
      path.join(dir, "AGENTS.md"),
      readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf-8"),
      "utf-8"
    );
    const issues = checkUxResetConstitution(dir);
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some((issue) => issue.includes("missing required section heading"))
    ).toBe(true);
  });

  it("fails when AGENTS.md loses constitution linkage", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ux-reset-agents-"));
    mkdirSync(path.join(dir, "docs"), { recursive: true });
    writeFileSync(
      path.join(dir, "docs/UX_RESET_CONSTITUTION.md"),
      readFileSync(
        path.join(process.cwd(), "docs/UX_RESET_CONSTITUTION.md"),
        "utf-8"
      ),
      "utf-8"
    );
    writeFileSync(path.join(dir, "AGENTS.md"), "# no linkage\n", "utf-8");
    const issues = checkUxResetConstitution(dir);
    expect(issues.some((issue) => issue.includes("AGENTS.md"))).toBe(true);
  });

  it("fails for a headings-only constitution without substantive rules", () => {
    const headingsOnly = readFileSync(
      path.join(FIXTURES, "headings-only.md"),
      "utf-8"
    );
    const issues = validateConstitutionText(headingsOnly);
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some((issue) => issue.includes("missing required substantive rule"))
    ).toBe(true);
  });

  it("rejects mapping not-yet-loaded wording into evidence Unavailable", () => {
    const constitution = readFileSync(
      path.join(process.cwd(), "docs/UX_RESET_CONSTITUTION.md"),
      "utf-8"
    );
    expect(constitution).toMatch(/\*\*Do not map\*\*/);
    expect(constitution).not.toMatch(/not yet loaded—/i);
  });
});
