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

  it("uses a stable woodland image when tags do not name a topic", () => {
    const first = feedCardIllustration({
      item_id: "item-without-topics",
      tags: [],
    });
    const again = feedCardIllustration({
      item_id: "item-without-topics",
      tags: ["Weekly report"],
    });
    expect(first).toStrictEqual(again);
    expect([
      "woodland-wetland",
      "forest-path",
      "meadow",
      "woodland-trail",
    ]).toContain(first.id);
    expect(first.src.endsWith(".webp")).toBeTruthy();
  });
});
