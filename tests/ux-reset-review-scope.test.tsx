import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uxResetDestinationHref } from "@/features/ux-reset";
import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import { markReviewReturnFocus } from "@/features/ux-reset/review/review-return-focus";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { ReviewStatePanel } from "@/features/ux-reset/review/review-state-panel";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";
import { DefaultJurisdictionReadout } from "@/features/ux-reset/settings/default-jurisdiction-readout";

let mockedSearch = "";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: () =>
    new URLSearchParams(mockedSearch) as ReadonlyURLSearchParams,
}));

import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "./fixtures/review-scope-api-fixtures";

let lastMapScoreFips = "";

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
  >(async () => ({
    data: reviewScopeMetadataFixture,
    status: 200,
  })),
  scoresV1AtlasScoresGet: vi.fn<
    () => Promise<{ data: typeof reviewScopeScoresFixture; status: number }>
  >(async () => ({
    data: reviewScopeScoresFixture,
    status: 200,
  })),
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
    onUrlUpdate?: (queryString: string) => void;
  } = {}
) {
  mockedSearch = search.startsWith("?") ? search.slice(1) : search;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        onUrlUpdate={({ queryString }) => options.onUrlUpdate?.(queryString)}
        searchParams={new URL(`http://localhost/app/review${search}`).search}
      >
        <ResetReviewExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
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
    vi.unstubAllGlobals();
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
    const { metadataV1AtlasMetadataGet } = await import("@/generated/atlas");
    renderReview("?scope=CO&dataset=legacy-release");
    await waitFor(() =>
      expect(metadataV1AtlasMetadataGet).toHaveBeenCalledWith(
        { dataset_version: "legacy-release" },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
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
    const activeRow = document.querySelector(".rank-row.active");
    expect(activeRow?.textContent).toContain("Denver");
  });

  it("renders the full county table when expanded", async () => {
    const manyCounties = Array.from({ length: 41 }, (_, index) => {
      const fips = String(8000 + index).padStart(5, "0");
      return {
        ...reviewScopeScoresFixture.counties[0],
        county: `County ${index + 1}`,
        fips,
        score: {
          ...reviewScopeScoresFixture.counties[0].score,
          score: 90 - index,
        },
      };
    });
    const { scoresV1AtlasScoresGet } = await import("@/generated/atlas");
    vi.mocked(scoresV1AtlasScoresGet).mockResolvedValue({
      data: { ...reviewScopeScoresFixture, counties: manyCounties },
      status: 200,
    } as never);

    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("review-state-panel")).toBeTruthy()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View full county list" })
    );
    expect(screen.getAllByRole("row").length).toBeGreaterThan(41);
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
    const { metadataV1AtlasMetadataGet } = await import("@/generated/atlas");
    vi.mocked(metadataV1AtlasMetadataGet).mockResolvedValueOnce({
      data: null,
      status: 404,
    } as never);
    renderReview("?scope=CO&dataset=older-release");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("older-release")
    );
    expect(screen.queryByText("Loading county scores…")).toBeNull();
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
      why: "Lower review priority",
    });
    expect(
      screen.getByTestId("review-preview-qualification").textContent
    ).toContain("Some scored inputs are unavailable");
    expect(screen.getByText("Inspect provenance")).toBeTruthy();
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

  it("states when Review-only controls are dropped from Investigate", async () => {
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
      compare: null,
      county: "08013",
      dataset: "alpha-2026",
      dropped: expect.stringMatching(
        /Compare is not part of Investigate[\s\S]*Review list page stays on Review[\s\S]*Review sort stays on Review/
      ),
      page: null,
      sort: null,
    });
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
