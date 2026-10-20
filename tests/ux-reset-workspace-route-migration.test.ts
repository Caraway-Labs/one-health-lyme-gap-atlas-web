import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { frontPorchExploreHref } from "@/features/front-porch/front-porch-copy";
import { RESET_ROUTES } from "@/features/ux-reset/paths";
import {
  ATLAS_EXPLORER_PATH,
  RESET_REVIEW_PATH,
  UX_RESET_DESTINATION_IDS,
} from "@/features/ux-reset/routes";
import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_MODE_PARAM,
  recordedWorkspaceMigration,
  WORKSPACE_DESTINATIONS,
  WORKSPACE_MIGRATION_INSTALL,
  WORKSPACE_MIGRATION_UNSUPPORTED_KEYS,
  type ExplorerMigrationMode,
  type RecordedWorkspaceMigration,
} from "@/features/ux-reset/workspace-route-migration";
import { ANALYTICAL_NAVIGATION_PATHS } from "@/lib/analytical-navigation-handoff";

const RETIRED_VARIANTS = [
  "/variant_1",
  "/variant_2",
  "/variant_3",
  "/variant_4",
  "/variant_5",
  "/variant_6",
  "/variant_7",
] as const;

type RedirectExpectation = {
  droppedKeys: readonly string[];
  mode: ExplorerMigrationMode;
  query: Record<string, string>;
  truncated?: boolean;
};

function migrate(pathname: string, query = ""): RecordedWorkspaceMigration {
  return recordedWorkspaceMigration({
    pathname,
    searchParams: new URLSearchParams(query),
  });
}

function redirectView(result: RecordedWorkspaceMigration) {
  if (result.kind !== "redirect") {
    return { kind: result.kind, pathname: result.pathname };
  }
  return {
    compareTruncated: result.compareTruncated,
    droppedKeys: [...result.droppedKeys],
    href: result.href,
    kind: result.kind,
    mode: result.mode,
    pathname: result.pathname,
    query: Object.fromEntries(new URLSearchParams(result.search)),
  };
}

