import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canonicalGeographyViewFromError,
  fetchCanonicalGeographyAvailability,
} from "@/features/ux-reset/geography/canonical-geography-availability";
import {
  createObservationSelectionAccumulator,
  mergeKnownEmptySelections,
  readObservationSelectionAvailability,
} from "@/features/ux-reset/observations/selection-availability";
import * as atlasClient from "@/generated/atlas";
import type { CollectionMeta } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

const RELEASE = "alpha-2026";
const LIMITATION =
  "No published observations match this selection in the checked release. This does not establish biological absence, source coverage, or geography membership.";

function meta(overrides: Partial<CollectionMeta> = {}): CollectionMeta {
  return {
    availability: "UNAVAILABLE",
    limitations: [LIMITATION],
    next_page_token: null,
    reason: "NO_PUBLISHED_RESULTS",
    release_id: RELEASE,
    ...overrides,
  };
}

describe("observation selection availability", () => {
  it("classifies an initial non-CDC empty selection as no published results", () => {
    expect(
      readObservationSelectionAvailability({
        dataCount: 0,
        measureId: "reported-cases",
        meta: meta(),
        pageToken: null,
        requestedReleaseId: RELEASE,
      })
    ).toMatchObject({
      kind: "known_unavailable",
      selection: {
        availability: "UNAVAILABLE",
        measureId: "reported-cases",
        reason: "NO_PUBLISHED_RESULTS",
        releaseId: RELEASE,
      },
    });
  });

  it("keeps populated rows available even when meta says unavailable", () => {
    expect(
      readObservationSelectionAvailability({
        dataCount: 2,
        measureId: "reported-cases",
        meta: meta(),
        pageToken: null,
        requestedReleaseId: RELEASE,
      }).kind
    ).toBe("available");
  });

  it("does not treat an empty continuation as no published results", () => {
    const accumulator = createObservationSelectionAccumulator({
      measureId: "reported-cases",
      requestedReleaseId: RELEASE,
    });
    accumulator.note({
      dataCount: 1,
      meta: meta({ availability: "AVAILABLE", limitations: [], reason: null }),
      pageToken: null,
    });
    accumulator.note({
      dataCount: 0,
      meta: meta({ availability: "AVAILABLE", limitations: [], reason: null }),
      pageToken: "next",
    });
    expect(accumulator.finish().kind).toBe("not_known_empty");
  });

  it("does not classify CDC admission measures from selection meta", () => {
    expect(
      readObservationSelectionAvailability({
        dataCount: 0,
        measureId: "scapularis_status",
        meta: meta(),
        pageToken: null,
        requestedReleaseId: RELEASE,
      }).kind
    ).toBe("unclassified_empty");
    expect(
      readObservationSelectionAvailability({
        dataCount: 0,
        measureId: "burgdorferi_status",
        meta: meta(),
        pageToken: null,
        requestedReleaseId: RELEASE,
      }).kind
    ).toBe("unclassified_empty");
  });

  it("leaves an empty page without the typed reason unclassified", () => {
    expect(
      readObservationSelectionAvailability({
        dataCount: 0,
        measureId: "reported-cases",
        meta: meta({ availability: "AVAILABLE", reason: null }),
        pageToken: null,
        requestedReleaseId: RELEASE,
      }).kind
    ).toBe("unclassified_empty");
  });

  it("requires a matching release and meaningful limitations before known-empty", () => {
    const read = (overrides: Partial<CollectionMeta>) =>
      readObservationSelectionAvailability({
        dataCount: 0,
        measureId: "reported-cases",
        meta: meta(overrides),
        pageToken: null,
        requestedReleaseId: RELEASE,
      }).kind;
    const omitted = createObservationSelectionAccumulator({
      measureId: "reported-cases",
      requestedReleaseId: RELEASE,
    });
    omitted.note({
      dataCount: 0,
      meta: {
        next_page_token: null,
        response_at: "2026-10-18T00:00:00.000Z",
      },
      pageToken: null,
    });
    expect({
      blankLimitations: read({ limitations: ["  "] }),
      blankRelease: read({ release_id: "   " }),
      emptyLimitations: read({ limitations: [] }),
      emptyRelease: read({ release_id: "" }),
      legacy: omitted.finish().kind,
      nullLimitations: read({ limitations: null }),
      nullRelease: read({ release_id: null }),
      valid: read({}),
    }).toStrictEqual({
      blankLimitations: "malformed_authority",
      blankRelease: "malformed_authority",
      emptyLimitations: "malformed_authority",
      emptyRelease: "malformed_authority",
      legacy: "not_known_empty",
      nullLimitations: "malformed_authority",
      nullRelease: "malformed_authority",
      valid: "known_unavailable",
    });
  });

  it("rejects a known-empty release that is not the requested release", () => {
    const accumulator = createObservationSelectionAccumulator({
      measureId: "reported-cases",
      requestedReleaseId: RELEASE,
    });
    accumulator.note({
      dataCount: 0,
      meta: meta({ release_id: "other-release" }),
      pageToken: null,
    });
    expect(accumulator.finish().kind).toBe("release_mismatch");
  });

  it("requires every batch to be known-empty", () => {
    const known = createObservationSelectionAccumulator({
      measureId: "reported-cases",
      requestedReleaseId: RELEASE,
    });
    known.note({ dataCount: 0, meta: meta(), pageToken: null });
    const open = createObservationSelectionAccumulator({
      measureId: "reported-cases",
      requestedReleaseId: RELEASE,
    });
    open.note({
      dataCount: 0,
      meta: {},
      pageToken: null,
    });
    expect(
      mergeKnownEmptySelections([known.finish(), open.finish()]).kind
    ).toBe("not_known_empty");
    expect(
      mergeKnownEmptySelections([known.finish(), known.finish()]).kind
    ).toBe("known_unavailable");
  });
});

