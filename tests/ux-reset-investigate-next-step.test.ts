import { describe, expect, it } from "vitest";

import {
  investigateCompareOffer,
  investigateContinueDestination,
  investigateCountyReportExportOffer,
} from "@/features/ux-reset/investigate/investigate-next-step";

describe("Investigate continue destination", () => {
  it("offers no Action path when the compare pair is incomplete", () => {
    expect({
      duplicate: investigateContinueDestination({
        compare: ["08001", "08001"],
      }),
      empty: investigateContinueDestination({ compare: [] }),
      single: investigateContinueDestination({ compare: ["08001"] }),
    }).toStrictEqual({
      duplicate: null,
      empty: null,
      single: null,
    });
  });

  it("returns to Compare when the link already has two validated counties", () => {
    expect(
      investigateContinueDestination({ compare: ["08001", "08013"] })
    ).toBe("compare");
  });

  it("offers Compare for the open county without choosing a second", () => {
    expect({
      duplicateName: investigateCompareOffer({
        compare: [],
        county: "27163",
      }),
      empty: investigateCompareOffer({ compare: [], county: null }),
      invalid: investigateCompareOffer({ compare: [], county: "nope" }),
      otherPair: investigateCompareOffer({
        compare: ["08001"],
        county: "36001",
      }),
      pair: investigateCompareOffer({
        compare: ["08001", "08013"],
        county: "08001",
      }),
      sameName: investigateCompareOffer({
        compare: [],
        county: "44009",
      }),
    }).toStrictEqual({
      duplicateName: { kind: "start", label: "Compare" },
      empty: null,
      invalid: null,
      otherPair: { kind: "start", label: "Compare" },
      pair: { kind: "return", label: "Return to Compare" },
      sameName: { kind: "start", label: "Compare" },
    });
  });
});

describe("Investigate county report offer", () => {
  it("withholds export when the report cannot show the period and caveat", () => {
    const offer = investigateCountyReportExportOffer({
      caveats: ["Surveillance sites do not represent the whole county."],
      countyFips: "08001",
      periods: ["2023"],
      releaseId: "alpha-2026",
      requestedPeriod: "2023-01-01",
      sources: ["Tick survey"],
    });
    expect({
      caveat: offer.reason.includes(
        "Surveillance sites do not represent the whole county."
      ),
      period: offer.reason.includes("2023-01-01"),
      source: offer.reason.includes("Tick survey"),
      state: offer.state,
    }).toStrictEqual({
      caveat: true,
      period: true,
      source: true,
      state: "unavailable",
    });
  });
});
