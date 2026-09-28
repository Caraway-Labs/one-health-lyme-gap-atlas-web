"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PUBLIC_FIRST_PATH,
  PUBLIC_FIRST_PLACES,
  type PublicFirstPlaceId,
} from "@/features/ux-lab/public-first/content";

export function PlaceLookup({ placeId }: { placeId: PublicFirstPlaceId }) {
  const router = useRouter();

  return (
    <form
      className="public-first-lookup"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="public-first-lookup-copy">
        <label htmlFor="public-first-place">Explore a sample place</label>
        <p id="public-first-place-help">
          Choose a fictional place to see a public snapshot. These names are
          layout stand-ins, not Atlas findings.
        </p>
      </div>
      <Select
        value={placeId}
        onValueChange={(value) => {
          if (!value) {
            return;
          }
          router.push(`${PUBLIC_FIRST_PATH}?place=${value}`, { scroll: false });
        }}
      >
        <SelectTrigger
          aria-describedby="public-first-place-help"
          className="public-first-place-trigger"
          id="public-first-place"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PUBLIC_FIRST_PLACES.map((place) => (
            <SelectItem key={place.id} value={place.id}>
              {place.name}, {place.region}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
