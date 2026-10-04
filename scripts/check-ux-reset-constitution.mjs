import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const REQUIRED_SECTIONS = [
  "## Agent and contributor governance",
  "## Lean development rule",
  "## Phase boundaries",
  "## Evidence states: Available, Limited, Unavailable",
  "### Missing is not zero",
  "### Review priority is not disease risk",
  "## Semantic color and anti-patterns",
  "## Provenance layering",
  "## Motion restraint",
  "## Page jobs (do not merge destinations)",
  "## No contextual help in Reset V1",
];

const REQUIRED_AGENTS_SNIPPETS = [
  "docs/UX_RESET_CONSTITUTION.md",
  "Do not reopen settled",
];

export function checkUxResetConstitution(root = ROOT) {
  const issues = [];
  const constitutionPath = path.join(root, "docs/UX_RESET_CONSTITUTION.md");
  const agentsPath = path.join(root, "AGENTS.md");

  let constitution;
  try {
    constitution = readFileSync(constitutionPath, "utf-8");
  } catch {
    issues.push("docs/UX_RESET_CONSTITUTION.md is missing");
    return issues;
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!constitution.includes(section)) {
      issues.push(
        `docs/UX_RESET_CONSTITUTION.md: missing required section heading "${section}"`
      );
    }
  }

  let agents;
  try {
    agents = readFileSync(agentsPath, "utf-8");
  } catch {
    issues.push("AGENTS.md is missing");
    return issues;
  }

  for (const snippet of REQUIRED_AGENTS_SNIPPETS) {
    if (!agents.includes(snippet)) {
      issues.push(`AGENTS.md: missing required reference "${snippet}"`);
    }
  }

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
