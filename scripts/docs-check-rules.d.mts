export type DocsCheckFinding = {
  file: string;
  fix: string;
  line: number;
  rule: string;
};

export const DEVELOPER_PAGE_WORD_BUDGET: number;

export const DOCS_CHECK_EXCEPTION_MARKER: string;

export function isDeveloperDocsPage(file: string): boolean;

export function formatDocsCheckFinding(finding: DocsCheckFinding): string;

export function proseWordCount(content: string): number;

export function checkDatedTestLog(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkWordBudget(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkMissingDescription(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkWarningCallouts(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkTabGroupIds(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkBannedTerms(
  file: string,
  content: string
): DocsCheckFinding[];

export function checkDocsCopyStructure(
  file: string,
  content: string
): DocsCheckFinding[];
