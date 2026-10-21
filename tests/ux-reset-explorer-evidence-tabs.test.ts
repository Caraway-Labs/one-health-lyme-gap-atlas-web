import { describe, expect, it } from "vitest";

import {
  EXPLORER_EVIDENCE_TABS,
  defaultExplorerEvidenceTab,
  explorerHashTargetId,
  explorerTabForHash,
  explorerTabForSectionId,
  parseExplorerEvidenceTab,
} from "@/features/ux-reset/review/explorer-evidence-tabs";
import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_SECTION_IDS,
} from "@/features/ux-reset/review/explorer-mode";

describe("explorer evidence tabs", () => {
  it("opens Evidence for mode=evidence and Follow-up for mode=follow-up", () => {
    expect(defaultExplorerEvidenceTab(EXPLORER_EVIDENCE_MODE)).toBe("evidence");
    expect(defaultExplorerEvidenceTab(EXPLORER_FOLLOW_UP_MODE)).toBe(
      "follow-up"
    );
  });

  it("assigns every governed section id to exactly one known tab", () => {
    const mapped = Object.values(EXPLORER_SECTION_IDS).map((id) => [
      id,
      explorerTabForSectionId(id),
    ]);
    expect(mapped).toStrictEqual([
      ["explorer-context", "context"],
      ["explorer-environmental-context", "context"],
      ["explorer-evidence", "evidence"],
      ["explorer-follow-up", "follow-up"],
      ["explorer-population-rurality", "context"],
      ["explorer-sources", "sources"],
      ["explorer-summary", "overview"],
    ]);
    for (const [, tab] of mapped) {
      expect(EXPLORER_EVIDENCE_TABS).toContain(tab);
    }
  });

  it("parses only known tab values", () => {
    expect(parseExplorerEvidenceTab("sources")).toBe("sources");
    expect(parseExplorerEvidenceTab("nope")).toBeNull();
    expect(parseExplorerEvidenceTab(null)).toBeNull();
  });

  it("reads a hash target id and tolerates malformed escapes", () => {
    expect(explorerHashTargetId("")).toBeNull();
    expect(explorerHashTargetId("#")).toBeNull();
    expect(explorerHashTargetId("#a%20b")).toBe("a b");
    expect(explorerHashTargetId("#%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("maps a nested target to the tab panel that contains it", () => {
    document.body.innerHTML = `
      <div data-explorer-tab="evidence"><p id="investigate-observation-obs:1">x</p></div>
      <div data-explorer-tab="context"><p id="investigate-unassigned">y</p></div>
      <p id="outside">z</p>`;
    expect(explorerTabForHash("#investigate-observation-obs:1", document)).toBe(
      "evidence"
    );
    expect(explorerTabForHash("#investigate-unassigned", document)).toBe(
      "context"
    );
    expect(explorerTabForHash("#outside", document)).toBeNull();
    expect(explorerTabForHash("#missing", document)).toBeNull();
    expect(explorerTabForHash("#explorer-sources", document)).toBe("sources");
    document.body.innerHTML = "";
  });
});
