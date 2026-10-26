import { describe, expect, it } from "vitest";

import { feedCardIllustration } from "@/features/ux-reset/feed/feed-illustrations";

describe("research news illustrations", () => {
  it("maps explicit tags and ignores the title", () => {
    expect(
      feedCardIllustration({
        item_id: "a",
        tags: ["Borrelia burgdorferi"],
      }).id
    ).toBe("pathogen");
    expect(
      feedCardIllustration({
        item_id: "a",
        tags: ["White-tailed deer density"],
      }).id
    ).toBe("deer");
    expect(
      feedCardIllustration({
        item_id: "a",
        tags: ["Tick surveillance"],
      }).id
    ).toBe("sampling");
    expect(
      feedCardIllustration({
        item_id: "a",
        tags: ["Ixodes scapularis"],
      }).id
    ).toBe("tick");
    expect(
      feedCardIllustration({
        item_id: "a",
        tags: ["Laboratory assay"],
      }).id
    ).toBe("laboratory");
  });

  it("gives the first six untagged cards six different pictures", () => {
    const ids = Array.from(
      { length: 6 },
      (_, slot) =>
        feedCardIllustration(
          { item_id: `item-${slot}`, tags: ["Weekly report"] },
          slot
        ).id
    );
    expect(new Set(ids).size).toBe(6);
    expect(
      feedCardIllustration({ item_id: "item-0", tags: [] }, 0)
    ).toStrictEqual(
      feedCardIllustration({ item_id: "item-0", tags: ["Weekly report"] }, 0)
    );
  });
});
