import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { glossaryTermProblems } from "../src/features/docs/glossary-terms";

function mdxFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...mdxFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".mdx")) files.push(fullPath);
  }
  return files;
}

const docsRoot = path.join(process.cwd(), "content", "docs");
const problems: string[] = [];
for (const file of mdxFiles(docsRoot)) {
  const relativeFile = path.relative(process.cwd(), file);
  problems.push(
    ...glossaryTermProblems(readFileSync(file, "utf-8"), relativeFile)
  );
}

if (problems.length > 0) {
  console.error("Glossary term check failed:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("Glossary term check passed.");
}
