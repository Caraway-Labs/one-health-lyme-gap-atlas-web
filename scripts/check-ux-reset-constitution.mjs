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
