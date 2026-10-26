import { changelogPageProblems } from "../src/lib/api-changelog.ts";

const problems = changelogPageProblems(process.cwd());
if (problems.length > 0) {
  console.error("API changelog pin check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("API changelog pin check passed.");
}
