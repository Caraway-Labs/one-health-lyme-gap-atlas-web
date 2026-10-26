import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectDocsLastModifiedSnapshot,
  contractCommittedAtFromGitHubBody,
  createGitHistoryProbe,
  docsLastModifiedProblems,
  docsLastModifiedTime,
  readDocsLastModifiedSnapshot,
  resolveDocsLastModified,
  type DocsLastModifiedSnapshot,
} from "../src/lib/docs-last-modified";

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_EMAIL: "atlas@example.com",
  GIT_AUTHOR_NAME: "Atlas Test",
  GIT_COMMITTER_EMAIL: "atlas@example.com",
  GIT_COMMITTER_NAME: "Atlas Test",
};

const directories: string[] = [];

describe("docs last-updated dates", () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reads the contract committer date only when the payload is that commit", () => {
    expect(
      contractCommittedAtFromGitHubBody(
        {
          commit: { committer: { date: "2026-10-26T11:00:54Z" } },
          sha: "abc123",
        },
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    ).toBe("2026-10-26T11:00:54Z");
    expect(() =>
      contractCommittedAtFromGitHubBody(
        {
          commit: { committer: { date: "2026-10-26T11:00:54Z" } },
          sha: "other",
        },
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    ).toThrow(/did not include that commit/);
  });

  it("uses the contract commit date for generated reference pages", () => {
    const snapshot = snapshotWith({
      "content/docs/glossary.mdx": "2026-01-01T00:00:00Z",
    });
    const resolved = resolveDocsLastModified({
      filePath: "/repo/content/docs/api-reference/index.mdx",
      manifest: manifestPin(),
      probe: {
        authorDate: () => "2026-02-02T00:00:00Z",
        shallow: false,
      },
      repositoryRoot: "/repo",
      snapshot,
    });
    expect(resolved?.toISOString()).toBe("2026-10-26T11:00:54.000Z");
  });

  it("falls back to the snapshot when git history is shallow or missing", () => {
    const snapshot = snapshotWith({
      "content/docs/glossary.mdx": "2026-01-01T00:00:00Z",
    });
    const manifest = manifestPin();
    const shallow = resolveDocsLastModified({
      filePath: "/repo/content/docs/glossary.mdx",
      manifest,
      probe: { authorDate: () => missingAuthorDate, shallow: true },
      repositoryRoot: "/repo",
      snapshot,
    });
    const missing = resolveDocsLastModified({
      filePath: "/repo/content/docs/glossary.mdx",
      manifest,
      probe: { authorDate: () => missingAuthorDate, shallow: null },
      repositoryRoot: "/repo",
      snapshot,
    });
    const boundaryDate = resolveDocsLastModified({
      filePath: "/repo/content/docs/glossary.mdx",
      manifest,
      probe: { authorDate: () => "2026-03-03T00:00:00Z", shallow: true },
      repositoryRoot: "/repo",
      snapshot,
    });

    expect(shallow?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(missing?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(boundaryDate?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("keeps the committed snapshot aligned with this full clone and the manifest", () => {
    expect(docsLastModifiedProblems(process.cwd())).toStrictEqual([]);
  });

  it("dates a shallow clone from the snapshot when the commit is outside the shallow window", async () => {
    const full = temporaryDirectory();
    const firstDate = "2026-01-01T00:00:00Z";
    const secondDate = "2026-02-02T00:00:00Z";
    git(full, ["init", "-b", "main"]);
    writePage(full, "content/docs/glossary.mdx", "Glossary");
    writeManifest(full);
    commit(full, "add glossary", firstDate);
    writePage(full, "content/docs/develop/quickstart.mdx", "Quickstart");
    writePage(full, "content/docs/api-reference/index.mdx", "Reference");
    commit(full, "add quickstart and reference", secondDate);

    const snapshot = await collectDocsLastModifiedSnapshot(
      full,
      async () => "2026-10-26T11:00:54Z"
    );
    expect({
      contract: snapshot.contract,
      glossary: new Date(
        snapshot.pages["content/docs/glossary.mdx"] ?? ""
      ).toISOString(),
      reference: snapshot.pages["content/docs/api-reference/index.mdx"],
    }).toStrictEqual({
      contract: {
        committedAt: "2026-10-26T11:00:54Z",
        repository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
        sha: "4bc001bb6c03d16aef80762174691fdf9b898707",
      },
      glossary: new Date(firstDate).toISOString(),
      reference: undefined,
    });

    const shallow = temporaryDirectory();
    git(full, ["clone", "--depth", "1", "--no-local", full, shallow]);
    const probe = createGitHistoryProbe(shallow);
    const input = {
      manifest: manifestPin(),
      probe,
      repositoryRoot: shallow,
      snapshot,
    };
    const copied = temporaryDirectory();
    writePage(copied, "content/docs/glossary.mdx", "Glossary");
    writePage(copied, "content/docs/develop/quickstart.mdx", "Quickstart");
    writeManifest(copied);
    const withoutGit = createGitHistoryProbe(copied);

    expect({
      boundary: new Date(
        probe.authorDate("content/docs/glossary.mdx") ?? ""
      ).toISOString(),
      glossary: resolveDocsLastModified({
        ...input,
        filePath: path.join(shallow, "content/docs/glossary.mdx"),
      })?.toISOString(),
      missingGit: resolveDocsLastModified({
        filePath: path.join(copied, "content/docs/glossary.mdx"),
        manifest: manifestPin(),
        probe: withoutGit,
        repositoryRoot: copied,
        snapshot,
      })?.toISOString(),
      missingProblems: docsLastModifiedProblems(copied, withoutGit, snapshot),
      quickstart: resolveDocsLastModified({
        ...input,
        filePath: path.join(shallow, "content/docs/develop/quickstart.mdx"),
      })?.toISOString(),
      reference: resolveDocsLastModified({
        ...input,
        filePath: path.join(shallow, "content/docs/api-reference/index.mdx"),
      })?.toISOString(),
      shallow: probe.shallow,
      shallowProblems: docsLastModifiedProblems(shallow, probe, snapshot),
      withoutGit: withoutGit.shallow,
    }).toStrictEqual({
      boundary: new Date(secondDate).toISOString(),
      glossary: "2026-01-01T00:00:00.000Z",
      missingGit: "2026-01-01T00:00:00.000Z",
      missingProblems: [],
      quickstart: "2026-02-02T00:00:00.000Z",
      reference: "2026-10-26T11:00:54.000Z",
      shallow: true,
      shallowProblems: [],
      withoutGit: null,
    });
  });

  it("returns the baked dates for a handwritten page and a generated reference page", async () => {
    const snapshot = readDocsLastModifiedSnapshot(process.cwd());
    const glossary = await docsLastModifiedTime(
      path.join(process.cwd(), "content/docs/glossary.mdx")
    );
    const reference = await docsLastModifiedTime(
      path.join(process.cwd(), "content/docs/api-reference/index.mdx")
    );
    expect(glossary.toISOString()).toBe(
      new Date(snapshot.pages["content/docs/glossary.mdx"] ?? "").toISOString()
    );
    expect(reference.toISOString()).toBe("2026-10-26T11:00:54.000Z");
  });
});

const missingAuthorDate: string | undefined = undefined;

function snapshotWith(pages: Record<string, string>): DocsLastModifiedSnapshot {
  return {
    contract: {
      committedAt: "2026-10-26T11:00:54Z",
      repository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
      sha: "4bc001bb6c03d16aef80762174691fdf9b898707",
    },
    pages,
  };
}

function manifestPin() {
  return {
    sourceCommit: "4bc001bb6c03d16aef80762174691fdf9b898707",
    sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
  };
}

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "atlas-docs-dates-"));
  directories.push(directory);
  return directory;
}

function writePage(root: string, relativePath: string, title: string): void {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `---\ntitle: ${title}\n---\n\n${title}\n`);
}

function writeManifest(root: string): void {
  const filePath = path.join(root, "contracts/public-openapi.manifest.json");
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        sha256: "abc",
        sourceCommit: "4bc001bb6c03d16aef80762174691fdf9b898707",
        sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
      },
      null,
      2
    )}\n`
  );
}

function git(cwd: string, args: string[], authorDate?: string): void {
  execFileSync("git", args, {
    cwd,
    env: authorDate
      ? {
          ...gitEnv,
          GIT_AUTHOR_DATE: authorDate,
          GIT_COMMITTER_DATE: authorDate,
        }
      : gitEnv,
    stdio: "pipe",
  });
}

function commit(cwd: string, message: string, authorDate: string): void {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", message], authorDate);
}
