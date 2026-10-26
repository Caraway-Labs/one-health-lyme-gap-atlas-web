import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Pinned copy of the API repository changelog.
 *
 * `contracts/api-changelog.md` is the CHANGELOG.md blob from the same API
 * commit as `contracts/public-openapi.manifest.json`. The docs page and the
 * Atom feed both render this pin. They do not copy response schemas.
 */

export const API_CHANGELOG_RELATIVE_PATH = "contracts/api-changelog.md";
export const API_CHANGELOG_MANIFEST_RELATIVE_PATH =
  "contracts/api-changelog.manifest.json";
export const API_CHANGELOG_PAGE_RELATIVE_PATH =
  "content/docs/develop/changelog.mdx";
export const API_CHANGELOG_PAGE_HREF = "/docs/develop/changelog";
export const API_CHANGELOG_FEED_HREF = "/docs/changelog.xml";

const CONTRACT_MANIFEST_RELATIVE_PATH =
  "contracts/public-openapi.manifest.json";
const PUBLIC_OPENAPI_RELATIVE_PATH = "contracts/public-openapi.json";
const CHANGELOG_SOURCE_PATH = "CHANGELOG.md";
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const IDENTIFIER_CHAR = /[A-Za-z0-9_]/u;
const EVERY_OPERATION = /\b(?:every|each|all)\s+operations?\b/iu;
const FENCED_BLOCK = /^```[^\n]*\n[\s\S]*?^```[ \t]*$/gmu;
const RELEASE_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const HTTP_METHODS = [
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
] as const;

const LABEL_BY_SOURCE: Record<string, string> = {
  added: "Added",
  additive: "Added",
  breaking: "Breaking",
  changed: "Changed",
  deprecated: "Deprecated",
  deprecation: "Deprecated",
  fixed: "Fixed",
};

const AREA_LINKS: Record<string, RelatedLink> = {
  examples: { href: "/docs/api-reference", label: "API reference" },
  "error guidance": {
    href: "/docs/develop/errors",
    label: "Errors and retries",
  },
  "landing page": { href: "/docs/api-reference", label: "API reference" },
  "operation descriptions": {
    href: "/docs/api-reference",
    label: "API reference",
  },
  parameters: { href: "/docs/api-reference", label: "API reference" },
  "response headers": { href: "/docs/api-reference", label: "API reference" },
  schemas: { href: "/docs/api-reference/schemas", label: "Schemas" },
  "tags and tag groups": {
    href: "/docs/api-reference",
    label: "API reference",
  },
};

export type ContractOperation = {
  href: string;
  method: string;
  operationId: string;
  path: string;
};

export type RelatedLink = {
  href: string;
  label: string;
};

export type ChangelogEntry = {
  area: string;
  body: string;
  label: string;
  operations: ContractOperation[];
  related: RelatedLink[];
};

export type ChangelogRelease = {
  date: string | null;
  entries: ChangelogEntry[];
  heading: string;
  id: string;
  summary: string[];
};

export type ApiChangelog = {
  releases: ChangelogRelease[];
  sourceCommit: string;
  sourcePath: string;
  sourceRepository: string;
};

type ChangelogPin = {
  sha256: string;
  sourceCommit: string;
  sourcePath: string;
  sourceRepository: string;
};

type ContractPin = {
  sourceCommit: string;
  sourceRepository: string;
};

type ReleaseDraft = {
  entries: ChangelogEntry[];
  heading: string;
  summaryLines: string[];
};