function expectedRedirect(expected: RedirectExpectation) {
  const params = new URLSearchParams();
  for (const key of [
    "scope",
    "county",
    "compare",
    "dataset",
    "period",
    "metric",
    EXPLORER_MODE_PARAM,
    "selection",
  ]) {
    const value = expected.query[key];
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return {
    compareTruncated: expected.truncated ?? false,
    droppedKeys: [...expected.droppedKeys],
    href: search ? `${ATLAS_EXPLORER_PATH}?${search}` : ATLAS_EXPLORER_PATH,
    kind: "redirect" as const,
    mode: expected.mode,
    pathname: ATLAS_EXPLORER_PATH,
    query: expected.query,
  };
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...sourceFiles(fullPath));
      continue;
    }
    if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("six-page workspace route migration", () => {
  it("uses the canonical Explorer, Compare, and Ask Atlas paths", () => {
    expect(WORKSPACE_DESTINATIONS).toStrictEqual([
      { id: "explorer", label: "Atlas Explorer", path: "/explore" },
      { id: "compare", label: "Compare", path: "/compare" },
      { id: "ask-atlas", label: "Ask Atlas", path: "/askatlas" },
      { id: "feed", label: "Feed", path: "/app/feed" },
      {
        id: "data-provenance",
        label: "Data Provenance",
        path: "/data-provenance",
      },
      { id: "settings", label: "Settings", path: "/app/settings" },
      { id: "docs", label: "Docs", path: "/docs" },
    ]);
    expect({
      explorer: ATLAS_EXPLORER_PATH,
      explorerRoute: RESET_ROUTES.find((route) => route.id === "explorer")
        ?.href,
      frontPorch: frontPorchExploreHref(true),
      reviewConstant: RESET_REVIEW_PATH,
    }).toStrictEqual({
      explorer: "/explore",
      explorerRoute: "/explore",
      frontPorch: "/explore",
      reviewConstant: "/app/review",
    });
    expect(
      RESET_ROUTES.filter((route) => route.navGroup !== "alias").map(
        (route) => ({
          label: route.label,
          path: route.href,
        })
      )
    ).toStrictEqual(
      WORKSPACE_DESTINATIONS.map((destination) => ({
        label: destination.label,
        path: destination.path,
      }))
    );
    expect([...UX_RESET_DESTINATION_IDS].sort()).toStrictEqual([
      "action",
      "assistant",
      "compare",
      "explore",
      "feed",
      "investigate",
      "review",
      "settings",
    ]);
  });

  it("installs the reversible redirect from middleware after auth", () => {
    expect(WORKSPACE_MIGRATION_INSTALL).toMatchObject({
      history: "replace",
      redirectsInstalled: true,
      redirectStatus: 308,
    });
    const importers = sourceFiles("src").filter((file) => {
      const source = readFileSync(file, "utf-8");
      return (
        source.includes("recordedWorkspaceMigration") ||
        source.includes("installedWorkspaceRedirect") ||
        source.includes("workspace-route-migration")
      );
    });
    expect(importers.sort()).toStrictEqual(
      [
        "src/features/ux-reset/ask-atlas/page-reference.ts",
        "src/features/ux-reset/workspace-header-title.ts",
        "src/features/ux-reset/workspace-route-migration.ts",
        "src/middleware.ts",
      ].sort()
    );
  });

  it("does not revive retired variant or UX Lab URLs", () => {
    expect(
      RETIRED_VARIANTS.map((variant) => migrate(variant, "county=06037"))
    ).toStrictEqual(
      RETIRED_VARIANTS.map((pathname) => ({
        kind: "retired-not-revived",
        pathname,
      }))
    );
    expect(migrate("/ux-lab/persona")).toStrictEqual({
      kind: "retired-not-revived",
      pathname: "/ux-lab/persona",
    });
    expect(ANALYTICAL_NAVIGATION_PATHS).toStrictEqual([
      "/overview",
      "/geographic_explorer",
      "/investigate",
    ]);
  });

  it("maps the workspace home, Explore, and Investigate onto Explorer", () => {
    expect(redirectView(migrate("/app"))).toStrictEqual(
      expectedRedirect({ droppedKeys: [], mode: "browse", query: {} })
    );
    expect(redirectView(migrate("/app/"))).toStrictEqual(
      expectedRedirect({ droppedKeys: [], mode: "browse", query: {} })
    );
    expect(
      redirectView(migrate("/app/explore", "scope=NY&county=06037"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "browse",
        query: { county: "06037", scope: "NY" },
      })
    );
    expect(
      redirectView(
        migrate(
          "/app/investigate",
          "county=06037&scope=CA&dataset=rel_1&period=2023-01-01&compare=06037,06059&evidence=all"
        )
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["evidence"],
        mode: "evidence",
        query: {
          compare: "06037,06059",
          county: "06037",
          dataset: "rel_1",
          [EXPLORER_MODE_PARAM]: EXPLORER_EVIDENCE_MODE,
          period: "2023-01-01",
          scope: "CA",
        },
      })
    );
  });

  it("maps Action, Overview, Geographic Explorer, and legacy root queries", () => {
    expect(
      redirectView(
        migrate("/app/action", "county=08001&plan=surveillance&role=epi")
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["plan", "role"],
        mode: "follow-up",
        query: {
          county: "08001",
          [EXPLORER_MODE_PARAM]: EXPLORER_FOLLOW_UP_MODE,
        },
      })
    );
    expect(
      redirectView(migrate("/overview", "state=NY&county=06037&smooth=10"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["smooth"],
        mode: "browse",
        query: { county: "06037", scope: "NY" },
      })
    );
    expect(
      redirectView(
        migrate("/geographic_explorer", "county=06037&metric=score&view=maps")
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["metric", "view"],
        mode: "browse",
        query: { county: "06037" },
      })
    );
    expect(redirectView(migrate("/investigate", "county=06037"))).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "evidence",
        query: {
          county: "06037",
          [EXPLORER_MODE_PARAM]: EXPLORER_EVIDENCE_MODE,
        },
      })
    );
    expect(redirectView(migrate("/", "county=06037"))).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "browse",
        query: { county: "06037" },
      })
    );
  });

  it("opens a bare investigation or action link without inventing a county", () => {
    expect(redirectView(migrate("/investigate"))).toStrictEqual(
      expectedRedirect({ droppedKeys: [], mode: "browse", query: {} })
    );
    expect(redirectView(migrate("/app/investigate"))).toStrictEqual(
      expectedRedirect({ droppedKeys: [], mode: "browse", query: {} })
    );
    expect(redirectView(migrate("/app/action"))).toStrictEqual(
      expectedRedirect({ droppedKeys: [], mode: "browse", query: {} })
    );
    expect(
      redirectView(migrate("/app/investigate", "scope=CO&county=nope"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["county"],
        mode: "browse",
        query: { scope: "CO", selection: "required" },
      })
    );
    expect(
      redirectView(migrate("/app/action", "county=08001&county=08013"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["county"],
        mode: "browse",
        query: { selection: "required" },
      })
    );
  });

  it("keeps a single evidence-brief plan on Action", () => {
    expect(
      migrate("/app/action", "county=08001&plan=evidence-brief&role=epi")
    ).toStrictEqual({
      kind: "unchanged",
      pathname: "/app/action",
      reason: "evidence-brief",
    });
    expect(
      migrate("/app/action", "county=08001&plan=%20evidence-brief%20")
    ).toStrictEqual({
      kind: "unchanged",
      pathname: "/app/action",
      reason: "evidence-brief",
    });
    expect(
      redirectView(migrate("/app/action", "county=08001&plan=brief"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["plan"],
        mode: "follow-up",
        query: {
          county: "08001",
          [EXPLORER_MODE_PARAM]: EXPLORER_FOLLOW_UP_MODE,
        },
      })
    );
    expect(
      redirectView(
        migrate("/app/action", "county=08001&plan=evidence-brief&plan=brief")
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["plan"],
        mode: "follow-up",
        query: {
          county: "08001",
          [EXPLORER_MODE_PARAM]: EXPLORER_FOLLOW_UP_MODE,
        },
      })
    );
    expect(
      redirectView(migrate("/app/action", "county=08001&plan=surveillance"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["plan"],
        mode: "follow-up",
        query: {
          county: "08001",
          [EXPLORER_MODE_PARAM]: EXPLORER_FOLLOW_UP_MODE,
        },
      })
    );
  });

  it("drops an Explore measure id and keeps an existing compare pair", () => {
    expect(
      redirectView(
        migrate(
          "/app/explore",
          "metric=reported-cases&map_scope=CA&scope=ALL&selected=06037,06059"
        )
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["map_scope", "metric"],
        mode: "browse",
        query: {
          compare: "06037,06059",
          scope: "ALL",
        },
      })
    );
    expect(redirectView(migrate("/app/explore", "metric=score"))).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["metric"],
        mode: "browse",
        query: {},
      })
    );
    expect(
      redirectView(
        migrate("/app/explore", "compare=06037,06059&selected=06001,06013")
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["selected"],
        mode: "browse",
        query: { compare: "06037,06059" },
      })
    );
  });

  it("prefers Geographic Explorer selected over an inherited compare list", () => {
    expect(
      redirectView(
        migrate(
          "/geographic_explorer",
          "compare=06037,06059&selected=06001,06013"
        )
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["compare"],
        mode: "browse",
        query: { compare: "06001,06013" },
      })
    );
  });

  it("caps a Geographic Explorer selection at two counties", () => {
    expect(
      redirectView(
        migrate(
          "/geographic_explorer",
          "selected=06001,06013,06037,06059,06075"
        )
      )
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "browse",
        query: { compare: "06001,06013" },
        truncated: true,
      })
    );
  });

  it("drops unsupported keys instead of aliasing them", () => {
    const unsupported = WORKSPACE_MIGRATION_UNSUPPORTED_KEYS.map(
      (key) => `${key}=1`
    ).join("&");
    expect(redirectView(migrate("/app", unsupported))).toStrictEqual(
      expectedRedirect({
        droppedKeys: [...WORKSPACE_MIGRATION_UNSUPPORTED_KEYS],
        mode: "browse",
        query: {},
      })
    );
    expect(
      redirectView(migrate("/app/explore", "dataset=bad id&period=2023-02-31"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["dataset", "period"],
        mode: "browse",
        query: {},
      })
    );
    expect(
      redirectView(migrate("/app/investigate", "county=06037&mode=browse"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["mode"],
        mode: "evidence",
        query: {
          county: "06037",
          [EXPLORER_MODE_PARAM]: EXPLORER_EVIDENCE_MODE,
        },
      })
    );
  });

  it("maps legacy state onto scope without replacing an explicit scope", () => {
    expect(
      redirectView(migrate("/overview", "scope=CA&state=NY"))
    ).toStrictEqual(
      expectedRedirect({
        droppedKeys: ["state"],
        mode: "browse",
        query: { scope: "CA" },
      })
    );
    expect(redirectView(migrate("/overview", "state=ny"))).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "browse",
        query: { scope: "ALL" },
      })
    );
    expect(redirectView(migrate("/overview", "state=AK"))).toStrictEqual(
      expectedRedirect({
        droppedKeys: [],
        mode: "browse",
        query: { scope: "AK" },
      })
    );
  });

  it("leaves canonical workspace destinations unchanged", () => {
    expect(migrate("/explore", "county=06037&sort=score&page=2")).toStrictEqual(
      {
        kind: "unchanged",
        pathname: "/explore",
        reason: "canonical-destination",
      }
    );
    expect(migrate("/explore/", "mode=evidence&county=06037")).toStrictEqual({
      kind: "unchanged",
      pathname: "/explore",
      reason: "canonical-destination",
    });
    expect(
      migrate("/compare", "return=investigate&compare=06037,06059")
    ).toStrictEqual({
      kind: "unchanged",
      pathname: "/compare",
      reason: "canonical-destination",
    });
    expect(migrate("/askatlas", "conversation=abc&county=06037")).toStrictEqual(
      {
        kind: "unchanged",
        pathname: "/askatlas",
        reason: "canonical-destination",
      }
    );
    expect(migrate("/docs/what-is-atlas")).toStrictEqual({
      kind: "unchanged",
      pathname: "/docs/what-is-atlas",
      reason: "canonical-destination",
    });
  });

  it("leaves the data provenance page unchanged", () => {
    expect(migrate("/data-provenance")).toStrictEqual({
      kind: "unchanged",
      pathname: "/data-provenance",
      reason: "canonical-destination",
    });
  });

  it("permanently moves the former workspace pages and keeps supported query keys", () => {
    expect(
      redirectView(
        migrate("/app/review", "county=06037&sort=score&page=2&tab=old")
      )
    ).toStrictEqual({
      compareTruncated: false,
      droppedKeys: ["tab"],
      href: "/explore?county=06037&sort=score&page=2",
      kind: "redirect",
      mode: "browse",
      pathname: "/explore",
      query: { county: "06037", page: "2", sort: "score" },
    });
    expect(
      redirectView(migrate("/app/review/", "mode=evidence&county=06037"))
    ).toStrictEqual({
      compareTruncated: false,
      droppedKeys: [],
      href: "/explore?mode=evidence&county=06037",
      kind: "redirect",
      mode: "evidence",
      pathname: "/explore",
      query: { county: "06037", mode: "evidence" },
    });
    expect(
      redirectView(
        migrate(
          "/app/compare",
          "return=investigate&compare=06037,06059&mode=evidence&conversation=abc"
        )
      )
    ).toStrictEqual({
      compareTruncated: false,
      droppedKeys: ["conversation"],
      href: "/compare?return=investigate&compare=06037%2C06059&mode=evidence",
      kind: "redirect",
      mode: null,
      pathname: "/compare",
      query: {
        compare: "06037,06059",
        mode: "evidence",
        return: "investigate",
      },
    });
    expect(
      redirectView(
        migrate("/app/assistant", "conversation=abc&county=06037&sort=score")
      )
    ).toStrictEqual({
      compareTruncated: false,
      droppedKeys: ["sort"],
      href: "/askatlas?conversation=abc&county=06037",
      kind: "redirect",
      mode: null,
      pathname: "/askatlas",
      query: { conversation: "abc", county: "06037" },
    });
  });

  it("keeps Feed, Settings, public Assistant, and the Front Porch", () => {
    expect(migrate("/app/feed")).toStrictEqual({
      kind: "unchanged",
      pathname: "/app/feed",
      reason: "canonical-destination",
    });
    expect(migrate("/app/settings")).toStrictEqual({
      kind: "unchanged",
      pathname: "/app/settings",
      reason: "canonical-destination",
    });
    expect(migrate("/assistant", "conversation=abc")).toStrictEqual({
      kind: "unchanged",
      pathname: "/assistant",
      reason: "existing-public-assistant",
    });
    expect(migrate("/knowledge-graph", "conversation=abc")).toStrictEqual({
      kind: "unchanged",
      pathname: "/knowledge-graph",
      reason: "existing-public-assistant",
    });
    expect(migrate("/")).toStrictEqual({
      kind: "unchanged",
      pathname: "/",
      reason: "front-porch",
    });
  });

  it("does not treat a geographic metric on the Front Porch as an Overview link", () => {
    expect(migrate("/", "metric=score")).toStrictEqual({
      kind: "unchanged",
      pathname: "/",
      reason: "front-porch",
    });
    expect(migrate("/app/ai-responsible-use")).toStrictEqual({
      kind: "unchanged",
      pathname: "/app/ai-responsible-use",
      reason: "out-of-scope",
    });
    expect(migrate("/account")).toStrictEqual({
      kind: "unchanged",
      pathname: "/account",
      reason: "out-of-scope",
    });
    expect(migrate("/privacy")).toStrictEqual({
      kind: "unchanged",
      pathname: "/privacy",
      reason: "out-of-scope",
    });
  });

  it("is a fixed point after one redirect", () => {
    const samples = [
      ["/app/investigate", "county=06037&scope=NY"],
      ["/app/action", "county=08001&plan=surveillance"],
      ["/geographic_explorer", "selected=06001,06013,06037"],
      ["/", "q=lyme"],
      ["/overview", "state=NY"],
    ] as const;
    const landed = samples.map(([pathname, query]) => {
      const first = migrate(pathname, query);
      if (first.kind !== "redirect") {
        return first;
      }
      return migrate(first.pathname, first.search);
    });
    expect(landed).toStrictEqual(
      samples.map(() => ({
        kind: "unchanged",
        pathname: ATLAS_EXPLORER_PATH,
        reason: "canonical-destination",
      }))
    );
  });
});
