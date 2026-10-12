type AtlasMapStubProps = {
  ariaLabel?: string;
  onSelect?: (fips: string, surface: string) => void;
  selectedFips?: string;
};

/** Storybook stand-in. MapLibre rendering stays in application tests. */
export function AtlasMap({
  ariaLabel,
  onSelect,
  selectedFips,
}: AtlasMapStubProps) {
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
