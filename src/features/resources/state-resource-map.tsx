import { stateResourceByCode } from "@/lib/resources/catalog";
import {
  RESOURCE_STATE_CONTEXT_PATHS,
  RESOURCE_STATE_MAP_VIEWBOX,
  RESOURCE_STATE_PATHS,
} from "@/lib/resources/state-map-paths";

export function StateResourceMap({
  onSelect,
  selectedCode,
}: {
  onSelect: (code: string) => void;
  selectedCode: string | null;
}) {
  return (
    <div className="resources-map">
      <svg
        aria-label="United States. Select a state to see its resources. Alaska and Hawaii are included."
        role="group"
        viewBox={RESOURCE_STATE_MAP_VIEWBOX}
      >
        {RESOURCE_STATE_CONTEXT_PATHS.map((shape) => (
          <path
            key={shape.code}
            aria-hidden="true"
            className="resources-context-shape"
            d={shape.d}
          />
        ))}
        {RESOURCE_STATE_PATHS.map((shape) => {
          const state = stateResourceByCode(shape.code);
          const selected = shape.code === selectedCode;
          return (
            <path
              key={shape.code}
              aria-label={`Select ${state?.name ?? shape.code}`}
              aria-pressed={selected}
              className="resources-state-shape"
              d={shape.d}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                onSelect(shape.code);
                event.currentTarget.blur();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(shape.code);
                }
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
