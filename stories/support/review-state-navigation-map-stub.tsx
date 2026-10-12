"use client";

import { useLayoutEffect } from "react";

type NavigationMapStubProps = {
  features: {
    features: readonly { properties: { code: string; name?: string } }[];
  };
  focusCode: string | null;
  hoverCode: string | null;
  onActivate: (code: string) => void;
  onReady: () => void;
  selectedCode: string | null;
};

/** Storybook stand-in for the MapLibre state map. The list remains the non-map path. */
export function ReviewStateNavigationMap({
  features,
  focusCode,
  hoverCode,
  onActivate,
  onReady,
  selectedCode,
}: NavigationMapStubProps) {
  useLayoutEffect(() => {
    onReady();
  }, [onReady]);
  const code = features.features[0]?.properties.code ?? "CO";
  return (
    <div
      data-focus={focusCode ?? ""}
      data-hover={hoverCode ?? ""}
      data-selected={selectedCode ?? ""}
      data-testid="review-state-map-stub"
    >
      <p>Synthetic state-map stub. MapLibre rendering stays in the app.</p>
      <button
        onClick={() => {
          onActivate(code);
        }}
        type="button"
      >
        {`Activate ${code} on the map stub`}
      </button>
    </div>
  );
}
