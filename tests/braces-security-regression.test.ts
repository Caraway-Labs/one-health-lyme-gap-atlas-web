import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression coverage ported from micromatch/braces PR #72 security tests
 * (commit 28d440b5dd449dbf1fe6f3506cf94ecca4d02660).
 */
const require = createRequire(import.meta.url);

const micromatchPackageRoot = path.dirname(
  require.resolve("micromatch/package.json")
);

const resolveBracesModule = (subpath = "") => {
  const request = subpath ? `braces/${subpath}` : "braces";
  return require(require.resolve(request, { paths: [micromatchPackageRoot] }));
};

const braces = resolveBracesModule();
const parse = resolveBracesModule("lib/parse");
const compile = resolveBracesModule("lib/compile");
const expand = resolveBracesModule("lib/expand");
const stringify = resolveBracesModule("lib/stringify");

const buildDeepBraceAst = (depth: number) => {
  let ast: { type: string; nodes?: unknown[]; value?: string } = {
    type: "text",
    value: "a",
  };
  for (let index = 0; index < depth; index += 1) {
    ast = { type: "brace", nodes: [ast] };
  }
  return { type: "root", nodes: [ast] };
};

describe("vendored braces security regressions (GHSA-vfj7-8cjw-p6xm)", () => {
  it("resolves the same braces implementation micromatch uses (vendor 3.0.4)", () => {
    const bracesPackageJson = require.resolve("braces/package.json", {
      paths: [micromatchPackageRoot],
    });
    expect(bracesPackageJson).toContain(`${path.sep}vendor${path.sep}braces`);
    expect(braces.parse).toBeTypeOf("function");
    expect(require(bracesPackageJson).version).toBe("3.0.4");
  });

  it("rejects nested-brace input above max depth and accepts depth 100 (PR72 parse)", () => {
    expect(() => parse(`${"{".repeat(101)}a,b${"}".repeat(101)}`)).toThrow(
      /exceeds max depth/
    );
    expect(() => parse("(".repeat(101) + ")".repeat(101))).toThrow(
      /exceeds max depth/
    );
    expect(() =>
      parse(`${"{".repeat(100)}a,b${"}".repeat(100)}`)
    ).not.toThrow();
    expect(() => parse(`${"(".repeat(100)}a${")".repeat(100)}`)).not.toThrow();
  });

  it("honors integer maxDepth limits during parse (PR72 parse)", () => {
    expect(() => parse("{{a,b},c}", { maxDepth: 1 })).toThrow(
      /exceeds max depth/
    );
    expect(() => parse("{{a,b},c}", { maxDepth: 2 })).not.toThrow();
  });

  it("honors fractional maxDepth limits during parse (PR72 parse)", () => {
    expect(() => parse("{a,b}", { maxDepth: 1.5 })).not.toThrow();
    expect(() => parse("{{a,b},c}", { maxDepth: 1.5 })).toThrow(
      /exceeds max depth/
    );
    expect(() => parse("(a)", { maxDepth: 1.5 })).not.toThrow();
    expect(() => parse("((a))", { maxDepth: 1.5 })).toThrow(
      /exceeds max depth/
    );
  });

  it("rejects caller-provided ASTs deeper than max depth (PR72 compile/expand/stringify)", () => {
    const deepAst = buildDeepBraceAst(101);
    expect(() => compile(deepAst)).toThrow(/exceeds max depth/);
    expect(() => expand(deepAst)).toThrow(/exceeds max depth/);
    expect(() => stringify(deepAst)).toThrow(/exceeds max depth/);
    expect(() => compile(buildDeepBraceAst(100))).not.toThrow();
  });

  it("rejects cyclic parent chains during expand (PR72 expand)", () => {
    const selfReferencing: {
      type: string;
      nodes: { type: string; value: string }[];
      parent?: unknown;
    } = {
      type: "paren",
      nodes: [{ type: "text", value: "a" }],
    };
    selfReferencing.parent = selfReferencing;
    expect(() => expand(selfReferencing)).toThrow(
      /parent chain contains a cycle/
    );

    const parent: { type: string; parent?: unknown } = { type: "paren" };
    const child: {
      type: string;
      parent: typeof parent;
      nodes: { type: string; value: string }[];
    } = {
      type: "paren",
      parent,
      nodes: [{ type: "text", value: "a" }],
    };
    parent.parent = child;
    expect(() => expand(child)).toThrow(/parent chain contains a cycle/);
  });

  it("rejects depth-101 patterns through micromatch's braces helper (consumer path)", () => {
    const micromatch = require(
      require.resolve("micromatch", {
        paths: [micromatchPackageRoot],
      })
    );
    const nested = `${"{".repeat(101)}a,b${"}".repeat(101)}`;
    expect(() => micromatch.braces(nested)).toThrow(/exceeds max depth/);
  });

  it("accepts depth-100 patterns through micromatch's braces helper (consumer path)", () => {
    const micromatch = require(
      require.resolve("micromatch", {
        paths: [micromatchPackageRoot],
      })
    );
    expect(() =>
      micromatch.braces(`${"{".repeat(100)}a,b${"}".repeat(100)}`)
    ).not.toThrow();
  });
});