/** Problems that make `docs:check` fail for a missing or drifted changelog pin. */
export function changelogPinProblems(repositoryRoot: string): string[] {
  const problems: string[] = [];
  const contract = readContractPin(repositoryRoot, problems);
  const changelogPath = path.join(repositoryRoot, API_CHANGELOG_RELATIVE_PATH);
  if (!existsSync(changelogPath)) {
    problems.push(`${API_CHANGELOG_RELATIVE_PATH} is missing.`);
  }
  const pin = readChangelogPin(repositoryRoot, problems);
  if (contract && pin && contract.sourceCommit !== pin.sourceCommit) {
    problems.push(
      `${API_CHANGELOG_MANIFEST_RELATIVE_PATH} sourceCommit ${pin.sourceCommit} does not match ${CONTRACT_MANIFEST_RELATIVE_PATH} sourceCommit ${contract.sourceCommit}.`
    );
  }
  if (contract && pin && contract.sourceRepository !== pin.sourceRepository) {
    problems.push(
      `${API_CHANGELOG_MANIFEST_RELATIVE_PATH} sourceRepository ${pin.sourceRepository} does not match ${CONTRACT_MANIFEST_RELATIVE_PATH} sourceRepository ${contract.sourceRepository}.`
    );
  }
  if (pin && existsSync(changelogPath)) {
    const actual = fileSha256(changelogPath);
    if (actual !== pin.sha256) {
      problems.push(
        `${API_CHANGELOG_RELATIVE_PATH} sha256 ${actual} does not match ${API_CHANGELOG_MANIFEST_RELATIVE_PATH} sha256 ${pin.sha256}.`
      );
    }
  }
  return problems;
}

/** Pin problems, plus a docs page that no longer matches the pin. */
export function changelogPageProblems(repositoryRoot: string): string[] {
  const problems = changelogPinProblems(repositoryRoot);
  if (problems.length > 0) return problems;
  try {
    const expected = renderApiChangelogPage(readApiChangelog(repositoryRoot));
    const pagePath = path.join(
      repositoryRoot,
      API_CHANGELOG_PAGE_RELATIVE_PATH
    );
    if (!existsSync(pagePath)) {
      return [`${API_CHANGELOG_PAGE_RELATIVE_PATH} is missing.`];
    }
    if (readFileSync(pagePath, "utf-8") !== expected) {
      return [
        `${API_CHANGELOG_PAGE_RELATIVE_PATH} does not match the pinned API changelog.`,
      ];
    }
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [message];
  }
}

export function loadApiChangelog(
  repositoryRoot: string = process.cwd()
): ApiChangelog {
  const problems = changelogPinProblems(repositoryRoot);
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  return readApiChangelog(repositoryRoot);
}

export function parseApiChangelog(
  markdown: string,
  operations: readonly ContractOperation[]
): ChangelogRelease[] {
  const lines = markdown.replaceAll(FENCED_BLOCK, "").split(/\r?\n/u);
  const releases: ReleaseDraft[] = [];
  let current: ReleaseDraft | undefined;
  let label = "";
  let entryArea = "";
  let entryLines: string[] | undefined;

  const finishEntry = (): void => {
    if (!current || entryLines === undefined) return;
    const body = entryLines.join(" ").replaceAll(/\s+/gu, " ").trim();
    current.entries.push(buildEntry(entryArea, body, label, operations));
    entryLines = undefined;
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      finishEntry();
      const heading = line.slice(3).trim();
      label = "";
      if (heading.toLowerCase() === "entry template") {
        current = undefined;
        continue;
      }
      current = { entries: [], heading, summaryLines: [] };
      releases.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("### ")) {
      finishEntry();
      label = changelogLabel(line.slice(4).trim());
      continue;
    }
    const bullet = /^- \*\*(?<area>.+?)\*\*:?\s*(?<body>.*)$/u.exec(line);
    if (bullet?.groups) {
      finishEntry();
      entryArea = bullet.groups.area.trim().replace(/:$/u, "");
      entryLines = [bullet.groups.body ?? ""];
      continue;
    }
    if (entryLines !== undefined) {
      if (line.trim().length > 0) entryLines.push(line.trim());
      continue;
    }
    current.summaryLines.push(line);
  }
  finishEntry();
  return releases.map((release) => toRelease(release));
}

export function listContractOperations(
  repositoryRoot: string
): ContractOperation[] {
  const specPath = path.join(repositoryRoot, PUBLIC_OPENAPI_RELATIVE_PATH);
  const parsed: unknown = JSON.parse(readFileSync(specPath, "utf-8"));
  if (!isRecord(parsed) || !isRecord(parsed.paths)) {
    throw new Error(`${PUBLIC_OPENAPI_RELATIVE_PATH} has no paths object.`);
  }
  const operations: ContractOperation[] = [];
  for (const [route, pathItem] of Object.entries(parsed.paths)) {
    if (!isRecord(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isRecord(operation)) continue;
      const operationId = operation.operationId;
      if (typeof operationId !== "string" || operationId.length === 0) continue;
      const tags = operation.tags;
      const tag = Array.isArray(tags) ? tags[0] : undefined;
      if (typeof tag !== "string" || !/^[a-z0-9-]+$/u.test(tag)) {
        throw new Error(`Operation ${operationId} has no docs folder tag.`);
      }
      operations.push({
        href: `/docs/api-reference/${tag}/${operationId}`,
        method: method.toUpperCase(),
        operationId,
        path: route,
      });
    }
  }
  operations.sort((left, right) =>
    left.path === right.path
      ? left.method.localeCompare(right.method)
      : left.path.localeCompare(right.path)
  );
  return operations;
}

