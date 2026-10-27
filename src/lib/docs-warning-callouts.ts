import fs from "node:fs";
import path from "node:path";

import {
  checkWarningCallouts,
  formatDocsCheckFinding,
} from "../../scripts/docs-check-rules.mjs";

const CALLOUT_TAG = /<Callout\b(?<attributes>[^>]*)>/g;
const GUARDRAIL_TAG = /<InterpretationGuardrailCopy\b/g;
const CALLOUT_TYPE = /type=["'](?<value>[^"']+)["']/u;

function calloutType(attributes: string): string {
  return CALLOUT_TYPE.exec(attributes)?.groups?.value ?? "info";
}

/** Raw count. Exceptions are applied by `warningCalloutProblems`, not here. */
export function warningCalloutCount(source: string): number {
  const guardrails = source.match(GUARDRAIL_TAG)?.length ?? 0;
  let warnings = guardrails;
  for (const match of source.matchAll(CALLOUT_TAG)) {
    const value = calloutType(match.groups?.attributes ?? "");
    if (value === "warn" || value === "warning") warnings += 1;
  }
  return warnings;
}

function markdownFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const nested of markdownFiles(fullPath)) files.push(nested);
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Pages may state one warning. `InterpretationGuardrailCopy` is that warning.
 * This is the same rule as `checkWarningCallouts`, including its exception marker.
 */
export function warningCalloutProblems(docsRoot: string): string[] {
  const problems: string[] = [];
  for (const file of markdownFiles(docsRoot)) {
    const findings = checkWarningCallouts(
      path.relative(docsRoot, file),
      fs.readFileSync(file, "utf-8")
    );
    for (const finding of findings) {
      problems.push(formatDocsCheckFinding(finding));
    }
  }
  return problems;
}
