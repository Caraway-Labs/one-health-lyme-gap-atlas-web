import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const HEX_ALLOWED = new Set([
  "src/app/globals.css",
  "src/components/atlas-map.tsx",
  "src/features/geographic-explorer/explorer.css",
  "src/features/geographic-explorer/maps.tsx",
  "src/lib/atlas-ui.ts",
]);

const BUTTON_CLASS = /className\s*=\s*(?:["'`]button\b|\{["'`]button\b)/;
const GENERIC_CARD_CLASS =
  /className\s*=\s*(?:["'`]card(?:["'`]|\s)|\{["'`]card(?:["'`]|\s))/;
const GENERIC_CARD_SELECTOR = /(?:^|[\s,{])\.card(?:\.|[\s,{:#[]|$)/;
const HEX_COLOR = /#[0-9A-Fa-f]{3,8}\b/;

export function checkDesignSystem(root = process.cwd()) {
  const sourceRoot = path.join(root, "src");
  const issues = [];
  for (const file of walk(sourceRoot)) {
    const relativePath = path.relative(root, file).replaceAll("\\", "/");
    if (relativePath.startsWith("src/generated/")) {
      continue;
    }
    const contents = readFileSync(file, "utf-8");
    if (BUTTON_CLASS.test(contents)) {
      issues.push(`${relativePath}: do not reintroduce className="button"`);
    }
    if (GENERIC_CARD_CLASS.test(contents)) {
      issues.push(`${relativePath}: do not reintroduce className="card"`);
    }
    if (
      relativePath.endsWith(".css") &&
      GENERIC_CARD_SELECTOR.test(contents) &&
      !relativePath.endsWith("globals.css")
    ) {
      issues.push(`${relativePath}: generic .card selector is reserved`);
    }
    if (!HEX_ALLOWED.has(relativePath) && HEX_COLOR.test(contents)) {
      issues.push(
        `${relativePath}: hardcoded hex is limited to documented viz/domain files`
      );
    }
  }
  return issues;
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      files.push(...walk(filePath));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(filePath))) {
      files.push(filePath);
    }
  }
  return files;
}

const isDirectRun = process.argv[1] === import.meta.filename;
if (isDirectRun) {
  const issues = checkDesignSystem();
  if (issues.length > 0) {
    console.error(issues.join("\n"));
    process.exit(1);
  }
  console.log("Design-system guard passed.");
}
