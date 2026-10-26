import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectDocsLastModifiedSnapshot,
  contractCommittedAtFromGitHubBody,
  createGitHistoryProbe,
  docsLastModifiedProblems,
  docsLastModifiedTime,
  fetchContractCommittedAt,
  readDocsLastModifiedManifest,
  readDocsLastModifiedSnapshot,
  resolveDocsLastModified,
  serializeDocsLastModifiedSnapshot,
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
    vi.unstubAllGlobals();
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

  it("rejects contract payloads, pins, and paths that are not the recorded commit", () => {
    const mismatched = snapshotWith({});
    mismatched.contract.sha = "different";
    const outcomes = {
      invalidDate: resolveDocsLastModified({
        filePath: "/repo/content/docs/glossary.mdx",
        manifest: manifestPin(),
        probe: { authorDate: () => "not-a-date", shallow: false },
        repositoryRoot: "/repo",
        snapshot: snapshotWith({
          "content/docs/glossary.mdx": "2026-01-01T00:00:00Z",
        }),
      }),
      mismatchedPin: resolveDocsLastModified({
        filePath: "/repo/content/docs/api-reference/index.mdx",
        manifest: manifestPin(),
        probe: { authorDate: () => "2026-04-04T00:00:00Z", shallow: false },
        repositoryRoot: "/repo",
        snapshot: mismatched,
      }),
      newerGitDate: resolveDocsLastModified({
        filePath: "/repo/content/docs/glossary.mdx",
        manifest: manifestPin(),
        probe: { authorDate: () => "2026-04-04T00:00:00Z", shallow: false },
        repositoryRoot: "/repo",
        snapshot: snapshotWith({
          "content/docs/glossary.mdx": "2026-01-01T00:00:00Z",
        }),
      })?.toISOString(),
    };
    expect(outcomes).toStrictEqual({
      invalidDate: undefined,
      mismatchedPin: undefined,
      newerGitDate: "2026-04-04T00:00:00.000Z",
    });
    expect(() =>
      resolveDocsLastModified({
        filePath: "/etc/passwd",
        manifest: manifestPin(),
        probe: { authorDate: () => missingAuthorDate, shallow: false },
        repositoryRoot: "/repo",
        snapshot: snapshotWith({}),
      })
    ).toThrow(/outside the repository/);
    expect(() =>
      contractCommittedAtFromGitHubBody(
        null,
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    ).toThrow(/did not include that commit/);
    expect(() =>
      contractCommittedAtFromGitHubBody(
        { commit: {}, sha: "abc123" },
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    ).toThrow(/no committer date/);
    expect(() =>
      contractCommittedAtFromGitHubBody(
        { commit: { committer: { date: "yesterday" } }, sha: "abc123" },
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    ).toThrow(/not a timestamp/);
  });

  it("reports snapshot drift and refuses to rewrite dates without a full clone", async () => {
    const root = temporaryDirectory();
    writePage(root, "content/docs/glossary.mdx", "Glossary");
    writeManifest(root);
    const drifted = snapshotWith({
      "content/docs/api-reference/index.mdx": "2026-01-01T00:00:00Z",
      "content/docs/glossary.mdx": "2026-01-01T00:00:00Z",
      "content/docs/missing.mdx": "not-a-date",
    });
    drifted.contract.committedAt = "not-a-date";
    drifted.contract.repository = "other/repo";
    drifted.contract.sha = "wrong";
    const probe = {
      authorDate: (file: string) =>
        file.endsWith("glossary.mdx") ? "2026-02-02T00:00:00Z" : undefined,
      shallow: false as const,
    };
    const missingPage = snapshotWith({});
    const undated = {
      authorDate: () => missingAuthorDate,
      shallow: false as const,
    };

    expect(
      docsLastModifiedProblems(root, probe, drifted, manifestPin())
    ).toStrictEqual([
      "Snapshot contract repository other/repo is not the manifest repository Caraway-Labs/one-health-lyme-gap-atlas-api.",
      "Snapshot contract wrong is not manifest sourceCommit 4bc001bb6c03d16aef80762174691fdf9b898707. Run npm run docs:last-modified.",
      "Snapshot contract committedAt is not a valid date. Run npm run docs:last-modified.",
      "content/docs/api-reference/index.mdx is generated API reference. Its last-updated date is the contract commit, not a page snapshot.",
      "content/docs/missing.mdx is in the last-updated snapshot but not in content/docs.",
      "content/docs/missing.mdx has an invalid last-updated timestamp.",
      "content/docs/glossary.mdx git date 2026-02-02T00:00:00Z differs from snapshot 2026-01-01T00:00:00Z. Run npm run docs:last-modified.",
    ]);
    expect({
      missing: docsLastModifiedProblems(
        root,
        undated,
        missingPage,
        manifestPin()
      ),
      undated: docsLastModifiedProblems(
        root,
        undated,
        snapshotWith({ "content/docs/glossary.mdx": "2026-01-01T00:00:00Z" }),
        manifestPin()
      ),
    }).toStrictEqual({
      missing: [
        "content/docs/glossary.mdx is missing from the last-updated snapshot. Run npm run docs:last-modified.",
      ],
      undated: [
        "content/docs/glossary.mdx has no git author date in this full clone.",
      ],
    });

    const shallow = temporaryDirectory();
    git(root, ["init", "-b", "main"]);
    commit(root, "add glossary", "2026-01-01T00:00:00Z");
    git(root, ["clone", "--depth", "1", "--no-local", root, shallow]);
    const untracked = temporaryDirectory();
    git(untracked, ["init", "-b", "main"]);
    writePage(untracked, "content/docs/glossary.mdx", "Glossary");
    writeManifest(untracked);
    commit(untracked, "add glossary", "2026-01-01T00:00:00Z");
    writePage(untracked, "content/docs/develop/quickstart.mdx", "Quickstart");
    const messages = {
      invalidContractDate: await errorMessage(() =>
        collectDocsLastModifiedSnapshot(root, async () => "not-a-date")
      ),
      missingGit: await errorMessage(() =>
        collectDocsLastModifiedSnapshot(temporaryDirectory())
      ),
      shallow: await errorMessage(() =>
        collectDocsLastModifiedSnapshot(shallow)
      ),
      untracked: await errorMessage(() =>
        collectDocsLastModifiedSnapshot(
          untracked,
          async () => "2026-10-26T11:00:54Z"
        )
      ),
    };
    expect(messages.invalidContractDate).toMatch(/not a valid timestamp/);
    expect(messages.missingGit).toMatch(/needs a git checkout/);
    expect(messages).toMatchObject({
      shallow: expect.stringMatching(/needs a full git clone/),
      untracked: expect.stringMatching(/no last-updated date/),
    });
  });

  it("rejects malformed manifest and snapshot files", () => {
    const root = temporaryDirectory();
    writeJson(root, "contracts/public-openapi.manifest.json", []);
    writeJson(root, "src/lib/docs-last-modified.json", { pages: {} });
    const manifest = errorMessageSync(() => readDocsLastModifiedManifest(root));
    writeJson(root, "contracts/public-openapi.manifest.json", {
      sourceCommit: 1,
    });
    const manifestFields = errorMessageSync(() =>
      readDocsLastModifiedManifest(root)
    );
    const malformed = errorMessageSync(() =>
      readDocsLastModifiedSnapshot(root)
    );
    writeJson(root, "src/lib/docs-last-modified.json", {
      contract: {
        committedAt: "2026-01-01T00:00:00Z",
        repository: "r",
        sha: 1,
      },
      pages: {},
    });
    const contract = errorMessageSync(() => readDocsLastModifiedSnapshot(root));
    writeJson(root, "src/lib/docs-last-modified.json", {
      contract: {
        committedAt: "2026-01-01T00:00:00Z",
        repository: "r",
        sha: "abc",
      },
      pages: { "content/docs/glossary.mdx": 1 },
    });
    const page = errorMessageSync(() => readDocsLastModifiedSnapshot(root));
    const missing = temporaryDirectory();
    const missingMessage = errorMessageSync(() =>
      readDocsLastModifiedSnapshot(missing)
    );

    expect({
      contract,
      malformed,
      manifest,
      manifestFields,
      missing: missingMessage,
      page,
    }).toMatchObject({
      contract: expect.stringMatching(/committedAt, repository, and sha/),
      malformed: expect.stringMatching(/malformed/),
      manifest: expect.stringMatching(/must be a JSON object/),
      manifestFields: expect.stringMatching(
        /sourceCommit and sourceRepository/
      ),
      missing: expect.stringMatching(
        /Missing src\/lib\/docs-last-modified.json/
      ),
      page: expect.stringMatching(/must be a timestamp string/),
    });
  });

  it("keeps the newest git author date and writes snapshot pages in path order", () => {
    const root = temporaryDirectory();
    git(root, ["init", "-b", "main"]);
    writePage(root, "content/docs/glossary.mdx", "Glossary");
    writeManifest(root);
    commit(root, "add glossary", "2026-01-01T00:00:00Z");
    writePage(root, "content/docs/glossary.mdx", "Glossary revised");
    commit(root, "revise glossary", "2026-03-03T00:00:00Z");
    const probe = createGitHistoryProbe(root);
    const serialized = serializeDocsLastModifiedSnapshot(
      snapshotWith({
        "content/docs/z.mdx": "2026-01-02T00:00:00Z",
        "content/docs/a.mdx": "2026-01-01T00:00:00Z",
      })
    );

    expect(
      new Date(
        probe.authorDate("content/docs/glossary.mdx") ?? ""
      ).toISOString()
    ).toBe("2026-03-03T00:00:00.000Z");
    expect(probe.shallow).toBeFalsy();
    expect(serialized.indexOf('"content/docs/a.mdx"')).toBeLessThan(
      serialized.indexOf('"content/docs/z.mdx"')
    );
    expect(serialized.endsWith("\n")).toBeTruthy();
  });

  it("reads the contract date from the GitHub commit payload", async () => {
    let calls = 0;
    const fetchMock = vi.fn<typeof fetch>(async () => {
      calls += 1;
      if (calls > 1) return new Response("missing", { status: 404 });
      return Response.json({
        commit: { committer: { date: "2026-10-26T11:00:54Z" } },
        sha: "abc123",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const committedAt = await fetchContractCommittedAt(
      "Caraway-Labs/one-health-lyme-gap-atlas-api",
      "abc123"
    );
    const failure = await errorMessage(() =>
      fetchContractCommittedAt(
        "Caraway-Labs/one-health-lyme-gap-atlas-api",
        "abc123"
      )
    );

    expect(committedAt).toBe("2026-10-26T11:00:54Z");
    expect(failure).toMatch(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails when a page has no last-updated date in this checkout", async () => {
    await expect(
      docsLastModifiedTime(
        path.join(process.cwd(), "content/docs/not-a-page.mdx")
      )
    ).rejects.toThrow(/not-a-page\.mdx/);
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

async function errorMessage(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
}

function errorMessageSync(action: () => unknown): string {
  try {
    action();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value));
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
