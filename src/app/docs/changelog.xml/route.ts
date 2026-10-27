import { loadApiChangelog, renderAtomFeed } from "@/lib/api-changelog";
import { getSiteOrigin } from "@/lib/public-origins";

/** Atom feed of the pinned API changelog. Entries link to operations. */
export function GET(): Response {
  const xml = renderAtomFeed(loadApiChangelog(), getSiteOrigin());
  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/atom+xml; charset=utf-8",
    },
  });
}
