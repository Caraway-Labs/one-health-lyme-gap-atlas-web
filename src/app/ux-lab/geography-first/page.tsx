import type { Metadata } from "next";

import {
  GeographyFirstExperience,
  GeographyFirstMissing,
} from "@/features/ux-lab/geography-first/geography-first-experience";
import { GeographyFirstPicker } from "@/features/ux-lab/geography-first/geography-first-picker";
import {
  geographyFirstPlaceParam,
  resolveGeographyFirstPlace,
} from "@/features/ux-lab/geography-first/sample-places";

import "@/features/ux-lab/geography-first/geography-first.css";

export const metadata: Metadata = {
  description:
    "Geography-first product-research prototype. A fictional place organizes public, clinician, and surveillance layers.",
  robots: { follow: false, index: false },
  title: "Geography-First",
};

export async function GeographyFirstPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  const selection = resolveGeographyFirstPlace(
    geographyFirstPlaceParam(params.place)
  );

  return (
    <main className="geography-first">
      <header className="geography-first-intro">
        <p className="eyebrow">Product research</p>
        <p className="type-section">Start with a place</p>
        <p className="type-body">
          Geography is the shared object. Choose a fictional place, read the
          public layer first, then open clinician resources or surveillance
          detail for that same place.
        </p>
      </header>
      <div className="geography-first-layout">
        <GeographyFirstPicker
          activePlaceId={
            selection.status === "selected" ? selection.place.id : undefined
          }
        />
        {selection.status === "selected" ? (
          <GeographyFirstExperience place={selection.place} />
        ) : (
          <GeographyFirstMissing requestedId={selection.requestedId} />
        )}
      </div>
    </main>
  );
}

export default GeographyFirstPage;
