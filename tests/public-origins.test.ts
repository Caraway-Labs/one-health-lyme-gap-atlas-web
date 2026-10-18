import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import {
  getMetadataBase,
  getPublishedApiOrigin,
  getSiteOrigin,
  openApiDocumentUrl,
  PRODUCTION_API_ORIGIN,
  PRODUCTION_DOCS_URL,
  PRODUCTION_SITE_ORIGIN,
  resolvePublicOrigins,
  rewritePublicOriginText,
} from "../src/lib/public-origins";
import { rewriteOriginTree } from "../src/lib/remark-public-origins";

const PREVIEW = {
  NEXT_PUBLIC_API_BASE_URL: "https://api.preview.example",
  NEXT_PUBLIC_DOCS_URL: "https://preview.example/docs",
  NEXT_PUBLIC_SITE_URL: "https://preview.example",
} as const;

const ORIGINAL_ENV = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

describe("public documentation origins", () => {
  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_API_BASE_URL");
    restoreEnv("NEXT_PUBLIC_DOCS_URL");
    restoreEnv("NEXT_PUBLIC_SITE_URL");
  });

  it("defaults canonical, docs, and API origins to onehealthatlas", () => {
    const origins = resolvePublicOrigins({});
    expect(origins).toStrictEqual({
      apiOrigin: PRODUCTION_API_ORIGIN,
      docsUrl: PRODUCTION_DOCS_URL,
      siteOrigin: PRODUCTION_SITE_ORIGIN,
    });
    expect(openApiDocumentUrl(origins)).toBe(
      "https://api.onehealthatlas.org/openapi.json"
    );
    expect(getMetadataBase({}).origin).toBe(PRODUCTION_SITE_ORIGIN);
  });

  it("uses preview origins from environment config", () => {
    const origins = resolvePublicOrigins(PREVIEW);
    expect(origins).toStrictEqual({
      apiOrigin: "https://api.preview.example",
      docsUrl: "https://preview.example/docs",
      siteOrigin: "https://preview.example",
    });
    expect(openApiDocumentUrl(origins)).toBe(
      "https://api.preview.example/openapi.json"
    );
    expect(
      getDocsDerivedFromSite({
        NEXT_PUBLIC_SITE_URL: "https://preview.example",
      })
    ).toBe("https://preview.example/docs");
  });

  it("rejects docs URLs that are not HTTPS /docs and origins that include a path", () => {
    expect(() =>
      resolvePublicOrigins({
        NEXT_PUBLIC_DOCS_URL: "http://example.com/docs",
      })
    ).toThrow("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
    expect(() =>
      resolvePublicOrigins({
        NEXT_PUBLIC_DOCS_URL: "https://example.com/help",
      })
    ).toThrow("NEXT_PUBLIC_DOCS_URL must be an HTTPS /docs URL.");
    expect(() =>
      getSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://preview.example/docs" })
    ).toThrow("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin.");
    expect(() =>
      getPublishedApiOrigin({
        NEXT_PUBLIC_API_BASE_URL: "ftp://api.preview.example",
      })
    ).toThrow("NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) URL.");
  });

  it("rewrites canonical, MDX, OpenAPI pointer, and externalDocs links without problem types", () => {
    const source = [
      "curl -fsS 'https://api.carawaylabs.com/v1/observations?measure_id=case_count_floor_2023'",
      "Raw spec: [OpenAPI schema](https://api.onehealthatlas.org/openapi.json).",
      "[Atlas documentation and developer guides](https://carawaylabs.com/docs)",
      "Canonical: https://onehealthatlas.org/docs/api-reference",
      '  "type": "https://carawaylabs.com/problems/http-404",',
    ].join("\n");

    expect(rewritePublicOriginText(source, resolvePublicOrigins({}))).toBe(
      [
        "curl -fsS 'https://api.onehealthatlas.org/v1/observations?measure_id=case_count_floor_2023'",
        "Raw spec: [OpenAPI schema](https://api.onehealthatlas.org/openapi.json).",
        "[Atlas documentation and developer guides](https://onehealthatlas.org/docs)",
        "Canonical: https://onehealthatlas.org/docs/api-reference",
        '  "type": "https://carawaylabs.com/problems/http-404",',
      ].join("\n")
    );
  });

  it("points preview docs at the configured origins and keeps problem types", () => {
    const preview = rewritePublicOriginText(
      [
        "Raw spec: [OpenAPI schema](https://api.onehealthatlas.org/openapi.json).",
        "[Atlas documentation and developer guides](https://onehealthatlas.org/docs)",
        '  "type": "https://carawaylabs.com/problems/http-404",',
      ].join("\n"),
      resolvePublicOrigins(PREVIEW)
    );
    expect(preview).toContain("https://api.preview.example/openapi.json");
    expect(preview).toContain("https://preview.example/docs)");
    expect(preview).toContain("https://carawaylabs.com/problems/http-404");
    expect(preview).not.toContain("api.onehealthatlas.org");
    expect(preview).not.toContain("api.carawaylabs.com");
  });

  it("rewrites link and code nodes in the docs tree", () => {
    const tree = {
      children: [
        {
          type: "link",
          url: "https://api.onehealthatlas.org/openapi.json",
          children: [{ type: "text", value: "OpenAPI schema" }],
        },
        {
          type: "code",
          value: "curl https://api.carawaylabs.com/openapi.json",
        },
      ],
      type: "root",
    };
    rewriteOriginTree(tree, resolvePublicOrigins(PREVIEW));
    expect(tree.children[0]?.url).toBe(
      "https://api.preview.example/openapi.json"
    );
    expect(tree.children[1]?.value).toBe(
      "curl https://api.preview.example/openapi.json"
    );
  });

  it("publishes robots and sitemap from the configured site origin", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_DOCS_URL;
    expect(robots().sitemap).toBe("https://onehealthatlas.org/sitemap.xml");
    expect(sitemap()[0]?.url).toBe(PRODUCTION_DOCS_URL);

    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example";
    delete process.env.NEXT_PUBLIC_DOCS_URL;
    expect(robots().sitemap).toBe("https://preview.example/sitemap.xml");
    expect(sitemap()[0]?.url).toBe("https://preview.example/docs");
  });

  it("keeps the pinned contract and generated docs on onehealthatlas domains", async () => {
    const [manifestText, contractText] = await Promise.all([
      readFile("contracts/public-openapi.manifest.json", "utf-8"),
      readFile("contracts/public-openapi.json", "utf-8"),
    ]);
    const manifest = JSON.parse(manifestText) as { sourceUrl: string };
    const contract = JSON.parse(contractText) as {
      externalDocs: { url: string };
      servers: { url: string }[];
    };
    expect(manifest.sourceUrl).toBe(
      "https://api.onehealthatlas.org/openapi.json"
    );
    expect(contract.servers[0]?.url).toBe(PRODUCTION_API_ORIGIN);
    expect(contract.externalDocs.url).toBe(PRODUCTION_DOCS_URL);
    expect(withoutProblemTypes(contractText)).not.toContain("carawaylabs.com");
  });

  it("keeps authored docs free of legacy docs and API hosts", async () => {
    const docsFiles = await collectMarkdown(
      path.join(process.cwd(), "content", "docs")
    );
    const offenders: string[] = [];
    for (const file of docsFiles) {
      const content = await readFile(file, "utf-8");
      if (withoutProblemTypes(content).includes("carawaylabs.com")) {
        offenders.push(file);
      }
    }
    expect(offenders).toStrictEqual([]);
    const referenceIndex = await readFile(
      "content/docs/api-reference/index.mdx",
      "utf-8"
    );
    expect(referenceIndex).toContain(
      "[OpenAPI schema](https://api.onehealthatlas.org/openapi.json)"
    );
    expect(referenceIndex).toContain(
      "[Atlas documentation and developer guides](https://onehealthatlas.org/docs)"
    );
  });

  it("defaults the image build to the onehealthatlas origins", async () => {
    const [dockerfile, agents] = await Promise.all([
      readFile("Dockerfile", "utf-8"),
      readFile("AGENTS.md", "utf-8"),
    ]);
    expect(dockerfile).toContain(
      "ARG NEXT_PUBLIC_API_BASE_URL=https://api.onehealthatlas.org"
    );
    expect(dockerfile).toContain(
      "ARG NEXT_PUBLIC_SITE_URL=https://onehealthatlas.org"
    );
    expect(dockerfile).toContain(
      "ARG NEXT_PUBLIC_DOCS_URL=https://onehealthatlas.org/docs"
    );
    expect(dockerfile).not.toContain("carawaylabs.com");
    expect(agents).not.toContain("carawaylabs.com");
  });

  it("references public origins with direct NEXT_PUBLIC bindings", async () => {
    const source = await readFile("src/lib/public-origins.ts", "utf-8");
    expect(source).toContain("process.env.NEXT_PUBLIC_SITE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_API_BASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_DOCS_URL");
    expect(source).not.toContain("process.env[");
  });
});

