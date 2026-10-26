import { docsLastModifiedProblems } from "../src/lib/docs-last-modified";

const problems = docsLastModifiedProblems(process.cwd());
if (problems.length > 0) {
  console.error("Docs last-updated check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Docs last-updated check passed.");
}
