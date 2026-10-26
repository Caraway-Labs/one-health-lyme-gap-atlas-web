import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Last-updated dates for documentation pages.
 *
 * Git history is not fully available in every build:
 * - GitHub Actions `actions/checkout@v4` defaults to fetch-depth 1. Quality and
 *   Playwright jobs use that default. The deploy jobs set fetch-depth 1.
 * - `.dockerignore` excludes `.git`, so the DigitalOcean image build has no
 *   repository history when `npm run build` runs.
 *
 * A full clone uses each handwritten page's git author date. A shallow clone
 * is not used for those dates: `git log` on the shallow boundary lists every
 * file as changed in that one commit. Builds with fetch-depth 1, and the
 * DigitalOcean image build (`.dockerignore` drops `.git`), read the snapshot
 * written by `npm run docs:last-modified` on a full clone. Generated API
 * reference pages do not use their own git dates. They use the API repository
 * commit date recorded for the manifest `sourceCommit`.
 */

export const DOCS_LAST_MODIFIED_SNAPSHOT_PATH =
  "src/lib/docs-last-modified.json";

const MANIFEST_PATH = "contracts/public-openapi.manifest.json";
const DOCS_DIRECTORY = "content/docs";
const API_REFERENCE_PREFIX = "content/docs/api-reference/";

export type DocsLastModifiedManifest = {
  sourceCommit: string;
  sourceRepository: string;
};

export type DocsLastModifiedSnapshot = {
  contract: {
    committedAt: string;
    repository: string;
    sha: string;
  };
  pages: Record<string, string>;
};

export type GitHistoryProbe = {
  authorDate: (repoRelativePath: string) => string | undefined;
  /** `null` when this directory is not a git checkout. */
  shallow: boolean | null;
};

type ResolveDocsLastModifiedInput = {
  filePath: string;
  manifest: DocsLastModifiedManifest;
  probe: GitHistoryProbe;
  repositoryRoot: string;
  snapshot: DocsLastModifiedSnapshot;
};

let cachedProbe: GitHistoryProbe | undefined;
let cachedSnapshot: DocsLastModifiedSnapshot | undefined;
let cachedManifest: DocsLastModifiedManifest | undefined;

/** Fumadocs `lastModified` callback. The older `lastModifiedTime` key is not in fumadocs-mdx 15. */
export async function docsLastModifiedTime(filePath: string): Promise<Date> {
  const repositoryRoot = process.cwd();
  cachedProbe ??= createGitHistoryProbe(repositoryRoot);
  cachedSnapshot ??= readDocsLastModifiedSnapshot(repositoryRoot);
  cachedManifest ??= readDocsLastModifiedManifest(repositoryRoot);
  const resolved = resolveDocsLastModified({
    filePath,
    manifest: cachedManifest,
    probe: cachedProbe,
    repositoryRoot,
    snapshot: cachedSnapshot,
  });
  if (!resolved) {
    const relative = repoRelativePath(filePath, repositoryRoot);
    throw new Error(
      `No last-updated date for ${relative}. Run npm run docs:last-modified on a full clone.`
    );
  }
  return resolved;
}

export function resolveDocsLastModified(
  input: ResolveDocsLastModifiedInput
): Date | undefined {
  const relative = repoRelativePath(input.filePath, input.repositoryRoot);
  if (isGeneratedApiReference(relative)) {
    if (!contractPinMatches(input.snapshot, input.manifest)) return undefined;
    return parseTimestamp(input.snapshot.contract.committedAt);
  }

  if (input.probe.shallow === false) {
    return parseTimestamp(input.probe.authorDate(relative));
  }
  return parseTimestamp(input.snapshot.pages[relative]);
}

