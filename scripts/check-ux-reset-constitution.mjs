import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const REQUIRED_SECTIONS = [
  "## Agent and contributor governance",
  "## Lean development rule",
  "## Phase boundaries",
  "## Evidence states: Available, Limited, Unavailable",
  "### Request and transport states (not evidence states)",
  "### Missing is not zero",
  "### Review priority is not disease risk",
  "## Semantic color and anti-patterns",
  "## Provenance layering",
  "### Default evidence disclosure (#409)",
  "## Motion restraint",
  "## Page jobs (do not merge destinations)",
  "## No contextual help in Reset V1",
];

/** Substantive rules — headings alone are insufficient. */
const REQUIRED_SUBSTANTIVE_MARKERS = [
  "API metadata is authoritative",
  "Loading",
  "Unavailable",
  "**Do not map**",
  "Intelligence Feed",
  "#402",
  "Bounded national/state operating picture",
  "no default nationwide county leaderboard",
  "no-signal",
  "insufficient-evidence",
  "Two-county",
  "#398",
  "#418",
  "Surveillance Planning",
  "Evidence Brief / Communication",
  "#399",
  "source family",
  "Observation period",
  "Evidence type",
  "Material caveat",
  "One-action human-readable",
  "Docs/reference",
  "#409",
  "#426",
];

const FORBIDDEN_PHRASES = [
  "not yet loaded—Atlas",
  "not yet loaded— Atlas",
  "not yet loaded—",
];

const REQUIRED_AGENTS_SNIPPETS = [
  "docs/UX_RESET_CONSTITUTION.md",
  "Do not reopen settled",
  "BEGIN:ux-reset-constitution-agent-rules-407",
];

const MISSING_IS_NOT_ZERO_HEADING = "### Missing is not zero";

const API_METADATA_AUTHORITY_LINE =
  "**API metadata is authoritative**; do not infer availability in the browser.";

/**
 * @param {string} constitution Full constitution markdown.
 * @param {string} heading Subsection heading to extract (for example `### Missing is not zero`).
 * @returns {string | null} Body text until the next heading, or null when the heading is absent.
 */
function subsectionBodyAfterHeading(constitution, heading) {
  const start = constitution.indexOf(heading);
  if (start === -1) {
    return null;
  }
  const afterHeading = constitution.slice(start + heading.length);
  const nextHeading = afterHeading.search(/\n#{2,3} /);
  if (nextHeading === -1) {
    return afterHeading;
  }
  return afterHeading.slice(0, nextHeading);
}

/**
 * Bounded rule checks — reject heading-only or contradicted rules while markers remain.
 * @param {string} constitution Full constitution markdown.
 * @returns {string[]} Rule violation messages; empty when all bounded rules pass.
 */
function validateConstitutionRules(constitution) {
  const issues = [];

  const missingBody = subsectionBodyAfterHeading(
    constitution,
    MISSING_IS_NOT_ZERO_HEADING
  );
  if (missingBody === null) {
    issues.push(
      'constitution: rule "missing-is-not-zero-body": section heading not found'
    );
  } else if (missingBody.trim().length < 40) {
    issues.push(
      'constitution: rule "missing-is-not-zero-body": section body removed or empty'
    );
  } else if (!missingBody.includes("not converted to zero")) {
    issues.push(
      'constitution: rule "missing-is-not-zero-body": must state missing records are not converted to zero'
    );
  } else if (!missingBody.includes("Observed or published zero")) {
    issues.push(
      'constitution: rule "missing-is-not-zero-body": must distinguish observed or published zero'
    );
  }

  if (!constitution.includes(API_METADATA_AUTHORITY_LINE)) {
    issues.push(
      'constitution: rule "api-metadata-authoritative": must require authoritative API metadata without optional browser inference'
    );
  }

  const evidenceBlockStart = constitution.indexOf(
    "## Evidence states: Available, Limited, Unavailable"
  );
  const evidenceBlockEnd = constitution.indexOf("## Semantic color");
  if (evidenceBlockStart !== -1 && evidenceBlockEnd !== -1) {
    const evidenceBlock = constitution.slice(
      evidenceBlockStart,
      evidenceBlockEnd
    );
    if (/\boptional\b/i.test(evidenceBlock)) {
      issues.push(
        'constitution: rule "api-metadata-authoritative": optional wording is not allowed in evidence semantics'
      );
    }
    if (/API metadata is optional/i.test(evidenceBlock)) {
      issues.push(
        'constitution: rule "api-metadata-authoritative": API metadata must not be described as optional'
      );
    }
  }

  return issues;
}

/**
 * @param {string} constitution Full constitution markdown.
 * @returns {string[]} Validation issues; empty when the text satisfies the guard.
 */
export function validateConstitutionText(constitution) {
  const issues = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!constitution.includes(section)) {
      issues.push(
        `constitution: missing required section heading "${section}"`
      );
    }
  }

  for (const marker of REQUIRED_SUBSTANTIVE_MARKERS) {
    if (!constitution.includes(marker)) {
      issues.push(
        `constitution: missing required substantive rule "${marker}"`
      );
    }
  }

  for (const forbidden of FORBIDDEN_PHRASES) {
    if (constitution.includes(forbidden)) {
      issues.push(
        `constitution: forbidden phrase links loading to evidence Unavailable ("${forbidden}")`
      );
    }
  }

  issues.push(...validateConstitutionRules(constitution));

  return issues;
}

export function validateAgentsText(agents) {
  const issues = [];
  for (const snippet of REQUIRED_AGENTS_SNIPPETS) {
    if (!agents.includes(snippet)) {
      issues.push(`AGENTS.md: missing required reference "${snippet}"`);
    }
  }
  return issues;
}

export function checkUxResetConstitution(root = ROOT, options = {}) {
  const constitutionRel =
    options.constitutionRel ?? "docs/UX_RESET_CONSTITUTION.md";
  const agentsRel = options.agentsRel ?? "AGENTS.md";
  const constitutionPath = path.join(root, constitutionRel);
  const agentsPath = path.join(root, agentsRel);
  const issues = [];

  if (!existsSync(constitutionPath)) {
    issues.push(`${constitutionRel} is missing`);
    return issues;
  }

  const constitution = readFileSync(constitutionPath, "utf-8");
  issues.push(...validateConstitutionText(constitution));

  if (options.skipAgents) {
    return issues;
  }

  if (!existsSync(agentsPath)) {
    issues.push(`${agentsRel} is missing`);
    return issues;
  }

  const agents = readFileSync(agentsPath, "utf-8");
  issues.push(...validateAgentsText(agents));

  return issues;
}

const isDirectRun = process.argv[1] === import.meta.filename;
if (isDirectRun) {
  const issues = checkUxResetConstitution();
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exit(1);
  }
  console.log("UX Reset constitution guard passed.");
}