describe("canonical geography availability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the unpublished envelope without building a geography", async () => {
    vi.spyOn(atlasClient, "checkGeographyAvailability").mockResolvedValue({
      data: {
        availability: "UNAVAILABLE",
        data: null,
        limitations: [
          "Canonical geography identity delivery is not published by this API capability.",
        ],
        reason: "CANONICAL_GEOGRAPHY_UNPUBLISHED",
        release_id: RELEASE,
      },
      headers: new Headers({ "cache-control": "no-store" }),
      status: 200,
    });
    const view = await fetchCanonicalGeographyAvailability(
      "01001",
      new AbortController().signal
    );
    expect(view).toStrictEqual({
      limitations: [
        "Canonical geography identity delivery is not published by this API capability.",
      ],
      releaseId: RELEASE,
      status: "unpublished",
    });
    expect(view).not.toHaveProperty("data");
    expect(view).not.toHaveProperty("geography");
    expect(atlasClient.checkGeographyAvailability).toHaveBeenCalledWith(
      "county",
      "01001",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("keeps not-found, rate limit, and transport failures as errors", () => {
    expect(
      canonicalGeographyViewFromError(
        new AtlasApiError(
          "missing",
          "/v1/geographies/county/99999/availability",
          404,
          null
        )
      ).status
    ).toBe("not_found");
    expect(
      canonicalGeographyViewFromError(
        new AtlasApiError(
          "limited",
          "/v1/geographies/county/01001/availability",
          429,
          null,
          2
        )
      )
    ).toMatchObject({ retryAfterSeconds: 2, status: "rate_limited" });
    expect(
      canonicalGeographyViewFromError(
        new AtlasApiError(
          "down",
          "/v1/geographies/county/01001/availability",
          503,
          null
        )
      ).status
    ).toBe("error");
    expect(
      canonicalGeographyViewFromError(new TypeError("network")).status
    ).toBe("error");
    expect(
      canonicalGeographyViewFromError(
        new AtlasApiError(
          "bad",
          "/v1/geographies/county/state/availability",
          400,
          null
        )
      ).status
    ).toBe("unsupported");
  });
});
