import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const docsRoot = path.join(repositoryRoot, "content", "docs");
const appRoot = path.join(repositoryRoot, "src", "app");
const errors = [];

function contentPathForSlug(slug) {
  const normalizedSlug = slug === "" ? "index" : slug;
  const candidates = [
    path.join(docsRoot, `${normalizedSlug}.mdx`),
    path.join(docsRoot, `${normalizedSlug}.md`),
    path.join(docsRoot, normalizedSlug, "index.mdx"),
    path.join(docsRoot, normalizedSlug, "index.md"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function routeExists(routePath) {
  const normalizedRoute = routePath === "/" ? "" : routePath.slice(1);
  const routeRoot = path.join(appRoot, normalizedRoute);
  return [
    path.join(routeRoot, "page.tsx"),
    path.join(routeRoot, "page.ts"),
    path.join(routeRoot, "page.mdx"),
    path.join(routeRoot, "route.ts"),
    path.join(routeRoot, "route.tsx"),
  ].some((candidate) => fs.existsSync(candidate));
}

function checkInternalLink(sourceFile, href) {
  if (!href.startsWith("/")) return;
  const [pathPart] = href.split(/[?#]/, 1);
  if (pathPart === "/docs" || pathPart.startsWith("/docs/")) {
    const docsSlug = pathPart.slice("/docs".length).replace(/^\//, "");
    if (!contentPathForSlug(docsSlug)) {
      errors.push(`${sourceFile}: broken docs link ${href}`);
    }
    return;
  }
  if (!routeExists(pathPart)) {
    errors.push(`${sourceFile}: broken Atlas link ${href}`);
  }
}

const contentFiles = fs
  .readdirSync(docsRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:md|mdx)$/.test(entry.name))
  .map((entry) => path.join(docsRoot, entry.name));

if (contentFiles.length === 0) {
  errors.push("content/docs must contain at least one Markdown or MDX page");
}

for (const file of contentFiles) {
  const relativeFile = path.relative(repositoryRoot, file);
  const content = fs.readFileSync(file, "utf-8");
  const frontmatter = content.match(
    /^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---/
  );

  if (frontmatter) {
    if (!/^title:\s*\S.+$/m.test(frontmatter.groups.frontmatter)) {
      errors.push(`${relativeFile}: frontmatter title is required`);
    }
    if (!/^description:\s*\S.+$/m.test(frontmatter.groups.frontmatter)) {
      errors.push(`${relativeFile}: frontmatter description is required`);
    }
  } else {
    errors.push(`${relativeFile}: missing frontmatter`);
  }

  for (const match of content.matchAll(/\]\((?<href>[^)]+)\)/g)) {
    const href = match.groups?.href;
    if (href) checkInternalLink(relativeFile, href);
  }
  if (/javascript:/i.test(content)) {
    errors.push(`${relativeFile}: javascript links are not allowed`);
  }
}

const navigationFile = path.join(docsRoot, "meta.json");
if (fs.existsSync(navigationFile)) {
  try {
    const navigation = JSON.parse(fs.readFileSync(navigationFile, "utf-8"));
    if (!navigation.title || typeof navigation.title !== "string") {
      errors.push("content/docs/meta.json: title is required");
    }
    if (Array.isArray(navigation.pages)) {
      for (const page of navigation.pages) {
        if (
          typeof page !== "string" ||
          page.startsWith("...") ||
          !contentPathForSlug(page)
        ) {
          errors.push(
            `content/docs/meta.json: page does not exist: ${String(page)}`
          );
        }
      }
    } else {
      errors.push("content/docs/meta.json: pages must be an array");
    }
  } catch (error) {
    errors.push(`content/docs/meta.json: invalid JSON (${error.message})`);
  }
}

if (errors.length > 0) {
  console.error("Documentation validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation validation passed (${contentFiles.length} page${contentFiles.length === 1 ? "" : "s"}).`
  );
}
