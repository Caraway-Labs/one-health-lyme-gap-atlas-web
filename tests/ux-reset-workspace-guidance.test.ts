import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { metadata as workspaceMetadata } from "@/app/app/layout";
import { metadata as geographicExplorerMetadata } from "@/app/geographic_explorer/page";
import { metadata as investigateMetadata } from "@/app/investigate/page";
import { metadata as overviewMetadata } from "@/app/overview/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  absentInheritedField,
  finalizeInheritedContext,
  validatedInheritedField,
  type AskAtlasInheritedContext,
  type AskAtlasSurface,
} from "@/features/ux-reset/ask-atlas/inherited-context";
import {
  askAtlasReturnHref,
  pageReferenceFromContext,
} from "@/features/ux-reset/ask-atlas/page-reference";
import { recordedWorkspaceMigration } from "@/features/ux-reset/workspace-route-migration";
import { accountFreeContinueHref } from "@/lib/auth/return-path";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

const USER_GUIDES = [
  "content/docs/index.mdx",
  "content/docs/what-is-atlas.mdx",
  "content/docs/who-is-atlas-for.mdx",
  "content/docs/atlas-workflow.mdx",
  "content/docs/professional-workspace.mdx",
  "content/docs/current-capabilities.mdx",
  "content/docs/investigation-workflows.mdx",
  "content/docs/evidence-and-uncertainty.mdx",
  "content/docs/releases-and-methodology.mdx",
  "content/docs/ai-enabled-decision-intelligence.mdx",
  "content/docs/faq-and-troubleshooting.mdx",
] as const;

const STALE_INSTRUCTIONS = [
  "Open Investigate",
  "Continue to Action",
  "Investigate this county",
  "Return to Investigate",
  "](/app/explore)",
  "](/app/investigate)",
  "](/app/action)",
  "](/overview)",
  "](/geographic_explorer)",
  "Review, Explore, Investigate, Compare, and Action",
  "Assistant page",
] as const;

function guideText(): string {
  return USER_GUIDES.map((file) =>
    readFileSync(path.join(process.cwd(), file), "utf-8")
  ).join("\n");
}

function missingPhrases(text: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => !text.includes(phrase));
}

function contextFor(surface: AskAtlasSurface): AskAtlasInheritedContext {
  const context = finalizeInheritedContext({
    fields: {
      geography: validatedInheritedField("08001", "Adams, Colorado (08001)"),
      measure:
        surface === "explore"
          ? validatedInheritedField("reported-cases", "Reported cases")
          : absentInheritedField(),
      period: validatedInheritedField("2023-01-01", "2023"),
      release: validatedInheritedField("alpha-2026", "alpha-2026"),
      source: absentInheritedField(),
    },
    surface,
  });
  if (!context) {
    throw new Error(`Ask Atlas context for ${surface} did not validate.`);
  }
  return context;
}

function returnHref(surface: AskAtlasSurface, search: string): string {
  const reference = pageReferenceFromContext(
    contextFor(surface),
    new URLSearchParams(search)
  );
  if (!reference) {
    throw new Error(`Page reference for ${surface} did not validate.`);
  }
  return askAtlasReturnHref(reference);
}

const CAPABILITY_STATUS_LABELS = [
  "Available now",
  "Planned",
  "Experimental/demo",
  "Not supported",
] as const;

function capabilityStatusCells(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
    .filter((cells) => cells[1] !== "Status" && cells.length >= 2)
    .map((cells) => cells[1] ?? "");
}

describe("six-page workspace guidance", () => {
  it("describes the six destinations and the evidence states readers can meet", () => {
    const workspace = readFileSync(
      path.join(process.cwd(), "content/docs/professional-workspace.mdx"),
      "utf-8"
    );
    expect(
      missingPhrases(workspace, [
        "Atlas Explorer",
        "Compare",
        "Ask Atlas",
        "Feed",
        "Settings",
        "Docs",
        "Loading",
        "Empty",
        "Available",
        "Limited",
        "Unavailable",
        "Unknown",
        "Error",
        "Sign-in",
        "signed-out",
        "/explore",
        "/compare",
        "/askatlas",
        "/app/feed",
        "/app/settings",
        "/docs",
        "does not open a side panel",
        "not a statement that the report contains none of a period",
      ])
    ).toStrictEqual([]);
  });

  it("does not send readers to removed destinations", () => {
    expect(
      STALE_INSTRUCTIONS.filter((phrase) => guideText().includes(phrase))
    ).toStrictEqual([]);
  });

  it("uses only the four declared capability status labels", () => {
    const capabilities = readFileSync(
      path.join(process.cwd(), "content/docs/current-capabilities.mdx"),
      "utf-8"
    );
    const declared = new Set<string>(CAPABILITY_STATUS_LABELS);
    expect(
      capabilityStatusCells(capabilities).filter(
        (status) => !declared.has(status)
      )
    ).toStrictEqual([]);
  });
});

