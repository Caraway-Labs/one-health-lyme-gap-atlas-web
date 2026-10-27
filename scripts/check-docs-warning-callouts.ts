import path from "node:path";

import { warningCalloutProblems } from "../src/lib/docs-warning-callouts";

const problems = warningCalloutProblems(
  path.join(process.cwd(), "content", "docs")
);

if (problems.length > 0) {
  console.error("Documentation warning callouts failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Documentation warning callouts passed (at most one per page).");
}
