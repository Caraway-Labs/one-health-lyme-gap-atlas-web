import { describe, expect, it } from "vitest";

import {
  FEED_ILLUSTRATIONS,
  feedIllustrationAt,
} from "@/features/ux-reset/feed/feed-illustrations";

describe("research news illustrations", () => {
  it("keeps one entry for each distinct picture", () => {
    const ids = FEED_ILLUSTRATIONS.map((image) => image.id);
    const sources = FEED_ILLUSTRATIONS.map((image) => image.src);
    expect(new Set(ids).size).toBe(FEED_ILLUSTRATIONS.length);
    expect(new Set(sources).size).toBe(FEED_ILLUSTRATIONS.length);
    expect(FEED_ILLUSTRATIONS).toHaveLength(25);
    expect(FEED_ILLUSTRATIONS[0]?.id).toBe("forest-lake");
  });

  it("uses every picture once before repeating, including the feature", () => {
    const firstCycle = Array.from(
      { length: FEED_ILLUSTRATIONS.length },
      (_, position) => feedIllustrationAt(position).src
    );
    expect(new Set(firstCycle).size).toBe(FEED_ILLUSTRATIONS.length);
    expect(feedIllustrationAt(FEED_ILLUSTRATIONS.length).src).toBe(
      feedIllustrationAt(0).src
    );
    expect(feedIllustrationAt(1).src).not.toBe(feedIllustrationAt(0).src);
  });

  it("keeps the same picture for a position when later positions are added", () => {
    const before = Array.from(
      { length: 10 },
      (_, position) => feedIllustrationAt(position).id
    );
    const after = Array.from(
      { length: 30 },
      (_, position) => feedIllustrationAt(position).id
    );
    expect(after.slice(0, 10)).toStrictEqual(before);
    expect(feedIllustrationAt(4)).toStrictEqual(feedIllustrationAt(4));
  });
});
