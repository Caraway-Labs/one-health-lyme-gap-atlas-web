/**
 * Decorative illustrations for Research & News. Topic art is chosen only from
 * explicit tag text. Titles, publishers, and source families are not interpreted.
 * Unknown or missing tags use a stable woodland or meadow image.
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

const NEUTRAL_ILLUSTRATIONS = [
  "woodland-wetland",
  "forest-path",
  "meadow",
  "woodland-trail",
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

/** The same item id always selects the same neutral image. */
function neutralIllustrationIndex(itemId: string): number {
  let hash = 0;
  for (const char of itemId) {
    hash = (hash + (char.codePointAt(0) ?? 0)) % 997;
  }
  return hash % NEUTRAL_ILLUSTRATIONS.length;
}

export function feedCardIllustration(entry: {
  item_id: string;
  tags: readonly string[];
}): FeedCardIllustration {
  const tags = entry.tags.join(" \n ");
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(tags)) {
      return illustration(rule.id);
    }
  }
  const neutral =
    NEUTRAL_ILLUSTRATIONS[neutralIllustrationIndex(entry.item_id)] ??
    "woodland-wetland";
  return illustration(neutral);
}