function getDocsDerivedFromSite(
  environment: Parameters<typeof resolvePublicOrigins>[0]
): string {
  return resolvePublicOrigins(environment).docsUrl;
}

function withoutProblemTypes(value: string): string {
  return value.replaceAll(
    /https:\/\/(?:www\.)?carawaylabs\.com\/problems\/\S+/g,
    ""
  );
}

async function collectMarkdown(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdown(fullPath)));
    } else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function restoreEnv(
  key:
    | "NEXT_PUBLIC_API_BASE_URL"
    | "NEXT_PUBLIC_DOCS_URL"
    | "NEXT_PUBLIC_SITE_URL"
): void {
  const value = ORIGINAL_ENV[key];
  if (value !== undefined) {
    if (key === "NEXT_PUBLIC_API_BASE_URL") {
      process.env.NEXT_PUBLIC_API_BASE_URL = value;
    } else if (key === "NEXT_PUBLIC_DOCS_URL") {
      process.env.NEXT_PUBLIC_DOCS_URL = value;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = value;
    }
    return;
  }
  if (key === "NEXT_PUBLIC_API_BASE_URL") {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    return;
  }
  if (key === "NEXT_PUBLIC_DOCS_URL") {
    delete process.env.NEXT_PUBLIC_DOCS_URL;
    return;
  }
  delete process.env.NEXT_PUBLIC_SITE_URL;
}
