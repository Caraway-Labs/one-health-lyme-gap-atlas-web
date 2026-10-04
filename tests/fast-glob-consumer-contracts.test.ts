import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

const resolveFastGlob = (packageRoot: string) =>
  require(require.resolve("fast-glob", { paths: [packageRoot] }));

describe("fast-glob consumer contracts (GHSA-vfj7 regression)", () => {
  it("exposes the default callable and .sync() for shadcn's fast-glob", () => {
    const fastGlob = resolveFastGlob(
      path.join(process.cwd(), "node_modules/shadcn")
    );
    expect(fastGlob).toBeTypeOf("function");
    expect(fastGlob.sync).toBeTypeOf("function");
    const matches = fastGlob.sync("package.json", { onlyFiles: true });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("exposes the default callable and .sync() for @ts-morph/common fast-glob", () => {
    const fastGlob = resolveFastGlob(
      path.dirname(require.resolve("@ts-morph/common/package.json"))
    );
    expect(fastGlob).toBeTypeOf("function");
    expect(fastGlob.sync).toBeTypeOf("function");
    const matches = fastGlob.sync("package.json", { onlyFiles: true });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("starts the shadcn CLI (--help)", () => {
    const result = spawnSync("npx", ["shadcn", "--help"], {
      cwd: process.cwd(),
      encoding: "utf-8",
      shell: false,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/shadcn/i);
  });

  it("ts-morph resolves paths via sync and async globs", async () => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const host = project.getFileSystem();

    const syncMatches = host.globSync(["package.json"]);
    expect(syncMatches.length).toBeGreaterThan(0);

    const asyncMatches = await host.glob(["package.json"]);
    expect(asyncMatches.length).toBeGreaterThan(0);
  });
});
