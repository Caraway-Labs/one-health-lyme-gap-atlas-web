import { describe, expect, it } from "vitest";

import {
  buildCompareEntryHref,
  compareEntryPair,
  compareReturnLabel,
  parseCompareReturnTarget,
} from "@/features/ux-reset/compare/compare-entry";
import {
  mergeCompareQueryValues,
  serializeCompareFipsList,
} from "@/features/ux-reset/context-params";
import {
  RESET_COMPARE_PATH,
  RESET_INVESTIGATE_PATH,
  RESET_REVIEW_PATH,
} from "@/features/ux-reset/routes";

function entryHref(input: {
  compare?: string;
  county?: string | null;
  returnTo?: "review" | "investigate" | null;
  sourcePath?: string;
}) {
  const params = new URLSearchParams();
  if (input.compare) {
    params.set("compare", input.compare);
  }
  if (input.county) {
    params.set("county", input.county);
  }
  params.set("scope", "CO");
  params.set("dataset", "alpha-2026");
  return buildCompareEntryHref({
    county: input.county ?? null,
    dataset: "alpha-2026",
    period: null,
    returnTo: input.returnTo ?? null,
    scope: "CO",
    sourcePath: input.sourcePath ?? RESET_REVIEW_PATH,
    sourceSearchParams: params,
  });
}

describe("canonical Compare entry", () => {
  it("preserves one county and does not choose a second", () => {
    const pair = compareEntryPair({ compare: [], county: "08001" });
    const url = new URL(
      entryHref({ county: "08001", returnTo: "review" }),
      "http://localhost"
    );
    expect({
      compare: url.searchParams.get("compare"),
      compareValues: url.searchParams.getAll("compare"),
      pair,
      path: url.pathname,
      returnTo: url.searchParams.get("return"),
      shared: mergeCompareQueryValues(["08001"]),
    }).toStrictEqual({
      compare: serializeCompareFipsList(["08001"]),
      compareValues: ["08001"],
      pair: ["08001"],
      path: RESET_COMPARE_PATH,
      returnTo: "review",
      shared: ["08001"],
    });
  });

  it("keeps a validated pair and does not append the selected county", () => {
    const url = new URL(
      entryHref({
        compare: "08001,08013",
        county: "36001",
        returnTo: "investigate",
        sourcePath: RESET_INVESTIGATE_PATH,
      }),
      "http://localhost"
    );
    expect({
      full: compareEntryPair({ compare: ["08001", "08013"], county: "36001" }),
      kept: url.searchParams.get("compare"),
      partial: compareEntryPair({ compare: ["08001"], county: "36001" }),
      returnTo: url.searchParams.get("return"),
      selected: url.searchParams.get("county"),
    }).toStrictEqual({
      full: ["08001", "08013"],
      kept: "08001,08013",
      partial: ["08001"],
      returnTo: "investigate",
      selected: "36001",
    });
  });

  it("drops invalid and repeated identifiers through the shared parser", () => {
    expect(
      compareEntryPair({ compare: ["08001", "08001", "nope"], county: "36001" })
    ).toStrictEqual(mergeCompareQueryValues(["08001,08001,nope"]));
    expect(
      compareEntryPair({ compare: ["not-a-fips"], county: "08001" })
    ).toStrictEqual(["08001"]);
    expect(compareEntryPair({ compare: [], county: "nope" })).toStrictEqual([]);
    const href = entryHref({ compare: "08001,08001,36001", county: "08001" });
    expect(new URL(href, "http://localhost").searchParams.get("compare")).toBe(
      "08001,36001"
    );
  });

  it("keeps same-named counties distinct by FIPS", () => {
    const rhodeIsland = entryHref({ county: "44009", returnTo: "review" });
    const minnesota = entryHref({ county: "27163", returnTo: "review" });
    expect(
      new URL(rhodeIsland, "http://localhost").searchParams.get("compare")
    ).toBe("44009");
    expect(
      new URL(minnesota, "http://localhost").searchParams.get("compare")
    ).toBe("27163");
  });

  it("omits return on a direct entry and ignores unknown targets", () => {
    const href = entryHref({ compare: "08001,08013", county: "08001" });
    expect({
      assistant: parseCompareReturnTarget("assistant"),
      directReturn: new URL(href, "http://localhost").searchParams.has(
        "return"
      ),
      empty: parseCompareReturnTarget(null),
      investigate: parseCompareReturnTarget("investigate"),
      investigateLabel: compareReturnLabel("investigate"),
      review: parseCompareReturnTarget("review"),
      reviewLabel: compareReturnLabel("review"),
    }).toStrictEqual({
      assistant: null,
      directReturn: false,
      empty: null,
      investigate: "investigate",
      investigateLabel: "Return to Investigate",
      review: "review",
      reviewLabel: "Return to Review",
    });
  });
});
