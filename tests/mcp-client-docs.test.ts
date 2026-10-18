import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ATLAS_INTERPRETATION_GUARDRAILS } from "@/features/docs/interpretation-guardrails";

const docsRoot = path.join(process.cwd(), "content", "docs");

function readDoc(relativePath: string): string {
  return fs.readFileSync(path.join(docsRoot, relativePath), "utf-8");
}

const clientPage = readDoc("develop/mcp-clients.mdx");

function absentPhrases(text: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => text.split(phrase).length === 1);
}

describe("MCP client configuration documentation", () => {
  it("lists the page in the developer section", () => {
    const navigation = JSON.parse(
      fs.readFileSync(path.join(docsRoot, "develop", "meta.json"), "utf-8")
    ) as { pages?: string[] };
    const pages = navigation.pages ?? [];

    expect(pages).toContain("mcp-clients");
    expect(pages.indexOf("mcp-clients")).toBe(pages.indexOf("support") - 1);
  });

  it("states the production transport, auth, and four-tool inventory", () => {
    const requiredPhrases = [
      "https://mcp.onehealthatlas.org/mcp",
      "Streamable HTTP",
      "application/json",
      "text/event-stream",
      "mcp-session-id",
      "2025-06-18",
      "atlas-lyme-mcp",
      "No sign in",
      "Do not send an API key, OAuth client, or Settings secret",
      "GET https://mcp.onehealthatlas.org/healthz",
      "GET /sse",
      "POST /messages",
      "HTTP 404",
      "Production does not publish a stdio endpoint",
      "exactly four tools",
      "atlas_discover_indicators",
      "atlas_get_county_profile",
      "atlas_get_evidence_provenance",
      "atlas_resolve_geographies",
      "resources/list",
      "prompts/list",
      "Unknown tool: server_status",
      "Unknown tool: atlas_smoke_test",
      "2026-10-18",
    ];
    const missing = requiredPhrases.filter(
      (phrase) => !clientPage.includes(phrase)
    );

    expect(missing).toStrictEqual([]);
  });

  it("gives Claude Desktop, Cursor, and custom client recipes without credentials", () => {
    const requiredPhrases = [
      "claude_desktop_config.json",
      "Do not add this URL there",
      '"transport": "http"',
      "~/.cursor/mcp.json",
      '"type": "http"',
      "Do not set `sse` or `streamable-http`",
      "Do not add `headers` or an `auth` object",
      'protocolVersion":"2025-06-18',
      "python -m atlas_lyme_mcp.check_client",
      "MCP_URL=https://mcp.onehealthatlas.org/mcp",
    ];
    const missing = requiredPhrases.filter(
      (phrase) => !clientPage.includes(phrase)
    );

    const forbidden = [
      "carawaylabs.com",
      "Bearer ",
      '"type": "sse"',
      '"type": "streamable-http"',
      "Authorization:",
    ].filter((phrase) => clientPage.includes(phrase));

    expect(missing).toStrictEqual([]);
    expect(forbidden).toStrictEqual([]);
  });

  it("publishes copyable interpretation guardrails", () => {
    const requiredPhrases = [
      "Missing is not zero.",
      "A published ZERO stays a real zero.",
      "NO_RECORDS does not establish biological absence.",
      "A gap or a review priority is not risk or a diagnosis.",
      "Cite the release id, methodology id and version, semantic version, source vintage, and limitations",
      "Do not invent a release id when it is null.",
    ];
    const missing = absentPhrases(
      ATLAS_INTERPRETATION_GUARDRAILS,
      requiredPhrases
    );

    expect(clientPage).toContain("<InterpretationGuardrailCopy />");
    expect(missing).toStrictEqual([]);
  });

  it("links the recipes from the access, developer, and source guides", () => {
    const linkedPages = [
      "index.mdx",
      "api-mcp-and-access.mdx",
      "sources-and-canonical-evidence.mdx",
      "develop/index.mdx",
      "develop/support.mdx",
    ];
    const missing = linkedPages.filter(
      (page) => !readDoc(page).includes("](/docs/develop/mcp-clients)")
    );

    const accessPage = readDoc("api-mcp-and-access.mdx");
    const boundaryPhrases = absentPhrases(accessPage, [
      "exactly four tools",
      "exactly six tools; that receipt is historical",
    ]);

    expect(missing).toStrictEqual([]);
    expect(boundaryPhrases).toStrictEqual([]);
    expect(readDoc("sources-and-canonical-evidence.mdx")).toContain(
      "not in the current production tool list"
    );
  });
});
