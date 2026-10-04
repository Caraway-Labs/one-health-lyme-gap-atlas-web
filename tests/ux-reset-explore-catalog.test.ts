import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  countyDirectoryFromScoreSummaries,
  ExploreContractError,
} from "@/features/ux-reset/explore/explore-model";
import {
  fetchExploreMeasures,
  loadExploreSelection,
} from "@/features/ux-reset/explore/load-explore-resources";
import {
  measuresV1MeasuresGet,
  observationsV1ObservationsGet,
} from "@/generated/atlas";
import type { Measure } from "@/generated/models";

import {
  exploreMeasuresFixture,
  exploreScoresFixture,
} from "./fixtures/explore-api-fixtures";

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    measuresV1MeasuresGet:
      vi.fn<typeof import("@/generated/atlas").measuresV1MeasuresGet>(),
    observationsV1ObservationsGet:
      vi.fn<typeof import("@/generated/atlas").observationsV1ObservationsGet>(),
  };
});

const measuresGet = vi.mocked(measuresV1MeasuresGet);
const observationsGet = vi.mocked(observationsV1ObservationsGet);

function envelope(
  data: readonly Measure[],
  nextPageToken?: string
): {
  data: Measure[];
  links: { self: string };
  meta: { next_page_token?: string };
} {
  return {
    data: [...data],
    links: { self: "/v1/measures" },
    meta: nextPageToken ? { next_page_token: nextPageToken } : {},
  };
}

describe("Explore catalog release", () => {
  beforeEach(() => {
    measuresGet.mockReset();
    observationsGet.mockReset();
  });

  it("rejects a catalog whose pages name different releases", async () => {
    const measure = exploreMeasuresFixture[0] as Measure;
    measuresGet.mockImplementation(async (params) => {
      const next = params?.page_token === "page-2";
      return {
        data: envelope(
          [{ ...measure, release_version: next ? "beta-2026" : "alpha-2026" }],
          next ? undefined : "page-2"
        ),
        headers: new Headers(),
        status: 200,
      } as never;
    });
    await expect(
      fetchExploreMeasures(new AbortController().signal, "alpha-2026")
    ).rejects.toThrow(/mixes release identities/);
  });

  it("rejects an empty catalog for a pinned release", async () => {
    measuresGet.mockResolvedValue({
      data: envelope([]),
      headers: new Headers(),
      status: 200,
    } as never);
    await expect(
      fetchExploreMeasures(new AbortController().signal, "alpha-2026")
    ).rejects.toBeInstanceOf(ExploreContractError);
  });

  it("does not commit empty current observations as a pinned release", async () => {
    observationsGet.mockResolvedValue({
      data: {
        data: [],
        links: { self: "/v1/observations" },
        meta: {},
      },
      headers: new Headers(),
      status: 200,
    } as never);
    const measure = {
      ...(exploreMeasuresFixture[1] as Measure),
      release_version: "beta-2026",
    };
    await expect(
      loadExploreSelection({
        directory: countyDirectoryFromScoreSummaries(
          exploreScoresFixture.counties
        ),
        mapScope: "CO",
        measure,
        releaseId: "alpha-2026",
        signal: new AbortController().signal,
        timeBound: {
          date: "2025-01-01",
          handoffPeriod: "2025-01-01",
          kind: "day",
        },
      })
    ).rejects.toThrow(/Catalog release does not match/);
    expect(observationsGet).toHaveBeenCalledOnce();
  });

  it("keeps an empty response when the catalog release matches", async () => {
    observationsGet.mockResolvedValue({
      data: {
        data: [],
        links: { self: "/v1/observations" },
        meta: {},
      },
      headers: new Headers(),
      status: 200,
    } as never);
    const selection = await loadExploreSelection({
      directory: countyDirectoryFromScoreSummaries(
        exploreScoresFixture.counties
      ),
      mapScope: "CO",
      measure: exploreMeasuresFixture[1] as Measure,
      releaseId: "alpha-2026",
      signal: new AbortController().signal,
      timeBound: {
        date: "2025-01-01",
        handoffPeriod: "2025-01-01",
        kind: "day",
      },
    });
    expect(selection.releaseId).toBe("alpha-2026");
    expect(selection.handoffPeriod).toBe("2025-01-01");
    expect(
      selection.rows.every((row) => row.availability === "unavailable")
    ).toBeTruthy();
  });
});
