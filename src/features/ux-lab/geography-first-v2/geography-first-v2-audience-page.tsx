import type { ReactNode } from "react";

import {
  GeographyFirstV2Missing,
  GeographyFirstV2NonGeographicPaths,
} from "@/features/ux-lab/geography-first-v2/geography-first-v2-experience";
import { GeographyFirstV2PlaceShell } from "@/features/ux-lab/geography-first-v2/geography-first-v2-place-shell";
import {
  geographyFirstV2PlaceParam,
  resolveGeographyFirstV2Place,
  type GeographyFirstV2Audience,
} from "@/features/ux-lab/geography-first-v2/sample-places";

import "@/features/ux-lab/geography-first-v2/geography-first-v2.css";

export async function renderGeographyFirstV2AudiencePage({
  audience,
  intro,
  renderExperience,
  searchParams,
}: {
  audience: GeographyFirstV2Audience;
  intro: ReactNode;
  renderExperience: (place: {
    id: string;
    kind: string;
    name: string;
    setting: string;
  }) => ReactNode;
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  const selection = resolveGeographyFirstV2Place(
    geographyFirstV2PlaceParam(params.place)
  );

  return (
    <main className="geography-first-v2">
      <header className="geography-first-v2-intro">{intro}</header>
      {audience === "public" ? <GeographyFirstV2NonGeographicPaths /> : null}
      {selection.status === "missing" ? (
        <GeographyFirstV2Missing requestedId={selection.requestedId} />
      ) : (
        <GeographyFirstV2PlaceShell audience={audience} place={selection.place}>
          {renderExperience(selection.place)}
        </GeographyFirstV2PlaceShell>
      )}
    </main>
  );
}
