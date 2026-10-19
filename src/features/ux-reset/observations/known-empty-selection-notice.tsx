import { AtlasStatusMessage } from "@/components/atlas-status-message";
import type { KnownEmptyObservationSelection } from "@/features/ux-reset/observations/selection-availability";

export function KnownEmptySelectionNotice({
  omitCaveats = false,
  selections,
  testId,
}: {
  /** Atlas Explorer omits the absence caveat and limitation list. */
  omitCaveats?: boolean;
  selections: readonly KnownEmptyObservationSelection[];
  testId: string;
}) {
  if (selections.length === 0) {
    return null;
  }
  const limitations: string[] = [];
  const seen = new Set<string>();
  const releaseIds: string[] = [];
  const seenReleases = new Set<string>();
  for (const selection of selections) {
    if (selection.releaseId && !seenReleases.has(selection.releaseId)) {
      seenReleases.add(selection.releaseId);
      releaseIds.push(selection.releaseId);
    }
    for (const limitation of selection.limitations) {
      if (!seen.has(limitation)) {
        seen.add(limitation);
        limitations.push(limitation);
      }
    }
  }
  return (
    <section
      aria-label="Observation selection availability"
      data-selection-availability="UNAVAILABLE"
      data-selection-reason="NO_PUBLISHED_RESULTS"
      data-testid={testId}
    >
      <AtlasStatusMessage tone="empty">
        <p>No published results for this selection.</p>
        {omitCaveats ? null : (
          <p>
            This does not establish biological absence, source coverage, or
            geography membership.
          </p>
        )}
        {releaseIds.length === 1 ? (
          <p className="type-small">Checked release {releaseIds[0]}.</p>
        ) : null}
        {selections.length > 1 ? (
          <ul>
            {selections.map((selection) => (
              <li key={selection.measureId}>{selection.measureId}</li>
            ))}
          </ul>
        ) : null}
        {omitCaveats || limitations.length === 0 ? null : (
          <ul data-testid={`${testId}-limitations`}>
            {limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        )}
      </AtlasStatusMessage>
    </section>
  );
}