export function docsLastModifiedProblems(
  repositoryRoot: string,
  probe: GitHistoryProbe = createGitHistoryProbe(repositoryRoot),
  snapshot: DocsLastModifiedSnapshot = readDocsLastModifiedSnapshot(
    repositoryRoot
  ),
  manifest: DocsLastModifiedManifest = readDocsLastModifiedManifest(
    repositoryRoot
  )
): string[] {
  const problems: string[] = [];
  if (snapshot.contract.repository !== manifest.sourceRepository) {
    problems.push(
      `Snapshot contract repository ${snapshot.contract.repository} is not the manifest repository ${manifest.sourceRepository}.`
    );
  }
  if (snapshot.contract.sha !== manifest.sourceCommit) {
    problems.push(
      `Snapshot contract ${snapshot.contract.sha} is not manifest sourceCommit ${manifest.sourceCommit}. Run npm run docs:last-modified.`
    );
  }
  if (!parseTimestamp(snapshot.contract.committedAt)) {
    problems.push(
      "Snapshot contract committedAt is not a valid date. Run npm run docs:last-modified."
    );
  }

  const pages = listDocsPagePaths(repositoryRoot);
  const handwritten = new Set(pages.handwritten);
  for (const file of Object.keys(snapshot.pages)) {
    if (isGeneratedApiReference(file)) {
      problems.push(
        `${file} is generated API reference. Its last-updated date is the contract commit, not a page snapshot.`
      );
      continue;
    }
    if (!handwritten.has(file)) {
      problems.push(
        `${file} is in the last-updated snapshot but not in content/docs.`
      );
    }
    if (!parseTimestamp(snapshot.pages[file])) {
      problems.push(`${file} has an invalid last-updated timestamp.`);
    }
  }

  for (const file of pages.handwritten) {
    const snapshotDate = snapshot.pages[file];
    if (!snapshotDate) {
      problems.push(
        `${file} is missing from the last-updated snapshot. Run npm run docs:last-modified.`
      );
      continue;
    }
    if (probe.shallow !== false) continue;
    const gitDate = probe.authorDate(file);
    if (!gitDate) {
      problems.push(`${file} has no git author date in this full clone.`);
      continue;
    }
    if (gitDate !== snapshotDate) {
      problems.push(
        `${file} git date ${gitDate} differs from snapshot ${snapshotDate}. Run npm run docs:last-modified.`
      );
    }
  }

  return problems;
}

export function createGitHistoryProbe(repositoryRoot: string): GitHistoryProbe {
  const inside = runGit(repositoryRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (inside !== "true") {
    const noAuthorDate: string | undefined = undefined;
    return { authorDate: () => noAuthorDate, shallow: null };
  }

  const shallowText = runGit(repositoryRoot, [
    "rev-parse",
    "--is-shallow-repository",
  ]);
  const dates = new Map<string, string>();
  const log = runGit(repositoryRoot, [
    "-c",
    "core.quotepath=off",
    "log",
    "--format=commit:%aI",
    "--name-only",
    "--",
    DOCS_DIRECTORY,
  ]);
  if (log) {
    let date: string | undefined;
    for (const line of log.split("\n")) {
      if (line.startsWith("commit:")) {
        const value = line.slice("commit:".length);
        date = parseTimestamp(value) ? value : undefined;
        continue;
      }
      if (line.length > 0 && date && !dates.has(line)) dates.set(line, date);
    }
  }

  return {
    authorDate: (repoRelativePath) => dates.get(repoRelativePath),
    shallow: shallowText === "true",
  };
}

export function readDocsLastModifiedManifest(
  repositoryRoot: string
): DocsLastModifiedManifest {
  const parsed: unknown = JSON.parse(
    readFileSync(path.join(repositoryRoot, MANIFEST_PATH), "utf-8")
  );
  if (!isRecord(parsed)) {
    throw new Error(`${MANIFEST_PATH} must be a JSON object.`);
  }
  const sourceCommit = parsed.sourceCommit;
  const sourceRepository = parsed.sourceRepository;
  if (
    typeof sourceCommit !== "string" ||
    typeof sourceRepository !== "string"
  ) {
    throw new TypeError(
      `${MANIFEST_PATH} must include sourceCommit and sourceRepository strings.`
    );
  }
  return { sourceCommit, sourceRepository };
}

export function readDocsLastModifiedSnapshot(
  repositoryRoot: string
): DocsLastModifiedSnapshot {
  const filePath = path.join(repositoryRoot, DOCS_LAST_MODIFIED_SNAPSHOT_PATH);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    throw new Error(
      `Missing ${DOCS_LAST_MODIFIED_SNAPSHOT_PATH}. Run npm run docs:last-modified on a full clone.`,
      { cause: error }
    );
  }
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.contract) ||
    !isRecord(parsed.pages)
  ) {
    throw new Error(`${DOCS_LAST_MODIFIED_SNAPSHOT_PATH} is malformed.`);
  }
  const { committedAt, repository, sha } = parsed.contract;
  if (
    typeof committedAt !== "string" ||
    typeof repository !== "string" ||
    typeof sha !== "string"
  ) {
    throw new TypeError(
      `${DOCS_LAST_MODIFIED_SNAPSHOT_PATH} contract must include committedAt, repository, and sha.`
    );
  }
  const pages: Record<string, string> = {};
  for (const [file, value] of Object.entries(parsed.pages)) {
    if (typeof value !== "string") {
      throw new TypeError(
        `${DOCS_LAST_MODIFIED_SNAPSHOT_PATH} page ${file} must be a timestamp string.`
      );
    }
    pages[file] = value;
  }
  return { contract: { committedAt, repository, sha }, pages };
}

