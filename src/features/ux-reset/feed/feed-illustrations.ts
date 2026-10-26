/**
 * Decorative illustrations for Research & News. Topic art is chosen only from
 * explicit tag text. Titles, publishers, and source families are not interpreted.
 * Unknown or missing tags use a fixed cycle of six distinct illustrations,
 * one per card position, so the opening grid does not repeat a picture.
 */

export const FEED_FEATURE_ILLUSTRATION = {
  height: 720,
  src: "/research-news/c-forest-lake-feature.webp",
  width: 1280,
} as const;

const CARD_WIDTH = 640;
const CARD_HEIGHT = 360;

export type FeedCardIllustration = {
  height: number;
  id: FeedIllustrationId;
  src: string;
  width: number;
};

type FeedIllustrationId =
  | "deer"
  | "forest-lake"
  | "forest-path"
  | "laboratory"
  | "meadow"
  | "pathogen"
  | "sampling"
  | "tick"
  | "woodland-trail"
  | "woodland-wetland";

const CARD_ILLUSTRATIONS: Record<
  FeedIllustrationId,
  { height: number; src: string; width: number }
> = {
  deer: {
    height: CARD_HEIGHT,
    src: "/research-news/c-deer.webp",
    width: CARD_WIDTH,
  },
  "forest-lake": {
    height: 720,
    src: "/research-news/c-forest-lake-feature.webp",
    width: 1280,
  },
  "forest-path": {
    height: CARD_HEIGHT,
    src: "/research-news/a-forest-path.webp",
    width: CARD_WIDTH,
  },
  laboratory: {
    height: CARD_HEIGHT,
    src: "/research-news/a-laboratory-pipettes.webp",
    width: CARD_WIDTH,
  },
  meadow: {
    height: CARD_HEIGHT,
    src: "/research-news/a-meadow.webp",
    width: CARD_WIDTH,
  },
  pathogen: {
    height: CARD_HEIGHT,
    src: "/research-news/c-pathogen-illustration.webp",
    width: CARD_WIDTH,
  },
  sampling: {
    height: CARD_HEIGHT,
    src: "/research-news/a-tick-drag-sampling.webp",
    width: CARD_WIDTH,
  },
  tick: {
    height: CARD_HEIGHT,
    src: "/research-news/c-tick-on-leaf.webp",
    width: CARD_WIDTH,
  },
  "woodland-trail": {
    height: CARD_HEIGHT,
    src: "/research-news/c-woodland-trail.webp",
    width: CARD_WIDTH,
  },
  "woodland-wetland": {
    height: CARD_HEIGHT,
    src: "/research-news/a-woodland-wetland.webp",
    width: CARD_WIDTH,
  },
};

/** Opening grid: six different pictures, then the same cycle. */
const PLACEHOLDER_ILLUSTRATIONS = [
  "tick",
  "sampling",
  "laboratory",
  "deer",
  "meadow",
  "forest-lake",
] as const satisfies readonly FeedIllustrationId[];

const TOPIC_RULES: readonly {
  id: FeedIllustrationId;
  pattern: RegExp;
}[] = [
  {
    id: "pathogen",
    pattern:
      /\b(?:pathogen|pathogens|borrelia|anaplasma|babesia|babesiosis|powassan|rickettsia|ehrlichia|bacteri(?:um|a)|virus|viral)\b/i,
  },
  {
    id: "deer",
    pattern: /\b(?:deer|white-tailed|whitetail|wildlife|reservoir)\b/i,
  },
  {
    id: "sampling",
    pattern:
      /\b(?:surveillance|sampling|flagging|vector|ecology)\b|tick drag|drag cloth/i,
  },
  {
    id: "tick",
    pattern: /\b(?:ticks?|ixodes|lyme|blacklegged|scapularis)\b/i,
  },
  {
    id: "laboratory",
    pattern: /\b(?:laborator(?:y|ies)|pipettes?|assays?|pcr|research)\b/i,
  },
];

function illustration(id: FeedIllustrationId): FeedCardIllustration {
  return { id, ...CARD_ILLUSTRATIONS[id] };
}

function placeholderIllustrationIndex(slot: number): number {
  const count = PLACEHOLDER_ILLUSTRATIONS.length;
  const index = slot % count;
  return index < 0 ? index + count : index;
}

export function feedCardIllustration(
  entry: {
    item_id: string;
    tags: readonly string[];
  },
  slot = 0
): FeedCardIllustration {
  const tags = entry.tags.join(" \n ");
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(tags)) {
      return illustration(rule.id);
    }
  }
  const placeholder =
    PLACEHOLDER_ILLUSTRATIONS[placeholderIllustrationIndex(slot)] ?? "meadow";
  return illustration(placeholder);
}
