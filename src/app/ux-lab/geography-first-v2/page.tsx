import type { Metadata } from "next";

import {
  GeographyFirstV2Experience,
  GeographyFirstV2Missing,
  GeographyFirstV2NonGeographicPaths,
} from "@/features/ux-lab/geography-first-v2/geography-first-v2-experience";
import { GeographyFirstV2Picker } from "@/features/ux-lab/geography-first-v2/geography-first-v2-picker";
import {
  geographyFirstV2PlaceParam,
  resolveGeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";

import "@/features/ux-lab/geography-first-v2/geography-first-v2.css";

export const metadata: Metadata = {
  description:
    "Geography-First v2 product-research prototype. Place-led local entry with explicit evidence boundaries and non-geographic education paths.",
  robots: { follow: false, index: false },
  title: "Geography-First v2",
};

export async function GeographyFirstV2Page({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  const selection = resolveGeographyFirstV2Place(
    geographyFirstV2PlaceParam(params.place)
  );

  return (
    <main className="geography-first-v2">
      <header className="geography-first-v2-intro">
        <p className="eyebrow">Product research · round 2</p>
        <p className="type-section">Start with where you are</p>
        <p className="type-body">
          Search or choose a fictional place to open a local summary.
          Surveillance context stays separate from personal medical risk, and
          education for people already affected by Lyme stays reachable without
          a map.
        </p>
      </header>
      <GeographyFirstV2NonGeographicPaths />
      {selection.status === "missing" ? (
        <GeographyFirstV2Missing requestedId={selection.requestedId} />
      ) : (
        <div className="geography-first-v2-layout">
          <GeographyFirstV2Picker activePlaceId={selection.place.id} />
          <GeographyFirstV2Experience place={selection.place} />
        </div>
      )}
    </main>
  );
}

export default GeographyFirstV2Page;