describe("product links follow the recorded route map", () => {
  it("returns Ask Atlas readers to Explorer evidence, follow-up, or Compare", () => {
    const search =
      "scope=CO&county=08001&dataset=alpha-2026&period=2023-01-01&metric=reported-cases&map_scope=CO";
    const explore = new URL(returnHref("explore", search), "http://localhost");
    const investigate = new URL(
      returnHref("investigate", search),
      "http://localhost"
    );
    const action = new URL(returnHref("action", search), "http://localhost");
    const compareContext = finalizeInheritedContext({
      fields: {
        geography: validatedInheritedField(
          "08001,08013",
          "Adams, Colorado compared with Boulder, Colorado"
        ),
        measure: absentInheritedField(),
        period: absentInheritedField(),
        release: absentInheritedField(),
        source: absentInheritedField(),
      },
      surface: "compare",
    });
    if (!compareContext) {
      throw new Error("Compare context did not validate.");
    }
    const compareReference = pageReferenceFromContext(
      compareContext,
      new URLSearchParams("scope=CO&compare=08001,08013&county=08001")
    );
    if (!compareReference) {
      throw new Error("Compare page reference did not validate.");
    }
    const compare = new URL(
      askAtlasReturnHref(compareReference),
      "http://localhost"
    );

    expect({
      action: {
        county: action.searchParams.get("county"),
        mode: action.searchParams.get("mode"),
        path: action.pathname,
        plan: action.searchParams.get("plan"),
      },
      compare: {
        pair: compare.searchParams.get("compare"),
        path: compare.pathname,
      },
      explore: {
        county: explore.searchParams.get("county"),
        dataset: explore.searchParams.get("dataset"),
        mapScope: explore.searchParams.get("map_scope"),
        metric: explore.searchParams.get("metric"),
        mode: explore.searchParams.get("mode"),
        path: explore.pathname,
        period: explore.searchParams.get("period"),
        scope: explore.searchParams.get("scope"),
      },
      investigate: {
        county: investigate.searchParams.get("county"),
        metric: investigate.searchParams.get("metric"),
        mode: investigate.searchParams.get("mode"),
        path: investigate.pathname,
      },
    }).toStrictEqual({
      action: {
        county: "08001",
        mode: "follow-up",
        path: "/explore",
        plan: null,
      },
      compare: { pair: "08001,08013", path: "/compare" },
      explore: {
        county: "08001",
        dataset: "alpha-2026",
        mapScope: null,
        metric: null,
        mode: null,
        path: "/explore",
        period: "2023-01-01",
        scope: "CO",
      },
      investigate: {
        county: "08001",
        metric: null,
        mode: "evidence",
        path: "/explore",
      },
    });
  });

  it("keeps a missing or invalid county from selecting another county", () => {
    const missingContext = finalizeInheritedContext({
      fields: {
        geography: absentInheritedField(),
        measure: absentInheritedField(),
        period: validatedInheritedField("2023-01-01", "2023"),
        release: absentInheritedField(),
        source: absentInheritedField(),
      },
      surface: "investigate",
    });
    if (!missingContext) {
      throw new Error("Missing-county context did not validate.");
    }
    const missingReference = pageReferenceFromContext(
      missingContext,
      new URLSearchParams("scope=CO")
    );
    if (!missingReference) {
      throw new Error("Missing-county page reference did not validate.");
    }
    const missingReturn = new URL(
      askAtlasReturnHref(missingReference),
      "http://localhost"
    );
    const migrationView = (
      pathname: string,
      search: string
    ): {
      county: string | null;
      kind: string;
      mode: string | null;
      path: string;
      scope: string | null;
      selection: string | null;
    } => {
      const result = recordedWorkspaceMigration({
        pathname,
        searchParams: new URLSearchParams(search),
      });
      const url =
        result.kind === "redirect"
          ? new URL(result.href, "http://localhost")
          : null;
      return {
        county: url?.searchParams.get("county") ?? null,
        kind: result.kind,
        mode: url?.searchParams.get("mode") ?? null,
        path: url?.pathname ?? "",
        scope: url?.searchParams.get("scope") ?? null,
        selection: url?.searchParams.get("selection") ?? null,
      };
    };
    expect({
      invalid: migrationView("/app/investigate", "scope=CO&county=nope"),
      missingAlias: migrationView("/app/investigate", "scope=CO"),
      missingReturn: {
        county: missingReturn.searchParams.get("county"),
        mode: missingReturn.searchParams.get("mode"),
        path: missingReturn.pathname,
        period: missingReturn.searchParams.get("period"),
        scope: missingReturn.searchParams.get("scope"),
      },
    }).toStrictEqual({
      invalid: {
        county: null,
        kind: "redirect",
        mode: null,
        path: "/explore",
        scope: "CO",
        selection: "required",
      },
      missingAlias: {
        county: null,
        kind: "redirect",
        mode: null,
        path: "/explore",
        scope: "CO",
        selection: null,
      },
      missingReturn: {
        county: null,
        mode: null,
        path: "/explore",
        period: "2023-01-01",
        scope: "CO",
      },
    });
  });

  it("round-trips a signed-out alias through sign-in without indexing the workspace", () => {
    const alias = "/app/investigate?county=08001&scope=CO";
    expect({
      accountFree: accountFreeContinueHref(alias),
      geographicExplorerIndexed: geographicExplorerMetadata.robots,
      investigateIndexed: investigateMetadata.robots,
      overviewCanonical: overviewMetadata.alternates,
      overviewIndexed: overviewMetadata.robots,
      robots: robots().rules,
      signIn: signInHrefForReturnPath(alias),
      sitemapIncludesApp: sitemap().some((entry) => entry.url.includes("/app")),
      workspaceIndexed: workspaceMetadata.robots,
    }).toStrictEqual({
      accountFree: "/explore",
      geographicExplorerIndexed: { follow: false, index: false },
      investigateIndexed: { follow: false, index: false },
      overviewCanonical: { canonical: "/overview" },
      overviewIndexed: { follow: false, index: false },
      robots: { allow: "/", userAgent: "*" },
      signIn: `/auth/sign-in?next=${encodeURIComponent(alias)}`,
      sitemapIncludesApp: false,
      workspaceIndexed: { follow: false, index: false },
    });
  });
});
