/**
 * Decorative illustrations for Research & News.
 *
 * Pictures are assigned by display position, not by article text. The featured
 * article uses the first picture. Grid cards continue through the pool, so
 * that picture is not shown again until every other picture has been used.
 * Loading another page appends positions; it does not restart the sequence.
 */

const CARD_WIDTH = 640;
const CARD_HEIGHT = 360;

export type FeedIllustration = {
  height: number;
  id: string;
  src: string;
  width: number;
};

function card(id: string, file: string): FeedIllustration {
  return {
    height: CARD_HEIGHT,
    id,
    src: `/research-news/${file}.webp`,
    width: CARD_WIDTH,
  };
}

/**
 * One entry per source picture. The forest-lake file is the larger feature
 * crop of that same picture, not a second illustration.
 */
export const FEED_ILLUSTRATIONS = [
  {
    height: 720,
    id: "forest-lake",
    src: "/research-news/c-forest-lake-feature.webp",
    width: 1280,
  },
  card("tick", "c-tick-on-leaf"),
  card("sampling", "a-tick-drag-sampling"),
  card("laboratory", "a-laboratory-pipettes"),
  card("deer", "c-deer"),
  card("meadow", "a-meadow"),
  card("forest-path", "a-forest-path"),
  card("woodland-trail", "c-woodland-trail"),
  card("woodland-wetland", "a-woodland-wetland"),
  card("pathogen", "c-pathogen-illustration"),
  card("habitat-autumn-leaves", "habitat-autumn-leaves"),
  card("habitat-shrub-trail", "habitat-shrub-trail"),
  card("habitat-stone-wall", "habitat-stone-wall"),
  card("habitat-woodland-edge", "habitat-woodland-edge"),
  card("host-chipmunk", "host-chipmunk"),
  card("host-deer-and-fawn", "host-deer-and-fawn"),
  card("host-robin", "host-robin"),
  card("host-squirrel", "host-squirrel"),
  card("host-white-footed-mouse", "host-white-footed-mouse"),
  card("laboratory-microscope", "laboratory-microscope"),
  card("laboratory-tick-specimen-vial", "laboratory-tick-specimen-vial"),
  card("surveillance-cloth-inspection", "surveillance-cloth-inspection"),
  card("tick-grass-tip", "tick-grass-tip"),
  card("tick-leaf-litter", "tick-leaf-litter"),
  card("tick-on-fern", "tick-on-fern"),
] as const satisfies readonly FeedIllustration[];

export const FEED_FEATURE_ILLUSTRATION = FEED_ILLUSTRATIONS[0];

export function feedIllustrationAt(position: number): FeedIllustration {
  const count = FEED_ILLUSTRATIONS.length;
  const index = position % count;
  return FEED_ILLUSTRATIONS[index < 0 ? index + count : index];
}