export function renderApiChangelogPage(changelog: ApiChangelog): string {
  const lines = [
    "---",
    "title: What's new",
    "description: Changes to the public API, newest release first, matching the pinned contract.",
    "---",
    "",
    "Read what changed in the public API. The newest release is first. Each entry has a label: Added, Changed, Deprecated, Fixed, or Breaking. Added is an additive change. Deprecated is a deprecation. Breaking is a breaking change.",
    "",
    `Subscribe with the [changelog feed](${API_CHANGELOG_FEED_HREF}).`,
    "",
    `These notes match contract commit \`${changelog.sourceCommit}\` from \`${changelog.sourceRepository}\` file \`${changelog.sourcePath}\`.`,
    "",
  ];
  for (const release of changelog.releases) {
    lines.push(`## ${release.heading}`, "");
    for (const paragraph of release.summary) {
      lines.push(inlineMarkdown(paragraph), "");
    }
    if (release.entries.length === 0 && release.summary.length === 0) {
      lines.push("No changes yet.", "");
    }
    for (const entry of release.entries) {
      lines.push(...renderEntry(entry), "");
    }
  }
  return `${lines.join("\n").replace(/\n+$/u, "\n")}`;
}

export function renderAtomFeed(
  changelog: ApiChangelog,
  siteOrigin: string
): string {
  const dated = changelog.releases.filter(
    (release): release is ChangelogRelease & { date: string } =>
      release.date !== null && release.entries.length > 0
  );
  if (dated.length === 0) {
    throw new Error("API changelog feed needs at least one dated release.");
  }
  const newest = dated
    .map((release) => release.date)
    .sort()
    .at(-1);
  if (!newest) {
    throw new Error("API changelog feed needs at least one dated release.");
  }
  const feedUrl = absoluteUrl(siteOrigin, API_CHANGELOG_FEED_HREF);
  const pageUrl = absoluteUrl(siteOrigin, API_CHANGELOG_PAGE_HREF);
  const updated = `${newest}T00:00:00Z`;
  const entries = dated
    .map((release) => renderAtomEntry(release, siteOrigin, pageUrl))
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>One Health Atlas API changelog</title>
  <subtitle>Matches contract commit ${escapeXml(changelog.sourceCommit)} from ${escapeXml(changelog.sourceRepository)}.</subtitle>
  <id>${escapeXml(feedUrl)}</id>
  <updated>${updated}</updated>
  <link rel="self" type="application/atom+xml" href="${escapeXml(feedUrl)}"/>
  <link rel="alternate" type="text/html" href="${escapeXml(pageUrl)}"/>
  <author><name>One Health Atlas</name></author>
${entries}
</feed>
`;
}

function readApiChangelog(repositoryRoot: string): ApiChangelog {
  const problems: string[] = [];
  const pin = readChangelogPin(repositoryRoot, problems);
  if (!pin || problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  const markdown = readFileSync(
    path.join(repositoryRoot, API_CHANGELOG_RELATIVE_PATH),
    "utf-8"
  );
  return {
    releases: parseApiChangelog(
      markdown,
      listContractOperations(repositoryRoot)
    ),
    sourceCommit: pin.sourceCommit,
    sourcePath: pin.sourcePath,
    sourceRepository: pin.sourceRepository,
  };
}

function renderEntry(entry: ChangelogEntry): string[] {
  const related = entry.related
    .map((link) => `Read [${link.label}](${link.href}).`)
    .join(" ");
  const suffix = related.length > 0 ? ` ${related}` : "";
  const lead = `- **${entry.label}** — **${inlineMarkdown(entry.area)}**: ${inlineMarkdown(entry.body)}${suffix}`;
  if (entry.operations.length === 0) return [lead];
  const links = entry.operations.map(
    (operation) =>
      `  - [\`${operation.method} ${operation.path}\`](${operation.href})`
  );
  return [`${lead} Affected operations:`, ...links];
}

