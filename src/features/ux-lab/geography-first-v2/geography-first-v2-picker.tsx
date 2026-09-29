"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GEOGRAPHY_FIRST_V2_PLACES,
  geographyFirstV2PlaceHref,
} from "@/features/ux-lab/geography-first-v2/sample-places";

const placeLinkClassName = buttonVariants({
  className:
    "geography-first-v2-place h-auto min-h-[var(--control-height)] w-full justify-start px-3 py-2 text-left whitespace-normal",
  variant: "outline",
});

export function GeographyFirstV2Picker({
  activePlaceId,
}: {
  activePlaceId?: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      GEOGRAPHY_FIRST_V2_PLACES.filter((place) => {
        if (normalizedQuery.length === 0) {
          return true;
        }
        return `${place.name} ${place.kind} ${place.setting}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery]
  );
  const activePlace = GEOGRAPHY_FIRST_V2_PLACES.find(
    (place) => place.id === activePlaceId
  );
  const activeHidden =
    activePlace !== undefined &&
    !matches.some((place) => place.id === activePlace.id);

  return (
    <aside
      aria-label="Choose a representative place"
      className="geography-first-v2-picker"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
        role="search"
      >
        <label
          className="geography-first-v2-label"
          htmlFor="geography-first-v2-search"
        >
          Search a sample place
        </label>
        <Input
          autoComplete="off"
          className="h-[var(--control-height)]"
          id="geography-first-v2-search"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="County, town, or local area"
          type="search"
          value={query}
        />
      </form>
      {matches.length > 0 ? (
        <nav aria-label="Sample places">
          <ul className="geography-first-v2-places">
            {matches.map((place) => {
              const selected = place.id === activePlaceId;
              return (
                <li key={place.id}>
                  <Link
                    aria-current={selected ? "true" : undefined}
                    className={placeLinkClassName}
                    href={geographyFirstV2PlaceHref(place.id)}
                  >
                    <span>
                      <span className="geography-first-v2-place-name">
                        {place.name}
                      </span>
                      <span className="geography-first-v2-place-kind">
                        {place.setting}
                      </span>
                    </span>
                    {selected ? <Badge variant="outline">Open</Badge> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
        <p className="geography-first-v2-empty" role="status">
          No sample place matches that search.
        </p>
      )}
      {activeHidden && matches.length > 0 ? (
        <p className="type-small" role="status">
          The open place is hidden by this search. Clear the search to see{" "}
          {activePlace.name} in the list.
        </p>
      ) : null}
    </aside>
  );
}
