import { describe, expect, it } from "vitest";

import { inheritedContextFromCompare } from "@/features/ux-reset/ask-atlas/inherited-context";
import type { AskAtlasInheritedContext } from "@/features/ux-reset/ask-atlas/inherited-context";
import { structuredContextFromInherited } from "@/lib/ask-atlas-structured-context";

function context(
  fields: AskAtlasInheritedContext["fields"]
): AskAtlasInheritedContext {
  return { fields, surface: "explore" };
}

const absent = { state: "absent" } as const;

describe("structured context from inherited page context", () => {
  it("copies a county FIPS, measure id, and four-digit year", () => {
    expect(
      structuredContextFromInherited(
        context({
          geography: {
            id: "36027",
            label: "Dutchess County, New York (36027)",
            state: "validated",
          },
          measure: {
            id: "case_count_floor_2023",
            label: "2023 Lyme case count floor",
            state: "validated",
          },
          period: { id: "2023", label: "2023", state: "validated" },
          release: absent,
          source: absent,
        })
      )
    ).toStrictEqual({
      geography_ids: ["36027"],
      geography_type: "county",
      measure_id: "case_count_floor_2023",
      year: 2023,
    });
  });

  it("copies a compare pair and does not turn a start date into a year", () => {
    const compare = inheritedContextFromCompare({
      alignment: null,
      alignmentReady: true,
      counties: [
        { fips: "36027", label: "Dutchess County, New York" },
        { fips: "09001", label: "Fairfield County, Connecticut" },
      ],
      releaseId: "release-1",
    });
    const withDate = compare && {
      ...compare,
      fields: {
        ...compare.fields,
        measure: {
          id: "case_count_floor_2023",
          label: "2023 Lyme case count floor",
          state: "validated" as const,
        },
        period: {
          id: "2023-01-01",
          label: "2023-01-01",
          state: "validated" as const,
        },
      },
    };
    expect(structuredContextFromInherited(withDate)).toStrictEqual({
      geography_ids: ["36027", "09001"],
      geography_type: "county",
      measure_id: "case_count_floor_2023",
    });
  });

  it("omits context when no structured field is validated", () => {
    expect(
      structuredContextFromInherited(
        context({
          geography: absent,
          measure: absent,
          period: absent,
          release: { id: "release-1", label: "release-1", state: "validated" },
          source: { id: "human", label: "Human", state: "validated" },
        })
      )
    ).toBeUndefined();
  });
});
