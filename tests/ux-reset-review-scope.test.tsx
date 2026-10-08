import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uxResetDestinationHref } from "@/features/ux-reset";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import { markReviewReturnFocus } from "@/features/ux-reset/review/review-return-focus";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { ReviewStatePanel } from "@/features/ux-reset/review/review-state-panel";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";
import { DefaultJurisdictionReadout } from "@/features/ux-reset/settings/default-jurisdiction-readout";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  tier1HighSufficientFixture,
  tier1PriorityForCounty,
  tier1PriorityForRelease,
} from "./fixtures/tier1-surveillance-priority";

let mockedSearch = "";

const reviewReleaseControls: {
  metadataReleaseId: string | null;
  metadataStatus: number;
  tier1Result: Tier1CountyPriority | null;
} = {
  metadataReleaseId: null,
  metadataStatus: 200,
  tier1Result: null,
};

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: () =>
    new URLSearchParams(mockedSearch) as ReadonlyURLSearchParams,
}));

import {
  buildStateReview,
  defaultReviewForState,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "./fixtures/review-scope-api-fixtures";

let lastMapScoreFips = "";

function defaultMetadataResponse() {
  return {
    data: {
      ...reviewScopeMetadataFixture,
      release_id:
        reviewReleaseControls.metadataReleaseId ??
        reviewScopeMetadataFixture.release_id,
    },
    status: reviewReleaseControls.metadataStatus,
  };
}

function defaultStateReviewResponse(
  state: string,
  params?: { dataset_version?: string }
) {
  const review = defaultReviewForState(state);
  return {
    data: {
      ...review,
      data_release_version:
        params?.dataset_version ?? review.data_release_version,
    },
    status: 200 as const,
  };
}

vi.mock(import("@/lib/county-geography"), async (importOriginal) => ({
  ...(await importOriginal()),
  countyDisplayGeometryQueryKey: (...args: unknown[]) => args,
  fetchCountyDisplayGeometry: vi.fn<
    () => Promise<{ features: unknown[]; type: string }>
  >(async () => ({
    features: [],
    type: "FeatureCollection",
  })),
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: ({
    onSelect,
    scores,
  }: {
    onSelect: (fips: string) => void;
    scores: { fips: string }[];
  }) => {
    lastMapScoreFips = scores.map((entry) => entry.fips).join(",");
    return (
      <div data-map-score-fips={lastMapScoreFips} data-testid="mock-atlas-map">
        <button
          data-testid="mock-map-select-ny"
          type="button"
          onClick={() => onSelect("36001", "map")}
        >
          Select NY county on map
        </button>
        <button
          data-testid="mock-map-select-boulder"
          type="button"
          onClick={() => onSelect("08013", "map")}
        >
          Select Boulder on map
        </button>
      </div>
    );
  },
}));

vi.mock(import("@/generated/atlas"), () => ({
  getProfileV1MeProfileGet: vi.fn<
    () => Promise<{ data: { profile: null }; status: number }>
  >(async () => ({
    data: { profile: null },
    status: 200,
  })),
  metadataV1AtlasMetadataGet: vi.fn<
    () => Promise<{ data: typeof reviewScopeMetadataFixture; status: number }>
  >(async () => defaultMetadataResponse()),
  scoresV1AtlasScoresGet: vi.fn<
    () => Promise<{ data: typeof reviewScopeScoresFixture; status: number }>
  >(async () => ({
    data: reviewScopeScoresFixture,
    status: 200,
  })),
  stateReviewV1StatesStateReviewGet: vi.fn<
    (
      state: string,
      params?: { dataset_version?: string }
    ) => Promise<{
      data: ReturnType<typeof defaultReviewForState>;
      status: number;
    }>
  >(async (state: string, params?: { dataset_version?: string }) =>
    defaultStateReviewResponse(state, params)
  ),
  countyTier1SurveillancePriorityGet: vi.fn<
    typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
  >(async (fips) => {
    const result = reviewReleaseControls.tier1Result;
    if (!result) {
      throw new AtlasApiError(
        "No current Tier 1 county result",
        `/v1/counties/${fips}/tier1-surveillance-priority`,
        404,
        null
      );
    }
    return {
      data: result,
      headers: new Headers(),
      status: 200,
    };
  }),
}));

function stubDesktopMatchMedia() {
  vi.stubGlobal(
    "matchMedia",
    (query: string): MediaQueryList =>
      ({
        addEventListener: () => {},
        dispatchEvent: () => true,
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

function renderReview(
  search = "",
  options: {
    client?: QueryClient;
    onUrlUpdate?: (queryString: string) => void;
  } = {}
) {
  mockedSearch = search.startsWith("?") ? search.slice(1) : search;
  const client =
    options.client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={({ queryString }) => options.onUrlUpdate?.(queryString)}
        searchParams={new URL(`http://localhost/app/review${search}`).search}
      >
        <ResetReviewExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return {
    ...view,
    rerenderSearch(next: string) {
      mockedSearch = next.startsWith("?") ? next.slice(1) : next;
      view.rerender(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            searchParams={new URL(`http://localhost/app/review${next}`).search}
          >
            <ResetReviewExperience />
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    },
  };
}

describe("Reset Review scope UI", () => {
  beforeEach(() => {
    mockedSearch = "";
    lastMapScoreFips = "";
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    history.replaceState(null, "");
    reviewReleaseControls.metadataReleaseId = null;
    reviewReleaseControls.metadataStatus = 200;
    reviewReleaseControls.tier1Result = null;
    vi.unstubAllGlobals();
  });

  it("does not offer Alaska or Hawaii as Review scopes", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const metadata = vi.mocked(metadataV1AtlasMetadataGet);
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    metadata.mockResolvedValue({
      data: {
        ...reviewScopeMetadataFixture,
        states: [
          { code: "CO", name: "Colorado" },
          { code: "AK", name: "Alaska" },
          { code: "HI", name: "Hawaii" },
        ],
      },
      status: 200,
    });
    review.mockClear();
    const restoreMetadata = () => {
      metadata.mockImplementation(async () => defaultMetadataResponse());
    };
    const read = async (search: string) => {
      const view = renderReview(search);
      await waitFor(() => {
        if (search.includes("scope=ALL")) {
          if (!screen.queryByRole("button", { name: "CO, Colorado" })) {
            throw new Error("lower 48 scope was not offered");
          }
          return;
        }
        if (!screen.queryByTestId("review-scope-unsupported")) {
          throw new Error("unsupported scope message did not render");
        }
      });
      const snapshot = {
        colorado: Boolean(
          screen.queryByRole("button", { name: "CO, Colorado" })
        ),
        map: Boolean(screen.queryByTestId("mock-atlas-map")),
        offeredAlaska: Boolean(
          screen.queryByRole("button", { name: "AK, Alaska" })
        ),
        offeredHawaii: Boolean(
          screen.queryByRole("button", { name: "HI, Hawaii" })
        ),
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        unsupported:
          screen.queryByTestId("review-scope-unsupported")?.textContent ?? "",
        unsupportedAlaska: Boolean(
          screen.queryByRole("button", {
            name: "AK, not supported — lower 48 only",
          })
        ),
        unsupportedHawaii: Boolean(
          screen.queryByRole("button", {
            name: "HI, not supported — lower 48 only",
          })
        ),
      };
      view.unmount();
      return snapshot;
    };
    let alaska: Awaited<ReturnType<typeof read>> | undefined;
    let hawaii: Awaited<ReturnType<typeof read>> | undefined;
    let national: Awaited<ReturnType<typeof read>> | undefined;
    let callsAfterAlaska = 0;
    let callsAfterHawaii = 0;
    try {
      alaska = await read("?scope=AK");
      callsAfterAlaska = review.mock.calls.length;
      hawaii = await read("?scope=HI");
      callsAfterHawaii = review.mock.calls.length;
      national = await read("?scope=ALL");
    } finally {
      restoreMetadata();
    }
    expect({
      alaska,
      callsAfterAlaska,
      callsAfterHawaii,
      hawaii,
      national,
    }).toStrictEqual({
      alaska: {
        colorado: false,
        map: false,
        offeredAlaska: false,
        offeredHawaii: false,
        picture: false,
        unsupported: "Alaska is not supported — lower 48 only.",
        unsupportedAlaska: false,
        unsupportedHawaii: false,
      },
      callsAfterAlaska: 0,
      callsAfterHawaii: 0,
      hawaii: {
        colorado: false,
        map: false,
        offeredAlaska: false,
        offeredHawaii: false,
        picture: false,
        unsupported: "Hawaii is not supported — lower 48 only.",
        unsupportedAlaska: false,
        unsupportedHawaii: false,
      },
      national: {
        colorado: true,
        map: false,
        offeredAlaska: false,
        offeredHawaii: false,
        picture: false,
        unsupported: "",
        unsupportedAlaska: true,
        unsupportedHawaii: true,
      },
    });
  });

  it("renders national orientation for United States scope", async () => {
    renderReview();
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    expect(screen.getByTestId("review-scope-status").dataset.requestScope).toBe(
      "ALL"
    );
  });

  it("honors explicit URL scope over profile default", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValueOnce({
      data: { profile: { state_code: "CO" } },
      status: 200,
    } as never);
    renderReview("?scope=NY");
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("NY")
    );
    expect(screen.getByTestId("review-scope-status").textContent).toContain(
      "New York"
    );
  });

  it("keeps explicit national scope when profile default is a state", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValue({
      data: { profile: { state_code: "CO" } },
      status: 200,
    } as never);
    renderReview("?scope=ALL");
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    expect(screen.getByTestId("review-scope-status").dataset.requestScope).toBe(
      "ALL"
    );
  });

  it("requests metadata for a supplied dataset query param", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockClear();
    renderReview("?scope=CO&dataset=legacy-release");
    await waitFor(() =>
      expect(metadataV1AtlasMetadataGet).toHaveBeenCalledWith(
        { dataset_version: "legacy-release" },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("legacy-release")
    );
    expect(stateReviewV1StatesStateReviewGet).not.toHaveBeenCalled();
  });

  it("follows a restored URL county after an interactive selection", async () => {
    const updates: string[] = [];
    const coCounties = reviewScopeScoresFixture.counties.filter(
      (county) => county.state === "CO"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (county: string) => (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={county}
          mapCounties={coCounties}
          period={null}
          rankedCounties={coCounties}
          releaseId="alpha-2026"
          scopeCode="CO"
          onCountyChange={(fips, history) => {
            updates.push(`${history}:${fips}`);
          }}
        />
      </QueryClientProvider>
    );
    const view = render(panel("08001"));
    await waitFor(() =>
      expect(screen.getByTestId("review-investigate").dataset.county).toBe(
        "08001"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /Boulder, CO/ }));
    view.rerender(panel("08013"));
    await waitFor(() =>
      expect(screen.getByTestId("review-investigate").dataset.county).toBe(
        "08013"
      )
    );
    const beforeRestore = updates.length;
    view.rerender(panel("08001"));
    await waitFor(() =>
      expect(screen.getByTestId("review-investigate").dataset.county).toBe(
        "08001"
      )
    );
    expect({
      restored: screen.getByTestId("review-investigate").dataset.county,
      selection: updates[0],
      updatesAfterRestore: updates.slice(beforeRestore),
    }).toStrictEqual({
      restored: "08001",
      selection: "push:08013",
      updatesAfterRestore: [],
    });
  });

  it("keeps the URL county as the Investigate handoff", async () => {
    renderReview("?scope=CO&county=08013");
    await waitFor(() =>
      expect(screen.getByTestId("review-investigate").dataset.county).toBe(
        "08013"
      )
    );
    expect(
      screen.getByTestId("review-investigate").getAttribute("href")
    ).toContain("county=08013");
  });

  it("passes only in-state counties to the map", async () => {
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy()
    );
    expect(lastMapScoreFips).toBe("08001,08013");
  });

  it("rejects out-of-state map selection", async () => {
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("mock-map-select-ny"));
    const activeRow = document.querySelector(
      '[data-testid="review-candidate"][aria-current="true"]'
    );
    expect(activeRow?.textContent).toContain("Denver");
  });

  it("lists review candidates without a numeric score", async () => {
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("review-state-panel")).toBeTruthy()
    );
    const candidates = screen.getAllByTestId("review-candidate");
    expect(candidates.map((entry) => entry.dataset.fips)).toStrictEqual([
      "08001",
      "08013",
    ]);
    expect(screen.getByTestId("review-data-gap").dataset.fips).toBe("08031");
    expect(screen.queryByRole("button", { name: /08031/ })).toBeNull();
    expect(screen.queryByText("View full county list")).toBeNull();
    expect(document.querySelector(".rank-score")).toBeNull();
  });

  it("writes scope=ALL through the nuqs setter when national scope is chosen", async () => {
    const urlUpdates: string[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function ScopeSetterProbe() {
      const [, setUrlState] = useQueryStates(reviewSearchParams, {
        history: "push",
      });
      return (
        <button
          data-testid="set-scope-all"
          type="button"
          onClick={() => setUrlState({ scope: "ALL" })}
        >
          Set national scope
        </button>
      );
    }

    render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter
          onUrlUpdate={({ queryString }) => urlUpdates.push(queryString)}
          searchParams=""
        >
          <ScopeSetterProbe />
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByTestId("set-scope-all"));
    await waitFor(() => expect(urlUpdates.at(-1) ?? "").toContain("scope=ALL"));
  });

  it("surfaces unavailable dataset metadata without a perpetual loading state", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValueOnce({
      data: null,
      status: 404,
    } as never);
    vi.mocked(stateReviewV1StatesStateReviewGet).mockClear();
    renderReview("?scope=CO&dataset=older-release");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("older-release")
    );
    expect(screen.queryByText("Loading county scores…")).toBeNull();
    expect(stateReviewV1StatesStateReviewGet).not.toHaveBeenCalled();
  });

  it("realigns the active county when switching state scopes", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          mapCounties={[reviewScopeScoresFixture.counties[0]]}
          rankedCounties={[reviewScopeScoresFixture.counties[0]]}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    expect(document.querySelector(".rank-row.active")?.textContent).toContain(
      "Denver"
    );
    rerender(
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          mapCounties={[reviewScopeScoresFixture.counties[2]]}
          rankedCounties={[reviewScopeScoresFixture.counties[2]]}
          releaseId="alpha-2026"
          scopeCode="NY"
        />
      </QueryClientProvider>
    );
    expect(document.querySelector(".rank-row.active")?.textContent).toContain(
      "Albany"
    );
  });

  it("returns focus to the complete list when the county is outside the shortlist", async () => {
    const base = reviewScopeScoresFixture.counties[0];
    const counties = Array.from({ length: 41 }, (_, index) => ({
      ...base,
      county: `County ${index + 1}`,
      fips: String(8001 + index).padStart(5, "0"),
      score: { ...base.score, score: 100 - index },
    }));
    const selected = counties[40];
    markReviewReturnFocus(selected.fips);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={selected.fips}
          mapCounties={counties}
          period="2023-01-01"
          rankedCounties={counties}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    const view = render(panel);
    await waitFor(() => {
      const focused = document.activeElement;
      expect({
        fips: focused instanceof HTMLElement ? focused.dataset.fips : null,
        tableToggle: screen.getByRole("button", {
          name: "Hide full county list",
        }).textContent,
      }).toStrictEqual({
        fips: selected.fips,
        tableToggle: "Hide full county list",
      });
    });
    expect(sessionStorage.getItem("ux-reset-review-return-focus")).toBeNull();
    history.replaceState(null, "");
    view.rerender(panel);
    expect(
      screen.getByRole("button", { name: "Hide full county list" }).textContent
    ).toBe("Hide full county list");
  });

  it("does not reuse return focus on a fresh Review URL for the same county", async () => {
    const base = reviewScopeScoresFixture.counties[0];
    const counties = Array.from({ length: 41 }, (_, index) => ({
      ...base,
      county: `County ${index + 1}`,
      fips: String(8001 + index).padStart(5, "0"),
      score: { ...base.score, score: 100 - index },
    }));
    const selected = counties[40];
    markReviewReturnFocus(selected.fips);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={selected.fips}
          mapCounties={counties}
          period="2023-01-01"
          rankedCounties={counties}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    const view = render(panel);
    await waitFor(() =>
      expect(sessionStorage.getItem("ux-reset-review-return-focus")).toBeNull()
    );
    view.unmount();
    history.replaceState(null, "");
    render(panel);
    expect({
      focusedFips:
        document.activeElement instanceof HTMLElement
          ? (document.activeElement.dataset.fips ?? null)
          : null,
      tableToggle: screen.getByRole("button", { name: "View full county list" })
        .textContent,
    }).toStrictEqual({
      focusedFips: null,
      tableToggle: "View full county list",
    });
  });

  it("previews a map selection without leaving Review", async () => {
    const { scoresV1AtlasScoresGet } = await import("@/generated/atlas");
    vi.mocked(scoresV1AtlasScoresGet).mockResolvedValue({
      data: reviewScopeScoresFixture,
      status: 200,
    } as never);
    renderReview("?scope=CO&county=08001&period=2023-01-01");
    await waitFor(() =>
      expect(screen.getByTestId("review-county-preview").dataset.fips).toBe(
        "08001"
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("mock-map-select-boulder")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("mock-map-select-boulder"));
    await waitFor(() =>
      expect(screen.getByTestId("review-county-preview").dataset.fips).toBe(
        "08013"
      )
    );
    const preview = screen.getByTestId("review-county-preview");
    const href = screen.getByTestId("review-investigate").getAttribute("href");
    expect({
      caveat: preview.dataset.caveat ?? "",
      dossier:
        screen.queryByText("Copy county summary") ??
        screen.queryByText("Official program examples"),
      heading: screen.getByRole("heading", { name: "Boulder, Colorado" })
        .textContent,
      href,
      label: screen.getByTestId("review-investigate").textContent,
      panel: Boolean(screen.getByTestId("review-state-panel")),
      target: preview.dataset.target,
      why: preview.dataset.why,
    }).toStrictEqual({
      caveat: expect.any(String),
      dossier: null,
      heading: "Boulder, Colorado",
      href: expect.stringMatching(
        /\/app\/investigate\?.*county=08013.*period=2023-01-01.*scope=CO|scope=CO.*county=08013.*period=2023-01-01/
      ),
      label: expect.stringContaining("Open Investigate"),
      panel: true,
      target: href,
      why: "Boulder is included because the review method returned it.",
    });
    expect(
      screen.getByTestId("review-preview-qualification").textContent
    ).toContain("Collection dates are unavailable");
    expect(screen.getByTestId("review-observed-basis").textContent).toContain(
      "Borrelia burgdorferi sensu stricto"
    );
    expect(within(preview).getByText("Inspect provenance")).toBeTruthy();
  });

  it("updates preview identity, why, caveat, and target together", () => {
    const counties = [
      reviewScopeScoresFixture.counties[0],
      reviewScopeScoresFixture.counties[2],
    ];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (county: string) => (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={county}
          mapCounties={counties}
          period="2023-01-01"
          rankedCounties={counties}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    const view = render(panel("08001"));
    const readPreview = () => {
      const preview = screen.getByTestId("review-county-preview");
      return {
        caveat: preview.dataset.caveat,
        fips: preview.dataset.fips,
        target: preview.dataset.target,
        why: preview.dataset.why,
      };
    };
    const denver = readPreview();
    view.rerender(panel("36001"));
    const albany = readPreview();
    const qualification = screen.getByTestId("review-preview-qualification");
    const previewText =
      screen.getByTestId("review-county-preview").textContent ?? "";
    expect({
      albany,
      caveatChanged: albany.caveat !== denver.caveat,
      denverFips: denver.fips,
      denverTarget: denver.target ?? "",
      inspectable: Boolean(
        qualification
          .querySelector("summary")
          ?.textContent?.includes("Inspect provenance")
      ),
      evidenceState: qualification.querySelector(
        ".ux-reset-evidence-availability"
      )?.textContent,
      whyClaimsAvailable: /available for review/i.test(previewText),
      zeroCases: /0 cases/.test(previewText),
    }).toStrictEqual({
      albany: {
        caveat: expect.stringContaining("not treated as zero"),
        fips: "36001",
        target: expect.stringContaining("county=36001"),
        why: "Lower review priority",
      },
      caveatChanged: true,
      denverFips: "08001",
      denverTarget: expect.stringContaining("county=08001"),
      inspectable: true,
      evidenceState: "Limited",
      whyClaimsAvailable: false,
      zeroCases: false,
    });
    expect(albany.target).not.toContain("county=08001");
  });

  it("shows a visible evidence qualification for limited and unavailable counties", () => {
    const limited = {
      ...reviewScopeScoresFixture.counties[0],
      evidence_completeness: 40,
    };
    const suppressed = {
      ...limited,
      evidence_completeness: 100,
      fips: "08005",
      human_status: "SUPPRESSED",
    };
    const partial = {
      ...reviewScopeScoresFixture.counties[2],
      evidence_completeness: 30,
    };
    const empty = {
      ...partial,
      evidence_completeness: 0,
      fips: "36003",
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (county: typeof limited | typeof partial | typeof empty) => (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={county.fips}
          mapCounties={[county]}
          period="2023-01-01"
          rankedCounties={[county]}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    const view = render(panel(limited));
    const limitedNote = screen.getByRole("note").textContent;
    const limitedText =
      screen.getByTestId("review-preview-qualification").textContent ?? "";
    const limitedWhy = screen.getByTestId("review-preview-why").textContent;
    view.rerender(panel(suppressed));
    const suppressedLabel = screen.getByTestId(
      "review-preview-qualification"
    ).textContent;
    const suppressedReason = screen.getByText(
      "Suppressed or privacy-protected"
    ).textContent;
    const evidenceBadge = () =>
      screen
        .getByTestId("review-preview-qualification")
        .querySelector(".ux-reset-evidence-availability")?.textContent;
    view.rerender(panel(partial));
    const partialBadge = evidenceBadge();
    view.rerender(panel(empty));
    const emptyBadge = evidenceBadge();
    expect({
      emptyBadge,
      limitedNote,
      limitedText,
      limitedWhy,
      partialBadge,
      suppressedLabel,
      suppressedReason,
    }).toStrictEqual({
      emptyBadge: "Unavailable",
      limitedNote: "Some scored inputs are unavailable in this release.",
      limitedText: expect.stringContaining("Limited"),
      limitedWhy: "Lower review priority",
      partialBadge: "Limited",
      suppressedLabel: expect.stringContaining("Limited"),
      suppressedReason: "Suppressed or privacy-protected",
    });
  });

  it("keeps compare and states when Review-only controls stay on Review", async () => {
    renderReview(
      "?scope=CO&county=08013&sort=score&page=2&compare=08001,08013&dataset=alpha-2026"
    );
    await waitFor(() =>
      expect(screen.getByTestId("review-county-preview").dataset.fips).toBe(
        "08013"
      )
    );
    const href =
      screen.getByTestId("review-investigate").getAttribute("href") ?? "";
    const url = new URL(href, "http://localhost");
    expect({
      compare: url.searchParams.get("compare"),
      county: url.searchParams.get("county"),
      dataset: url.searchParams.get("dataset"),
      dropped: screen.getByTestId("review-preview-dropped").textContent,
      page: url.searchParams.get("page"),
      sort: url.searchParams.get("sort"),
    }).toStrictEqual({
      compare: "08001,08013",
      county: "08013",
      dataset: "alpha-2026",
      dropped:
        "The Review list page stays on Review. Browser Back returns to it.Review sort stays on Review and is not copied to Investigate.",
      page: null,
      sort: null,
    });
  });

  it("keeps request failure distinct from nothing stands out", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockRejectedValueOnce(
      new Error("service unavailable")
    );
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "temporarily unavailable"
      )
    );
    expect(screen.queryByText(/Nothing stands out/)).toBeNull();
    expect(screen.queryByTestId("review-candidate")).toBeNull();
    expect(screen.queryByTestId("review-result-summary")).toBeNull();
  });

  it("renders nothing-stands-out without turning gaps into candidates", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockResolvedValue({
      data: buildStateReview({
        resultState: "none_stand_out",
        state: "CO",
      }),
      status: 200,
    } as never);
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("review-state-panel").dataset.resultState).toBe(
        "none_stand_out"
      )
    );
    expect(screen.getByTestId("review-result-summary").textContent).toContain(
      "Nothing stands out"
    );
    expect(screen.getByTestId("review-methodology").textContent).toContain(
      "atlas-county-review 1.0.0"
    );
    expect(screen.queryByTestId("review-candidate")).toBeNull();
  });

  it("renders insufficient evidence separately from data-gap-only", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockResolvedValue({
      data: buildStateReview({
        gaps: [
          {
            code: "MISSING_HUMAN_SURVEILLANCE",
            county_fips: "08001",
            detail: "Human surveillance for the requested period is missing.",
          },
        ],
        resultState: "insufficient_evidence",
        state: "CO",
      }),
      status: 200,
    } as never);
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("review-state-panel").dataset.resultState).toBe(
        "insufficient_evidence"
      )
    );
    expect(screen.getByTestId("review-result-summary").textContent).toContain(
      "not enough eligible evidence"
    );
    expect(screen.queryByText(/Nothing stands out/)).toBeNull();
    expect(screen.getByTestId("review-data-gap").textContent).toContain(
      "08001"
    );
    expect(screen.queryByTestId("review-candidate")).toBeNull();
  });

  it("renders unsupported gaps as data-gap-only", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockResolvedValue({
      data: buildStateReview({
        gaps: [
          {
            code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
            county_fips: "08001",
            detail: "Summary statuses lack exact source rows and revisions.",
          },
        ],
        resultState: "unsupported",
        state: "CO",
      }),
      status: 200,
    } as never);
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("review-state-panel").dataset.resultState).toBe(
        "data_gap_only"
      )
    );
    expect(screen.getByTestId("review-result-summary").textContent).toContain(
      "separate from suggestions"
    );
    expect(screen.queryByText(/Nothing stands out/)).toBeNull();
    expect(screen.queryByTestId("review-candidate")).toBeNull();
    expect(screen.getByTestId("review-data-gap").dataset.code).toBe(
      "SOURCE_NATIVE_LINEAGE_UNAVAILABLE"
    );
  });

  it("requests review with the explicit release metadata confirmed", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    review.mockClear();
    renderReview("?scope=CO&dataset=alpha-2026");
    await waitFor(() =>
      expect(review).toHaveBeenCalledWith(
        "CO",
        { dataset_version: "alpha-2026" },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("keeps metadata and review on one release when the default rolls over", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const metadata = vi.mocked(metadataV1AtlasMetadataGet);
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    const releases = ["release-a"];
    metadata.mockImplementation(
      async () =>
        ({
          data: {
            ...reviewScopeMetadataFixture,
            release_id: releases.at(-1) ?? "release-a",
          },
          status: 200,
        }) as never
    );
    review.mockImplementation((async (
      state: string,
      params?: { dataset_version?: string }
    ) => ({
      data: {
        ...buildStateReview({
          candidates: [
            reviewCandidate({
              caveat: "Collection dates are unavailable.",
              countyName:
                params?.dataset_version === "release-b" ? "Boulder" : "Denver",
              fips: params?.dataset_version === "release-b" ? "08013" : "08001",
              reasonText: `Returned for ${params?.dataset_version ?? "omitted"}.`,
            }),
          ],
          state,
        }),
        data_release_version: params?.dataset_version ?? "omitted",
      },
      status: 200,
    })) as never);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockedSearch = "scope=CO";
    try {
      render(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter searchParams="?scope=CO">
            <ResetReviewExperience />
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
      await waitFor(() =>
        expect(screen.getByTestId("review-methodology").textContent).toContain(
          "Release release-a"
        )
      );
      releases.push("release-b");
      await client.invalidateQueries({
        queryKey: ["ux-reset-review-metadata"],
      });
      await waitFor(() =>
        expect(screen.getByTestId("review-methodology").textContent).toContain(
          "Release release-b"
        )
      );
      const requested = new Set(
        review.mock.calls.map((call) => {
          const params = (call as readonly unknown[])[1] as
            | { dataset_version?: string }
            | undefined;
          return params?.dataset_version ?? "omitted";
        })
      );
      expect({
        omitted: requested.has("omitted"),
        sawReleaseA: requested.has("release-a"),
        sawReleaseB: requested.has("release-b"),
        showsBoulder: screen
          .getByTestId("review-candidate")
          .textContent?.includes("Boulder"),
        showsDenver: screen.queryByText("Denver") !== null,
      }).toStrictEqual({
        omitted: false,
        sawReleaseA: true,
        sawReleaseB: true,
        showsBoulder: true,
        showsDenver: false,
      });
    } finally {
      metadata.mockImplementation(async () => defaultMetadataResponse());
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("rejects a review body from a different release", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    review.mockClear();
    review.mockResolvedValue({
      data: {
        ...buildStateReview({
          candidates: [
            reviewCandidate({
              caveat: "Collection dates are unavailable.",
              countyName: "Denver",
              fips: "08001",
              reasonText: "Returned for a different release.",
            }),
          ],
          state: "CO",
        }),
        data_release_version: "release-other",
      },
      status: 200,
    } as never);
    try {
      renderReview("?scope=CO");
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toContain(
          "temporarily unavailable"
        )
      );
      const requested = new Set(
        review.mock.calls.map((call) => {
          const params = (call as readonly unknown[])[1] as
            | { dataset_version?: string }
            | undefined;
          return params?.dataset_version ?? "omitted";
        })
      );
      expect({
        candidate: screen.queryByTestId("review-candidate"),
        omitted: requested.has("omitted"),
        otherRelease: screen.queryByText(/Release release-other/),
        requestedAlpha: requested.has("alpha-2026"),
      }).toStrictEqual({
        candidate: null,
        omitted: false,
        otherRelease: null,
        requestedAlpha: true,
      });
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("keeps the resolved release on shell links when no county is selected", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const metadata = vi.mocked(metadataV1AtlasMetadataGet);
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "08031",
      detail: "Environmental context stays a data gap.",
    };
    const period = "2023-01-01";
    const staleUrl = `scope=CO&county=08001&period=${period}`;
    const reloadedUrl = `scope=CO&period=${period}`;
    let activeRelease = "release-a";
    let mode = "none";
    const shellLinks = () => {
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const href = (label: string) =>
        navigation
          .querySelector(`a[aria-label="${label}"]`)
          ?.getAttribute("href") ?? "";
      return {
        action: href("Action"),
        compare: href("Compare"),
        explore: href("Explore"),
        feed: href("Feed"),
        investigate: href("Investigate"),
        settings: href("Settings"),
      };
    };
    const linksFor = (releaseId: string, county: string | null) => {
      const query = county
        ? `scope=CO&county=${county}&dataset=${releaseId}&period=${period}`
        : `scope=CO&dataset=${releaseId}&period=${period}`;
      return {
        action: `/app/action?${query}`,
        compare: `/app/compare?${query}`,
        explore: `/app/explore?${query}`,
        feed: "/app/feed",
        investigate: `/app/investigate?${query}`,
        settings: "/app/settings",
      };
    };
    const reviewBody = (state: string, datasetVersion = "omitted") => {
      const dataRelease = datasetVersion;
      const shared = { state };
      if (mode === "candidates") {
        return {
          ...buildStateReview({
            candidates: [
              reviewCandidate({
                caveat: "Collection dates are unavailable.",
                countyName: "Denver",
                fips: "08001",
                reasonText: "Denver was returned by the method.",
              }),
            ],
            resultState: "candidates_found",
            ...shared,
          }),
          data_release_version: dataRelease,
        };
      }
      if (mode === "insufficient") {
        return {
          ...buildStateReview({
            resultState: "insufficient_evidence",
            ...shared,
          }),
          data_release_version: dataRelease,
        };
      }
      if (mode === "gaps") {
        return {
          ...buildStateReview({
            gaps: [gap],
            resultState: "unsupported",
            ...shared,
          }),
          data_release_version: dataRelease,
        };
      }
      if (mode === "unsupported") {
        return {
          ...buildStateReview({ resultState: "unsupported", ...shared }),
          data_release_version: dataRelease,
        };
      }
      return {
        ...buildStateReview({ resultState: "none_stand_out", ...shared }),
        data_release_version: dataRelease,
      };
    };
    metadata.mockImplementation(
      async () =>
        ({
          data: {
            ...reviewScopeMetadataFixture,
            release_id: activeRelease,
          },
          status: 200,
        }) as never
    );
    let reviewGate: PromiseWithResolvers<undefined> | null =
      Promise.withResolvers<undefined>();
    review.mockImplementation(((
      state: string,
      params?: { dataset_version?: string }
    ) => {
      const gate = reviewGate;
      const result = () => ({
        data: reviewBody(state, params?.dataset_version),
        status: 200,
      });
      return gate ? gate.promise.then(result) : Promise.resolve(result());
    }) as never);
    const renderShell = (search: string) => {
      mockedSearch = search;
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const view = render(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            searchParams={
              new URL(`http://localhost/app/review?${search}`).search
            }
          >
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
      return { client, view };
    };
    const settle = async (releaseId: string, county: string | null) => {
      const expected = linksFor(releaseId, county).explore;
      await waitFor(() => {
        const explore = shellLinks().explore;
        if (explore !== expected) {
          throw new Error(explore);
        }
      });
      return shellLinks();
    };
    try {
      const loading = renderShell(staleUrl);
      await waitFor(() => {
        if (!screen.queryByText("Loading review results…")) {
          throw new Error("review did not stay loading");
        }
      });
      const whileLoading = shellLinks();
      const finishLoading = reviewGate;
      reviewGate = null;
      finishLoading?.resolve();
      const noneStandOut = await settle(activeRelease, null);
      mode = "insufficient";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const insufficient = await settle(activeRelease, null);
      mode = "gaps";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const unsupportedWithGaps = await settle(activeRelease, null);
      mode = "unsupported";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const unsupportedWithoutGaps = await settle(activeRelease, null);
      mode = "candidates";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const candidates = await settle(activeRelease, "08001");
      mode = "none";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const afterEmptySwitch = await settle(activeRelease, null);
      loading.view.unmount();
      mockedSearch = reloadedUrl;
      const reloaded = renderShell(reloadedUrl);
      const afterReload = await settle(activeRelease, null);
      activeRelease = "release-b";
      await reloaded.client.invalidateQueries({
        queryKey: ["ux-reset-review-metadata"],
      });
      const afterRollover = await settle(activeRelease, null);
      review.mockRejectedValueOnce(new Error("service unavailable"));
      reloaded.view.unmount();
      const failed = renderShell(staleUrl);
      await waitFor(() => {
        if (!screen.queryByText(/temporarily unavailable/)) {
          throw new Error("review error was not shown");
        }
      });
      const whileFailed = shellLinks();
      failed.view.unmount();
      expect({
        afterEmptySwitch,
        afterReload,
        afterRollover,
        candidates,
        insufficient,
        noneStandOut,
        unsupportedWithGaps,
        unsupportedWithoutGaps,
        whileFailed,
        whileLoading,
      }).toStrictEqual({
        afterEmptySwitch: linksFor("release-a", null),
        afterReload: linksFor("release-a", null),
        afterRollover: linksFor("release-b", null),
        candidates: linksFor("release-a", "08001"),
        insufficient: linksFor("release-a", null),
        noneStandOut: linksFor("release-a", null),
        unsupportedWithGaps: linksFor("release-a", null),
        unsupportedWithoutGaps: linksFor("release-a", null),
        whileFailed: {
          action: `/app/action?scope=CO&county=08001&period=${period}`,
          compare: `/app/compare?scope=CO&county=08001&period=${period}`,
          explore: `/app/explore?scope=CO&county=08001&period=${period}`,
          feed: "/app/feed",
          investigate: `/app/investigate?scope=CO&county=08001&period=${period}`,
          settings: "/app/settings",
        },
        whileLoading: {
          action: `/app/action?scope=CO&county=08001&period=${period}`,
          compare: `/app/compare?scope=CO&county=08001&period=${period}`,
          explore: `/app/explore?scope=CO&county=08001&period=${period}`,
          feed: "/app/feed",
          investigate: `/app/investigate?scope=CO&county=08001&period=${period}`,
          settings: "/app/settings",
        },
      });
    } finally {
      metadata.mockImplementation(async () => defaultMetadataResponse());
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("preserves scope=ALL across explore handoff URLs", () => {
    const href = uxResetDestinationHref(
      "explore",
      UX_RESET_ROUTE_PATHS.review,
      new URLSearchParams("scope=ALL&dataset=alpha-2026")
    );
    expect(href).toContain("scope=ALL");
    const returnHref = uxResetDestinationHref(
      "review",
      UX_RESET_ROUTE_PATHS.explore,
      new URLSearchParams(href.split("?")[1] ?? "")
    );
    expect(returnHref).toContain("scope=ALL");
  });

  it("shows a Tier 1 result only for the resolved review release", async () => {
    reviewReleaseControls.tier1Result = tier1PriorityForRelease(
      tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
      "alpha-2026"
    );
    renderReview("?scope=NY&county=36001&dataset=alpha-2026");
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.tier
      ).toBe("HIGH")
    );
    expect(
      screen.getByTestId("tier1-surveillance-priority").dataset.sufficiency
    ).toBe("SUFFICIENT");
  });

  it("keeps a historical review dataset from showing the current Tier 1 batch", async () => {
    reviewReleaseControls.metadataReleaseId = "historical-2024";
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    renderReview("?scope=NY&county=36001&dataset=historical-2024");
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.state
      ).toBe("release-unaligned")
    );
    const region = screen.getByTestId("tier1-surveillance-priority");
    expect({
      low: /\bLOW\b/.test(region.textContent ?? ""),
      reason: region.dataset.releaseReason,
      tier: region.dataset.tier,
    }).toStrictEqual({
      low: false,
      reason: "mismatch",
      tier: undefined,
    });
  });

  it("drops the Tier 1 tier when the same review county changes release", async () => {
    reviewReleaseControls.tier1Result = tier1PriorityForRelease(
      tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
      "alpha-2026"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = renderReview("?scope=NY&county=36001&dataset=alpha-2026", {
      client,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.tier
      ).toBe("HIGH")
    );
    reviewReleaseControls.metadataReleaseId = "historical-2024";
    view.rerenderSearch("?scope=NY&county=36001&dataset=historical-2024");
    await waitFor(() => {
      const region = screen.getByTestId("tier1-surveillance-priority");
      if (
        region.dataset.state !== "release-unaligned" ||
        region.dataset.tier === "HIGH"
      ) {
        throw new Error("The previous Tier 1 result stayed on screen.");
      }
    });
    expect(
      screen.getByTestId("tier1-surveillance-priority").dataset.releaseReason
    ).toBe("mismatch");
    expect(
      screen.getByTestId("tier1-surveillance-priority").textContent
    ).not.toMatch(/\bLOW\b|\bHIGH\b/);
  });

  it("does not align a Tier 1 result when review release metadata fails", async () => {
    reviewReleaseControls.metadataStatus = 503;
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    renderReview("?scope=NY&county=36001&dataset=older-release");
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.releaseReason
      ).toBe("unknown")
    );
    const region = screen.getByTestId("tier1-surveillance-priority");
    expect({
      low: /\bLOW\b/.test(region.textContent ?? ""),
      state: region.dataset.state,
      tier: region.dataset.tier,
    }).toStrictEqual({
      low: false,
      state: "release-unaligned",
      tier: undefined,
    });
  });

  it("drops a matched tier when a metadata refetch fails in the same client", async () => {
    reviewReleaseControls.tier1Result = tier1PriorityForRelease(
      tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
      "alpha-2026"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderReview("?scope=NY&county=36001&dataset=alpha-2026", { client });
    await waitFor(() =>
      expect(screen.getByTestId("tier1-priority-tier").textContent).toBe("HIGH")
    );

    reviewReleaseControls.metadataStatus = 503;
    await client.refetchQueries({
      queryKey: ["ux-reset-review-metadata"],
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.state
      ).toBe("release-unaligned")
    );
    const pageText = document.body.textContent ?? "";
    expect({
      high: /\bHIGH\b/.test(pageText),
      insufficient: /\bINSUFFICIENT\b/.test(pageText),
      low: /\bLOW\b/.test(pageText),
      medium: /\bMEDIUM\b/.test(pageText),
      panels: screen.getAllByTestId("tier1-surveillance-priority").length,
      reason: screen.getByTestId("tier1-surveillance-priority").dataset
        .releaseReason,
      sufficiency: screen.queryByTestId("tier1-evidence-sufficiency"),
      tier: screen.queryByTestId("tier1-priority-tier"),
    }).toStrictEqual({
      high: false,
      insufficient: false,
      low: false,
      medium: false,
      panels: 1,
      reason: "unknown",
      sufficiency: null,
      tier: null,
    });
  });
});

describe("Settings default jurisdiction readout", () => {
  beforeEach(() => {
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("surfaces profile read failures distinctly from national default", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValueOnce({
      data: null,
      status: 503,
    } as never);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <DefaultJurisdictionReadout />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("settings-default-jurisdiction").textContent
      ).toContain("Unable to load your default jurisdiction")
    );
    expect(
      screen
        .getByTestId("settings-default-jurisdiction")
        .querySelector("[data-default-jurisdiction='error']")
    ).toBeTruthy();
  });
});
