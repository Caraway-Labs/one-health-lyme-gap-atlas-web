import type { ReactNode } from "react";

import { GeographyFirstV2AudienceNav } from "@/features/ux-lab/geography-first-v2/geography-first-v2-audience-nav";
import { GeographyFirstV2Picker } from "@/features/ux-lab/geography-first-v2/geography-first-v2-picker";
import type {
  GeographyFirstV2Audience,
  GeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";

export function GeographyFirstV2PlaceShell({
  audience,
  children,
  place,
}: {
  audience: GeographyFirstV2Audience;
  children: ReactNode;
  place: GeographyFirstV2Place;
}) {
  return (
    <>
      <GeographyFirstV2AudienceNav current={audience} place={place} />
      <div className="geography-first-v2-layout">
        <GeographyFirstV2Picker activePlaceId={place.id} audience={audience} />
        {children}
      </div>
    </>
  );
}