export function listDocsPagePaths(repositoryRoot: string): {
  generated: string[];
  handwritten: string[];
} {
  const generated: string[] = [];
  const handwritten: string[] = [];
  const root = path.join(repositoryRoot, DOCS_DIRECTORY);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const fullPath = path.join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.endsWith(".mdx")) continue;
      const relative = repoRelativePath(fullPath, repositoryRoot);
      if (isGeneratedApiReference(relative)) generated.push(relative);
      else handwritten.push(relative);
    }
  };
  visit(root);
  generated.sort((left, right) => left.localeCompare(right));
  handwritten.sort((left, right) => left.localeCompare(right));
  return { generated, handwritten };
}

export async function collectDocsLastModifiedSnapshot(
  repositoryRoot: string,
  commitDate: (
    repository: string,
    sha: string
  ) => Promise<string> = fetchContractCommittedAt
): Promise<DocsLastModifiedSnapshot> {
  const probe = createGitHistoryProbe(repositoryRoot);
  if (probe.shallow !== false) {
    throw new Error(
      probe.shallow === null
        ? "npm run docs:last-modified needs a git checkout."
        : "npm run docs:last-modified needs a full git clone. A shallow clone cannot date every page."
    );
  }
  const manifest = readDocsLastModifiedManifest(repositoryRoot);
  const committedAt = await commitDate(
    manifest.sourceRepository,
    manifest.sourceCommit
  );
  if (!parseTimestamp(committedAt)) {
    throw new Error(
      `Contract commit date for ${manifest.sourceRepository}@${manifest.sourceCommit} is not a valid timestamp.`
    );
  }
  const pages: Record<string, string> = {};
  for (const file of listDocsPagePaths(repositoryRoot).handwritten) {
    const date = probe.authorDate(file);
    if (!date) {
      throw new Error(`Git has no last-updated date for ${file}.`);
    }
    pages[file] = date;
  }
  return {
    contract: {
      committedAt,
      repository: manifest.sourceRepository,
      sha: manifest.sourceCommit,
    },
    pages,
  };
}

export function serializeDocsLastModifiedSnapshot(
  snapshot: DocsLastModifiedSnapshot
): string {
  const pages = Object.fromEntries(
    Object.entries(snapshot.pages).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
  return `${JSON.stringify({ contract: snapshot.contract, pages }, null, 2)}\n`;
}

export function contractCommittedAtFromGitHubBody(
  body: unknown,
  repository: string,
  sha: string
): string {
  if (!isRecord(body) || body.sha !== sha || !isRecord(body.commit)) {
    throw new Error(
      `GitHub commit payload for ${repository}@${sha} did not include that commit.`
    );
  }
  const committer = body.commit.committer;
  if (!isRecord(committer) || typeof committer.date !== "string") {
    throw new Error(
      `GitHub commit payload for ${repository}@${sha} has no committer date.`
    );
  }
  if (!parseTimestamp(committer.date)) {
    throw new Error(
      `GitHub committer date for ${repository}@${sha} is not a timestamp.`
    );
  }
  return committer.date;
}

export async function fetchContractCommittedAt(
  repository: string,
  sha: string
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/commits/${sha}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "one-health-atlas-docs",
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `GitHub commit lookup for ${repository}@${sha} returned HTTP ${response.status}.`
    );
  }
  return contractCommittedAtFromGitHubBody(
    await response.json(),
    repository,
    sha
  );
}

export function isGeneratedApiReference(repoRelativePath: string): boolean {
  return repoRelativePath.startsWith(API_REFERENCE_PREFIX);
}

function contractPinMatches(
  snapshot: DocsLastModifiedSnapshot,
  manifest: DocsLastModifiedManifest
): boolean {
  return (
    snapshot.contract.repository === manifest.sourceRepository &&
    snapshot.contract.sha === manifest.sourceCommit
  );
}

function parseTimestamp(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function repoRelativePath(filePath: string, repositoryRoot: string): string {
  const absolute = path.resolve(repositoryRoot, filePath);
  const relative = path.relative(repositoryRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${filePath} is outside the repository.`);
  }
  return relative.split(path.sep).join("/");
}

function runGit(repositoryRoot: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd: repositoryRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