function renderAtomEntry(
  release: ChangelogRelease & { date: string },
  siteOrigin: string,
  pageUrl: string
): string {
  const href = `${pageUrl}#${release.id}`;
  const updated = `${release.date}T00:00:00Z`;
  return `  <entry>
    <title>${escapeXml(release.heading)}</title>
    <id>${escapeXml(href)}</id>
    <updated>${updated}</updated>
    <link rel="alternate" type="text/html" href="${escapeXml(href)}"/>
    <content type="html">${escapeXml(entryHtml(release, siteOrigin))}</content>
  </entry>`;
}

function entryHtml(release: ChangelogRelease, siteOrigin: string): string {
  const parts: string[] = [];
  for (const paragraph of release.summary) {
    parts.push(`<p>${inlineHtml(paragraph)}</p>`);
  }
  for (const entry of release.entries) {
    const related = entry.related
      .map((link) => linkHtml(absoluteUrl(siteOrigin, link.href), link.label))
      .join(" ");
    const suffix = related.length > 0 ? ` Read ${related}.` : "";
    parts.push(
      `<p><strong>${escapeXml(entry.label)}</strong> — <strong>${escapeXml(entry.area)}</strong>: ${inlineHtml(entry.body)}${suffix}</p>`
    );
    if (entry.operations.length === 0) continue;
    const items = entry.operations
      .map(
        (operation) =>
          `<li>${linkHtml(absoluteUrl(siteOrigin, operation.href), `${operation.method} ${operation.path}`)}</li>`
      )
      .join("");
    parts.push(`<p>Affected operations:</p><ul>${items}</ul>`);
  }
  return parts.join("");
}

function buildEntry(
  area: string,
  body: string,
  label: string,
  operations: readonly ContractOperation[]
): ChangelogEntry {
  const resolvedLabel = label.length > 0 ? label : "Changed";
  const matched = affectedOperations(`${area}\n${body}`, operations);
  return {
    area,
    body,
    label: resolvedLabel,
    operations: matched,
    related: relatedFor(area, matched.length),
  };
}

function affectedOperations(
  text: string,
  operations: readonly ContractOperation[]
): ContractOperation[] {
  if (EVERY_OPERATION.test(text)) return [...operations];
  return operations.filter((operation) => mentionsOperation(text, operation));
}

function mentionsOperation(
  text: string,
  operation: ContractOperation
): boolean {
  if (text.includes(operation.path)) return true;
  return hasWord(text, operation.operationId);
}

function hasWord(text: string, word: string): boolean {
  let from = 0;
  while (from <= text.length) {
    const found = text.indexOf(word, from);
    if (found === -1) return false;
    const before = found === 0 ? "" : text.charAt(found - 1);
    const after = text.charAt(found + word.length);
    if (!isIdentifierChar(before) && !isIdentifierChar(after)) return true;
    from = found + word.length;
  }
  return false;
}

function isIdentifierChar(character: string): boolean {
  return IDENTIFIER_CHAR.test(character);
}

function relatedFor(area: string, operationCount: number): RelatedLink[] {
  const link = AREA_LINKS[area.trim().toLowerCase()];
  if (!link) return [];
  if (operationCount > 0 && link.href === "/docs/api-reference") return [];
  return [link];
}

function toRelease(release: ReleaseDraft): ChangelogRelease {
  const date = RELEASE_DATE.test(release.heading) ? release.heading : null;
  const id =
    date ??
    (release.heading.toLowerCase() === "unreleased"
      ? "unreleased"
      : release.heading
          .trim()
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/gu, "-")
          .replaceAll(/^-|-$/gu, ""));
  return {
    date,
    entries: release.entries,
    heading: release.heading,
    id,
    summary: paragraphs(release.summaryLines),
  };
}

