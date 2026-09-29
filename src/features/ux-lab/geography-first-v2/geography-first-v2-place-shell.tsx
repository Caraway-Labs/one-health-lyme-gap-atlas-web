import type { ReactNode } from "react";

import { GeographyFirstV2AudienceNav } from "@/features/ux-lab/geography-first-v2/geography-first-v2-audience-nav";
import { GeographyFirstV2Picker } from "@/features/ux-lab/geography-first-v2/geography-first-v2-picker";
import {
  geographyFirstV2AudienceHref,
  type GeographyFirstV2Audience,
  type GeographyFirstV2Place,
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
        <GeographyFirstV2Picker
          activePlaceId={place.id}
          buildPlaceHref={(placeId) =>
            geographyFirstV2AudienceHref(audience, placeId)
          }
        />
        {children}
      </div>
    </>
  );
}
