import { AtlasStatusMessage } from "@/components/atlas-status-message";
import {
  CANONICAL_GEOGRAPHY_UNPUBLISHED_COPY,
  type CanonicalGeographyAvailabilityView,
} from "@/features/ux-reset/geography/canonical-geography-availability";

function statusMessage(
  view: CanonicalGeographyAvailabilityView
): string | null {
  switch (view.status) {
    case "idle":
    case "loading":
    case "unpublished": {
      return null;
    }
    case "error":
    case "not_found":
    case "rate_limited":
    case "unsupported": {
      return view.message;
    }
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

/**
 * Selected-county availability presentation. The production notice and the
 * Storybook fixture both render this body so the catalog matches the app.
 */
export function CanonicalGeographyAvailabilityNoticeBody({
  view,
}: {
  view: CanonicalGeographyAvailabilityView;
}) {
  if (view.status === "idle") {
    return null;
  }
  const message = statusMessage(view);
  const live = view.status === "loading" || view.status === "unpublished";
  return (
    <section
      aria-label="Canonical geography publication"
      aria-live={live ? "polite" : undefined}
      data-release={view.status === "unpublished" ? view.releaseId : ""}
      data-status={view.status}
      data-testid="canonical-geography-availability"
    >
      {view.status === "loading" ? (
        <AtlasStatusMessage tone="loading">
          Checking canonical geography publication…
        </AtlasStatusMessage>
      ) : null}
      {view.status === "unpublished" ? (
        <AtlasStatusMessage tone="empty">
          <p>{CANONICAL_GEOGRAPHY_UNPUBLISHED_COPY}</p>
          <p className="type-small">Checked release {view.releaseId}.</p>
          <ul data-testid="canonical-geography-limitations">
            {view.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </AtlasStatusMessage>
      ) : null}
      {message ? (
        <AtlasStatusMessage tone="error">
          <p>{message}</p>
        </AtlasStatusMessage>
      ) : null}
    </section>
  );
}
