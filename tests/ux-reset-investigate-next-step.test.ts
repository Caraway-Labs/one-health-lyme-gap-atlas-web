import { describe, expect, it } from "vitest";

import {
  investigateActionOffer,
  investigateCompareOffer,
  investigateContinueDestination,
  investigateCountyReportExportOffer,
} from "@/features/ux-reset/investigate/investigate-next-step";

describe("Investigate continue destination", () => {
  it("does not treat an incomplete compare list as a compare return", () => {
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

  it("offers Action only after a county evidence bundle exists", () => {
    expect({
      empty: investigateActionOffer({ bundle: null }),
      loaded: investigateActionOffer({
        bundle: {
          county: { fips: "08001", label: "Denver", stateCode: "CO" },
          releaseId: "alpha-2026",
        },
      }),
      missingRelease: investigateActionOffer({
        bundle: {
          county: { fips: "08001", label: "Denver", stateCode: "CO" },
          releaseId: "",
        },
      }),
    }).toStrictEqual({
      empty: null,
      loaded: { label: "Continue to Action" },
      missingRelease: null,
    });
  });

  it("offers Compare for a resolved county without choosing a second", () => {
    expect({
      duplicateName: investigateCompareOffer({
        compare: [],
        resolvedCounty: "27163",
      }),
      empty: investigateCompareOffer({ compare: [], resolvedCounty: null }),
      invalid: investigateCompareOffer({
        compare: [],
        resolvedCounty: "nope",
      }),
      otherPair: investigateCompareOffer({
        compare: ["08001"],
        resolvedCounty: "36001",
      }),
      pair: investigateCompareOffer({
        compare: ["08001", "08013"],
        resolvedCounty: "08001",
      }),
      pairWithoutCounty: investigateCompareOffer({
        compare: ["08001", "08013"],
        resolvedCounty: null,
      }),
      sameName: investigateCompareOffer({
        compare: [],
        resolvedCounty: "44009",
      }),
      singletonUnresolved: investigateCompareOffer({
        compare: ["08001"],
        resolvedCounty: null,
      }),
    }).toStrictEqual({
      duplicateName: { kind: "start", label: "Compare" },
      empty: null,
      invalid: null,
      otherPair: { kind: "start", label: "Compare" },
      pair: { kind: "return", label: "Return to Compare" },
      pairWithoutCounty: { kind: "return", label: "Return to Compare" },
      sameName: { kind: "start", label: "Compare" },
      singletonUnresolved: null,
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
