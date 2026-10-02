import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  GEOGRAPHY_FIRST_V2_AUDIENCE_NAV,
  geographyFirstV2AudienceHref,
  type GeographyFirstV2Audience,
  type GeographyFirstV2Place,
} from "@/features/ux-lab/geography-first-v2/sample-places";

const audienceLinkClassName = buttonVariants({
  className:
    "geography-first-v2-audience-link h-auto min-h-[var(--control-height)] justify-start px-4 py-2 text-left whitespace-normal",
  variant: "outline",
});

export function GeographyFirstV2AudienceNav({
  current,
  place,
}: {
  current: GeographyFirstV2Audience;
  place: GeographyFirstV2Place;
}) {
  return (
    <nav
      aria-labelledby="geography-first-v2-audience-nav"
      className="geography-first-v2-audience-nav"
    >
      <h2 className="type-section" id="geography-first-v2-audience-nav">
        Same place, different depth
      </h2>
      <p className="type-body">
        <strong>{place.name}</strong> stays selected as you move between public,
        clinician, and public-health views. Each route is a separate page so
        content does not collapse into one scroll.
      </p>
      <ul className="geography-first-v2-audience-list">
        {GEOGRAPHY_FIRST_V2_AUDIENCE_NAV.map((item) => {
          const selected = item.audience === current;
          return (
            <li key={item.audience}>
              <Link
                aria-current={selected ? "page" : undefined}
                className={audienceLinkClassName}
                href={geographyFirstV2AudienceHref(item.audience, place.id)}
              >
                <span>
                  <span className="geography-first-v2-audience-label">
                    {item.label}
                  </span>
                  <span className="geography-first-v2-audience-detail type-small">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
