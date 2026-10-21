import { describe, expect, it } from "vitest";

import { OFFICIAL_FOLLOW_UP_RESOURCES } from "@/lib/follow-up-workflows";

describe("official follow-up resources", () => {
  it("keeps the approved Explorer resources in topic order", () => {
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => ({
        category: resource.category,
        description: resource.description,
        external: resource.external,
        href: resource.href,
        label: resource.label,
      }))
    ).toStrictEqual([
      {
        category: "Lyme disease surveillance",
        description: "Reporting criteria for Lyme disease.",
        external: true,
        href: "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
        label: "Lyme surveillance case definition",
      },
      {
        category: "Lyme disease surveillance",
        description: "How residence and exposure affect county counts.",
        external: true,
        href: "https://www.cdc.gov/ticks/data-research/facts-stats/geographic-distribution-of-tickborne-disease-cases.html",
        label: "County case data and limitations",
      },
      {
        category: "Tick and vector surveillance",
        description: "How to interpret published records.",
        external: true,
        href: "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
        label: "Tick and pathogen record definitions",
      },
      {
        category: "Tick and vector surveillance",
        description: "CDC guidance for surveillance and interpretation.",
        external: true,
        href: "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
        label: "Blacklegged tick surveillance guidance",
      },
      {
        category: "Clinical testing and reporting",
        description: "CDC guidance on laboratory diagnosis.",
        external: true,
        href: "https://www.cdc.gov/lyme/hcp/diagnosis-testing/index.html",
        label: "Clinical testing guidance",
      },
    ]);
  });
});
