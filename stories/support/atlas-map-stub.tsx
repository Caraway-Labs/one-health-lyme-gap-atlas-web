import { useEffect } from "react";

type AtlasMapStubProps = {
  ariaLabel?: string;
  onPaintSettled?: (revision: string) => void;
  onSelect?: (fips: string, surface: string) => void;
  paintRevision?: string;
  selectedFips?: string;
};

/** Storybook stand-in. MapLibre rendering stays in application tests. */
export function AtlasMap({
  ariaLabel,
  onPaintSettled,
  onSelect,
  paintRevision,
  selectedFips,
}: AtlasMapStubProps) {
  useEffect(() => {
    if (!paintRevision) {
      return;
    }
    onPaintSettled?.(paintRevision);
  }, [onPaintSettled, paintRevision]);

  return (
    <div aria-label={ariaLabel} data-testid="atlas-map-stub">
      <p>
        Synthetic map stub for Adams County, Colorado (08001). This is not a
        MapLibre map and it does not color counties by risk.
      </p>
      <p data-testid="atlas-map-stub-selected">
        {selectedFips ? `Map selection ${selectedFips}` : "Map selection none"}
      </p>
      <button
        onClick={() => {
          onSelect?.("08001", "map");
        }}
        type="button"
      >
        Select Adams County on the map stub
      </button>
    </div>
  );
}
