import { describe, expect, it } from "vitest";

import { OFFICIAL_FOLLOW_UP_RESOURCES } from "@/lib/follow-up-workflows";

describe("official follow-up resources", () => {
  it("keeps a small set of approved surveillance and Atlas references", () => {
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.map((resource) => resource.label)
    ).toStrictEqual([
      "Lyme surveillance case definition",
      "County case data and residence-versus-exposure limitations",
      "Tick and pathogen record definitions and limitations",
      "Blacklegged tick surveillance guidance",
      "Clinical testing guidance",
      "CDC Lyme disease prevention",
      "Sources and canonical evidence",
      "Releases and methodology",
    ]);
    expect(
      OFFICIAL_FOLLOW_UP_RESOURCES.every((resource) =>
        resource.external
          ? resource.href.startsWith("https://")
          : resource.href.startsWith("/docs/")
      )
    ).toBeTruthy();
  });
});
