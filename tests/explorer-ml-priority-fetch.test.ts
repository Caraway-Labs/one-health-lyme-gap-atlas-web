import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  EXPLORER_ML_PRIORITY_FETCH_LIMIT,
  EXPLORER_ML_PRIORITY_PAGE_SIZE,
  explorerMlListedFips,
  explorerMlPriorityFetchTargets,
} from "@/features/ux-reset/review/use-explorer-county-ml-priorities";

import { tier1LowInsufficientFixture } from "./fixtures/tier1-surveillance-priority";

const releaseId = tier1LowInsufficientFixture.release_id;

function countyFips(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    String(48_001 + index).padStart(5, "0")
  );
}

describe("Explorer ML priority fetch window", () => {
  it("lists one directory page instead of the whole state", () => {
    const directory = countyFips(254);
    expect(
      explorerMlListedFips({
        candidateFips: [],
        directoryFips: directory,
        selectedFips: null,
        shownDirectoryCount: EXPLORER_ML_PRIORITY_PAGE_SIZE,
      })
    ).toHaveLength(EXPLORER_ML_PRIORITY_PAGE_SIZE);
    expect(
      explorerMlListedFips({
        candidateFips: [],
        directoryFips: directory,
        selectedFips: directory[200] ?? null,
        shownDirectoryCount: EXPLORER_ML_PRIORITY_PAGE_SIZE,
      })
    ).toStrictEqual([directory[200], ...directory.slice(0, 20)]);
  });

  it("keeps a short candidate list ahead of the directory", () => {
    expect(
      explorerMlListedFips({
        candidateFips: ["08013", "08001"],
        directoryFips: countyFips(254),
        selectedFips: "08001",
        shownDirectoryCount: EXPLORER_ML_PRIORITY_PAGE_SIZE,
      })
    ).toStrictEqual(["08001", "08013"]);
  });

  it("starts only a few lower-48 requests and skips settled rows", () => {
    const directory = ["02013", ...countyFips(30)];
    const client = new QueryClient();
    const first = explorerMlPriorityFetchTargets(directory, client, releaseId);
    expect(first.size).toBe(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
    expect(first.has("02013")).toBeFalsy();
    const settled = directory[1];
    if (!settled) {
      throw new TypeError("Directory must include a Texas county.");
    }
    client.setQueryData(
      ["ux-reset-tier1-surveillance-priority", settled, releaseId],
      tier1LowInsufficientFixture
    );
    const next = explorerMlPriorityFetchTargets(directory, client, releaseId);
    expect(next.has(settled)).toBeFalsy();
    expect(next.has("02013")).toBeFalsy();
    expect(next.size).toBe(EXPLORER_ML_PRIORITY_FETCH_LIMIT);
  });
});
