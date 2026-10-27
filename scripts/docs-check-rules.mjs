/**
 * Copy and structure rules for `npm run docs:check`.
 *
 * Exception marker (HTML comment, in the page source):
 *
 *   <!-- docs-check-exception: RULE_ID -->
 *
 * `RULE_ID` is one of: dated-test-log, word-budget, missing-description,
 * warning-callout, tab-group-id, banned-term.
 * An optional reason may follow the id: `<!-- docs-check-exception: banned-term: contract filename -->`.
 * A marker on a line, or on the line immediately above, skips that line for
 * that rule. A marker anywhere in the file skips the file-level rules
 * `word-budget` and `missing-description`.
 *
 * Developer pages are `content/docs/develop/**` and
 * `content/docs/api-mcp-and-access.mdx`. Story #941 sets their prose budget
 * at 1,200 words. Generated `content/docs/api-reference/**` is not a
 * hand-authored developer page: the pinned contract owns those words.
 */

import { BANNED_TERMS } from "./docs-banned-terms.mjs";

/** Story #941: no hand-authored developer page exceeds 1,200 prose words. */
export const DEVELOPER_PAGE_WORD_BUDGET = 1200;

export const DOCS_CHECK_EXCEPTION_MARKER = "docs-check-exception";

const MONTH =
  "January|February|March|April|May|June|July|August|September|October|November|December";

const CALENDAR_DATE = `(?:\\d{1,2}\\s+(?:${MONTH})\\s+\\d{4}|(?:${MONTH})\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`;

const DATED_ON_SENTENCE = new RegExp(
  `\\bOn\\s+\\d{1,2}\\s+(?:${MONTH})\\s+\\d{4}\\b`,
  "g"
);

const RETRIEVED_ON_DATE = new RegExp(
  `\\bretrieved\\b[^\\n]{0,80}?\\bon\\s+${CALENDAR_DATE}\\b`,
  "gi"
);

const FILE_LEVEL_RULES = new Set(["word-budget", "missing-description"]);

const EXCEPTION_COMMENT = new RegExp(
  `<!--\\s*${DOCS_CHECK_EXCEPTION_MARKER}:\\s*([a-z0-9-]+)(?:\\s*:[^>]*)?\\s*-->`,
  "g"
);

const CALLOUT_TAG = /<Callout\b(?<attributes>[^>]*)>/g;
const CALLOUT_TYPE = /type\s*=\s*["'](?<value>[^"']+)["']/;
const TABS_TAG = /<Tabs\b(?<attributes>[^>]*)>/g;
const GROUP_ID = /\bgroupId\s*=\s*(?:\{[^}\n]+\}|"[^"\n]+"|'[^'\n]+')/;

export function isDeveloperDocsPage(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized === "content/docs/api-mcp-and-access.mdx" ||
    normalized.endsWith("/content/docs/api-mcp-and-access.mdx") ||
    normalized.startsWith("content/docs/develop/") ||
    normalized.includes("/content/docs/develop/")
  );
}

function isGeneratedApiReference(file) {
  const normalized = file.replaceAll("\\", "/");
  return (
    normalized.startsWith("content/docs/api-reference/") ||
    normalized.includes("/content/docs/api-reference/")
  );
}

function escapeRegExp(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMPILED_BANNED_TERMS = BANNED_TERMS.filter(
  (term) => term.mechanical && term.pattern
)
  .map((term) => ({
    ...term,
    regex: new RegExp(
      term.patternKind === "phrase"
        ? escapeRegExp(term.pattern ?? "")
        : (term.pattern ?? ""),
      "gi"
    ),
  }))
  .sort(
    (left, right) => (right.pattern?.length ?? 0) - (left.pattern?.length ?? 0)
  );

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function formatDocsCheckFinding(finding) {
  return `${finding.file}:${finding.line}: ${finding.rule}: ${finding.fix}`;
}

function exceptionIndex(content) {
  const lines = new Map();
  const file = new Set();
  for (const match of content.matchAll(EXCEPTION_COMMENT)) {
    const rule = match[1];
    if (!rule || match.index === undefined) continue;
    const line = lineNumberAt(content, match.index);
    const rules = lines.get(line) ?? new Set();
    rules.add(rule);
    lines.set(line, rules);
    if (FILE_LEVEL_RULES.has(rule)) file.add(rule);
  }
  return { file, lines };
}

function lineSkipped(line, rule, exceptions) {
  if (exceptions.file.has(rule)) return true;
  if (exceptions.lines.get(line)?.has(rule)) return true;
  return exceptions.lines.get(line - 1)?.has(rule) ?? false;
}

function maskCode(content) {
  return content
    .replaceAll(/```[\s\S]*?```/g, (block) => block.replaceAll(/[^\n]/g, " "))
    .replaceAll(/`[^`\n]*`/g, (span) => " ".repeat(span.length));
}

export function proseWordCount(content) {
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, " ");
  const prose = withoutFrontmatter
    .replaceAll(/```[\s\S]*?```/g, " ")
    .replaceAll(/`[^`\n]*`/g, " ")
    .replaceAll(/<[^>\n]+>/g, " ")
    .replaceAll(/\[[^\]]*]\([^)]*\)/g, (link) => {
      const label = link.match(/^\[(?<label>[^\]]*)]/);
      return label?.groups?.label ?? " ";
    });
  return prose.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
}