function paragraphs(lines: string[]): string[] {
  const result: string[] = [];
  let current: string[] = [];
  const flush = (): void => {
    if (current.length === 0) return;
    result.push(current.join(" "));
    current = [];
  };
  for (const line of lines) {
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    current.push(line.trim());
  }
  flush();
  return result;
}

function changelogLabel(source: string): string {
  const key = source.trim().toLowerCase();
  return LABEL_BY_SOURCE[key] ?? source.trim();
}

function inlineMarkdown(text: string): string {
  return inlineSegments(text, escapeMdxText, (code) => `\`${code}\``);
}

function inlineHtml(text: string): string {
  return inlineSegments(
    text,
    escapeXml,
    (code) => `<code>${escapeXml(code)}</code>`
  );
}

function inlineSegments(
  text: string,
  escapeText: (value: string) => string,
  renderCode: (code: string) => string
): string {
  const pattern = /`(?<code>[^`]+)`/gu;
  let cursor = 0;
  let rendered = "";
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    rendered += escapeText(text.slice(cursor, index));
    rendered += renderCode(match.groups?.code ?? "");
    cursor = index + match[0].length;
  }
  rendered += escapeText(text.slice(cursor));
  return rendered;
}

function linkHtml(href: string, label: string): string {
  return `<a href="${escapeXml(href)}">${escapeXml(label)}</a>`;
}

function absoluteUrl(siteOrigin: string, href: string): string {
  const origin = siteOrigin.endsWith("/") ? siteOrigin : `${siteOrigin}/`;
  return new URL(href.replace(/^\//u, ""), origin).href;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeMdxText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("<", "\\<");
}

function fileSha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readContractPin(
  repositoryRoot: string,
  problems: string[]
): ContractPin | undefined {
  return readJsonPin(
    repositoryRoot,
    CONTRACT_MANIFEST_RELATIVE_PATH,
    problems,
    (record) => {
      const sourceCommit = requiredCommit(record, "sourceCommit", problems);
      const sourceRepository = requiredText(
        record,
        "sourceRepository",
        problems
      );
      if (!sourceCommit || !sourceRepository) return;
      return { sourceCommit, sourceRepository };
    }
  );
}

function readChangelogPin(
  repositoryRoot: string,
  problems: string[]
): ChangelogPin | undefined {
  return readJsonPin(
    repositoryRoot,
    API_CHANGELOG_MANIFEST_RELATIVE_PATH,
    problems,
    (record) => {
      const sourceCommit = requiredCommit(record, "sourceCommit", problems);
      const sourceRepository = requiredText(
        record,
        "sourceRepository",
        problems
      );
      const sourcePath = requiredText(record, "sourcePath", problems);
      const sha256 = requiredSha256(record, problems);
      if (!sourceCommit || !sourceRepository || !sourcePath || !sha256) {
        return;
      }
      if (sourcePath !== CHANGELOG_SOURCE_PATH) {
        problems.push(
          `${API_CHANGELOG_MANIFEST_RELATIVE_PATH} sourcePath must be ${CHANGELOG_SOURCE_PATH}.`
        );
      }
      return { sha256, sourceCommit, sourcePath, sourceRepository };
    }
  );
}

function readJsonPin<T>(
  repositoryRoot: string,
  relativePath: string,
  problems: string[],
  parse: (record: Record<string, unknown>) => T | undefined
): T | undefined {
  const filePath = path.join(repositoryRoot, relativePath);
  if (!existsSync(filePath)) {
    problems.push(`${relativePath} is missing.`);
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    problems.push(`${relativePath} is not valid JSON (${message}).`);
    return undefined;
  }
  if (!isRecord(parsed)) {
    problems.push(`${relativePath} must be a JSON object.`);
    return undefined;
  }
  return parse(parsed);
}

function requiredCommit(
  record: Record<string, unknown>,
  key: string,
  problems: string[]
): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || !COMMIT_PATTERN.test(value)) {
    problems.push(`${key} must be a 40-character commit.`);
    return undefined;
  }
  return value;
}

function requiredSha256(
  record: Record<string, unknown>,
  problems: string[]
): string | undefined {
  const value = record.sha256;
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    problems.push("sha256 must be a 64-character hex digest.");
    return undefined;
  }
  return value;
}

function requiredText(
  record: Record<string, unknown>,
  key: string,
  problems: string[]
): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    problems.push(`${key} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
