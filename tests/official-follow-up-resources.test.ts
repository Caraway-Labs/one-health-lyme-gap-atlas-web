import { describe, expect, it } from "vitest";

import {
  OFFICIAL_FOLLOW_UP_RESOURCES,
  STATE_PROGRAM_EXAMPLES_NOTE,
} from "@/lib/follow-up-workflows";

describe("official follow-up resources", () => {
  it("keeps one destination per link and the approved group order", () => {
    const hrefs = OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => resource.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => resource.category)
    ).toStrictEqual([
      "Human disease surveillance",
      "Human disease surveillance",
      "Human disease surveillance",
      "Tick and pathogen surveillance",
      "Tick and pathogen surveillance",
      "Tick and pathogen surveillance",
      "Clinical and laboratory testing",
      "Prevention and outreach",
      "Prevention and outreach",
      "Prevention and outreach",
      "Community context",
      "Examples from state programs",
      "Examples from state programs",
      "Examples from state programs",
      "Examples from state programs",
    ]);
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => resource.href)
    ).toStrictEqual([
      "https://ndc.services.cdc.gov/case-definitions/lyme-disease-2022/",
      "https://www.cdc.gov/ticks/data-research/facts-stats/geographic-distribution-of-tickborne-disease-cases.html",
      "https://www.cdc.gov/mmwr/volumes/73/wr/mm7306a1.htm",
      "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html",
      "https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf",
      "https://www.cdc.gov/ticks/resources/TickSurveillance_Ipacificus-P.pdf",
      "https://www.cdc.gov/lyme/hcp/diagnosis-testing/index.html",
      "https://www.cdc.gov/lyme/prevention/index.html",
      "https://www.cdc.gov/lyme/communication-resources/index.html",
      "https://www.cdc.gov/ticks/communication-resources/index.html",
      "https://www.atsdr.cdc.gov/place-health/php/svi/svi-frequently-asked-questions-faqs.html",
      "https://www.dhs.wisconsin.gov/tick/lyme-reporting-surveillance.htm",
      "https://www.health.state.mn.us/diseases/tickborne/monitoring.html",
      "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/LymeDisease.aspx",
      "https://www.health.ny.gov/diseases/communicable/lyme/",
    ]);
    expect(STATE_PROGRAM_EXAMPLES_NOTE).toContain("your own state’s");
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.every(
        (resource) => resource.external && resource.description.includes(".")
      )
    ).toBeTruthy();
  });
});