function lineAfterFrontmatter(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!match) return 1;
  return match[0].split(/\r?\n/).length;
}

export function checkDatedTestLog(file, content) {
  if (!isDeveloperDocsPage(file)) return [];
  const exceptions = exceptionIndex(content);
  const findings = [];
  const patterns = [DATED_ON_SENTENCE, RETRIEVED_ON_DATE];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (match.index === undefined) continue;
      const line = lineNumberAt(content, match.index);
      if (lineSkipped(line, "dated-test-log", exceptions)) continue;
      findings.push({
        file,
        fix: "Remove the test date. Keep a sample labelled with its release id, or delete the sentence. Do not record when the URL was checked.",
        line,
        rule: "dated-test-log",
      });
    }
  }
  return dedupeFindings(findings);
}

export function checkWordBudget(file, content) {
  if (!isDeveloperDocsPage(file)) return [];
  const exceptions = exceptionIndex(content);
  const words = proseWordCount(content);
  if (words <= DEVELOPER_PAGE_WORD_BUDGET) return [];
  if (exceptions.file.has("word-budget")) return [];
  return [
    {
      file,
      fix: `Shorten this developer page to ${DEVELOPER_PAGE_WORD_BUDGET} prose words or fewer (code is not counted). It is ${words} words. Move reference detail to a linked page.`,
      line: lineAfterFrontmatter(content),
      rule: "word-budget",
    },
  ];
}

export function checkMissingDescription(file, content) {
  const exceptions = exceptionIndex(content);
  if (exceptions.file.has("missing-description")) return [];
  const frontmatter = content.match(/^---\r?\n(?<body>[\s\S]*?)\r?\n---/);
  if (!frontmatter || frontmatter.index === undefined) {
    return [
      {
        file,
        fix: "Add frontmatter with a description: one sentence that says what the page is for.",
        line: 1,
        rule: "missing-description",
      },
    ];
  }
  const body = frontmatter.groups?.body ?? "";
  if (/^description:\s*\S.+$/m.test(body)) return [];
  const descriptionAt = body.search(/^description:.*$/m);
  const opening = content.slice(frontmatter.index).match(/^---\r?\n/);
  const prefix = opening?.[0].length ?? 0;
  const line =
    descriptionAt === -1
      ? lineNumberAt(content, frontmatter.index)
      : lineNumberAt(content, frontmatter.index + prefix + descriptionAt);
  return [
    {
      file,
      fix: "Add a frontmatter description: one sentence that says what the page is for.",
      line,
      rule: "missing-description",
    },
  ];
}

function isWarningCallout(attributes) {
  const value = CALLOUT_TYPE.exec(attributes)?.groups?.value ?? "info";
  return value === "warn" || value === "warning";
}

export function checkWarningCallouts(file, content) {
  const exceptions = exceptionIndex(content);
  const lines = [];
  for (const match of content.matchAll(CALLOUT_TAG)) {
    if (match.index === undefined) continue;
    if (!isWarningCallout(match.groups?.attributes ?? "")) continue;
    const line = lineNumberAt(content, match.index);
    if (lineSkipped(line, "warning-callout", exceptions)) continue;
    lines.push(line);
  }
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => ({
    file,
    fix: "Keep one warning Callout on the page. Change the extra Callout to type info, or merge it into the existing warning.",
    line,
    rule: "warning-callout",
  }));
}

export function checkTabGroupIds(file, content) {
  const exceptions = exceptionIndex(content);
  const findings = [];
  for (const match of content.matchAll(TABS_TAG)) {
    if (match.index === undefined) continue;
    const attributes = match.groups?.attributes ?? "";
    if (GROUP_ID.test(attributes)) continue;
    const line = lineNumberAt(content, match.index);
    if (lineSkipped(line, "tab-group-id", exceptions)) continue;
    findings.push({
      file,
      fix: 'Add a stable groupId, for example groupId="atlas-county-report-template", so the selected tab persists.',
      line,
      rule: "tab-group-id",
    });
  }
  return findings;
}

export function checkBannedTerms(file, content) {
  if (isGeneratedApiReference(file)) return [];
  const exceptions = exceptionIndex(content);
  const masked = maskCode(content);
  const findings = [];
  const claimed = [];
  for (const term of COMPILED_BANNED_TERMS) {
    const source = term.allowInCode ? masked : content;
    term.regex.lastIndex = 0;
    for (const match of source.matchAll(term.regex)) {
      if (match.index === undefined) continue;
      const start = match.index;
      const end = start + match[0].length;
      if (claimed.some((span) => start < span.end && end > span.start)) {
        continue;
      }
      const line = lineNumberAt(content, start);
      if (lineSkipped(line, "banned-term", exceptions)) continue;
      claimed.push({ end, start });
      findings.push({
        file,
        fix: `Replace "${term.avoid}" with: ${term.instead}.`,
        line,
        rule: "banned-term",
      });
    }
  }
  return findings;
}

export function checkDocsCopyStructure(file, content) {
  return [
    ...checkDatedTestLog(file, content),
    ...checkWordBudget(file, content),
    ...checkMissingDescription(file, content),
    ...checkWarningCallouts(file, content),
    ...checkTabGroupIds(file, content),
    ...checkBannedTerms(file, content),
  ];
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.rule}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
