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
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { uxResetDestinationHref } from "@/features/ux-reset";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import { markReviewReturnFocus } from "@/features/ux-reset/review/review-return-focus";
import { reviewSearchParams } from "@/features/ux-reset/review/review-search-params";
import { ReviewStatePanel } from "@/features/ux-reset/review/review-state-panel";
import { useApplyProfileStartingScope } from "@/features/ux-reset/review/use-apply-profile-starting-scope";
import { UX_RESET_ROUTE_PATHS } from "@/features/ux-reset/routes";
import { DefaultJurisdictionReadout } from "@/features/ux-reset/settings/default-jurisdiction-readout";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  tier1HighSufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const reviewRouter = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

let mockedSearch = "";

function askAtlasContentHref() {
  return new URL(
    screen.getByTestId("review-ask-atlas").getAttribute("href") ?? "",
    "http://localhost"
  );
}

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
  usePathname: () => "/explore",
  useRouter: () => reviewRouter,
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

vi.mock(import("@/features/ux-reset/investigate/load-county-evidence"), () => ({
  loadInvestigateCountyRecord: vi.fn<() => Promise<null>>(async () => null),
}));

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: ({
    fitSignal = 0,
    onCountyPointer,
    onSelect,
    scores,
  }: {
    fitSignal?: number;
    onCountyPointer?: (click: { clickDetail: number; fips: string }) => void;
    onSelect: (fips: string, surface: "map") => void;
    scores: { fips: string }[];
  }) => {
    lastMapScoreFips = scores.map((entry) => entry.fips).join(",");
    const choose = (fips: string) => {
      if (onCountyPointer) {
        onCountyPointer({ clickDetail: 1, fips });
        return;
      }
      onSelect(fips, "map");
    };
    return (
      <div
        data-fit-signal={String(fitSignal)}
        data-map-score-fips={lastMapScoreFips}
        data-testid="mock-atlas-map"
      >
        <button
          data-testid="mock-map-select-ny"
          type="button"
          onClick={() => choose("36001")}
        >
          Select NY county on map
        </button>
        <button
          data-testid="mock-map-select-boulder"
          type="button"
          onClick={() => choose("08013")}
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
    (params?: {
      dataset_version?: string;
    }) => Promise<{ data: typeof reviewScopeScoresFixture; status: number }>
  >(async (params?: { dataset_version?: string }) => ({
    data: {
      ...reviewScopeScoresFixture,
      release_id: params?.dataset_version ?? "alpha-2026",
    },
    status: 200,
  })),
  saveProfileV1MeProfilePut: vi.fn<
    () => Promise<{ data: { profile: null }; status: number }>
  >(async () => ({
    data: { profile: null },
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

async function installNationalGeometry() {
  const { fetchCountyDisplayGeometry } = await import("@/lib/county-geography");
  const polygon = (fips: string, west: number) => ({
    geometry: {
      coordinates: [
        [
          [west, 39],
          [west + 1, 39],
          [west + 1, 40],
          [west, 40],
          [west, 39],
        ],
      ],
      type: "Polygon" as const,
    },
    properties: { fips },
    type: "Feature" as const,
  });
  vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
    features: [
      polygon("08001", -105),
      polygon("08013", -107),
      polygon("36001", -74),
    ],
    type: "FeatureCollection",
  });
}

async function clearNationalGeometry() {
  const { fetchCountyDisplayGeometry } = await import("@/lib/county-geography");
  vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
    features: [],
    type: "FeatureCollection",
  });
}

function renderReview(
  search = "",
  options: {
    client?: QueryClient;
    onUrlUpdate?: (queryString: string, history: "push" | "replace") => void;
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
        onUrlUpdate={({ options: updateOptions, queryString }) =>
          options.onUrlUpdate?.(queryString, updateOptions.history)
        }
        searchParams={new URL(`http://localhost/explore${search}`).search}
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
            searchParams={new URL(`http://localhost/explore${next}`).search}
          >
            <ResetReviewExperience />
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    },
  };
}

type StartupProfile = { state_code: string | null } | null;

function scopeToken(query: string): string {
  const matched = /(?:^|[?&])scope=(?<scope>[^&]*)/.exec(query);
  const scope = matched?.groups?.scope;
  if (!scope) {
    return "";
  }
  return decodeURIComponent(scope);
}

function ProfileStartupHarness({
  activeScope,
  onSetScope,
}: {
  activeScope: "ALL" | string;
  onSetScope: (scope: "ALL" | string) => void;
}) {
  const startupSettled = useApplyProfileStartingScope({
    activeScope,
    profileReady: true,
    profileStateCode: "CO",
    setScope: onSetScope,
    stateOptions: [{ code: "CO", name: "Colorado" }],
  });
  return (
    <div data-settled={String(startupSettled)} data-testid="startup-harness" />
  );
}

function renderedReviewScope(): string {
  return (
    screen.queryByTestId("review-scope-results")?.dataset.renderedScope ?? ""
  );
}

async function chooseReviewScopeOption(name: string) {
  fireEvent.click(screen.getByTestId("review-scope-select"));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

async function waitForRenderedScope(scope: string) {
  await waitFor(() => {
    if (screen.queryByText("Loading review scope…")) {
      throw new Error("startup still pending");
    }
    if (renderedReviewScope() !== scope) {
      throw new Error(`rendered ${renderedReviewScope()} expected ${scope}`);
    }
  });
}

/**
 * Once startup settles, the URL has an explicit scope that reproduces the
 * screen, and startup does not run again. Each row is one path through that rule.
 */
async function observeSettledStartup(input: {
  afterScope: string;
  back: boolean;
  error: boolean;
  forwardScope: string;
  pick: "United States" | "New York (NY)" | null;
  profile: StartupProfile;
  refetch: StartupProfile;
  settledScope: string;
}): Promise<{
  kept: boolean;
  history: string;
  later: string;
  laterRendered: string;
  rendered: string;
  saves: number;
  scope: string;
}> {
  const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
    await import("@/generated/atlas");
  const save = vi.mocked(saveProfileV1MeProfilePut);
  save.mockClear();
  const updates: { history: string; query: string }[] = [];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let failed = input.error;
  let current = input.profile;
  const held = input.pick
    ? Promise.withResolvers<{
        data: { profile: StartupProfile };
        status: number;
      }>()
    : null;
  vi.mocked(getProfileV1MeProfileGet).mockImplementation(
    () =>
      (held
        ? held.promise
        : failed
          ? Promise.reject(new Error("profile unavailable"))
          : Promise.resolve({
              data: { profile: current },
              status: 200,
            })) as never
  );
  window.history.replaceState(null, "", "/explore");
  const view = renderReview("", {
    client,
    onUrlUpdate: (query, history) => {
      updates.push({ history, query });
    },
  });
  if (input.pick && !input.back) {
    await chooseReviewScopeOption(input.pick);
  }
  if (input.pick && input.back) {
    await chooseReviewScopeOption(input.pick);
    window.history.replaceState(null, "", "/explore");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  held?.resolve({
    data: { profile: input.profile },
    status: 200,
  });
  await waitForRenderedScope(input.settledScope);
  const establishedIndex = updates.findIndex((update, index) => {
    if (scopeToken(update.query) !== input.settledScope) {
      return false;
    }
    const previous = updates[index - 1];
    return (
      previous === undefined ||
      scopeToken(previous.query) !== input.settledScope
    );
  });
  const established =
    establishedIndex === -1 ? undefined : updates[establishedIndex];
  const kept =
    establishedIndex !== -1 &&
    updates
      .slice(establishedIndex)
      .every((update) => scopeToken(update.query) === input.settledScope);
  const rendered = renderedReviewScope();
  if (input.forwardScope) {
    window.history.pushState(null, "", "/explore?scope=NY");
    window.dispatchEvent(new PopStateEvent("popstate"));
    view.rerenderSearch("?scope=NY");
    await waitForRenderedScope(input.forwardScope);
  } else if (input.refetch) {
    failed = false;
    current = input.refetch;
    await client.refetchQueries({ queryKey: ["ux-reset-saved-profile"] });
    await waitForRenderedScope(input.afterScope);
  }
  const laterScope = input.forwardScope
    ? scopeToken(window.location.search)
    : scopeToken(updates.at(-1)?.query ?? "");
  return {
    kept,
    history: established?.history ?? "",
    later: laterScope,
    laterRendered: renderedReviewScope(),
    rendered,
    saves: save.mock.calls.length,
    scope: scopeToken(established?.query ?? ""),
  };
}

describe("Reset Review scope UI", () => {
  beforeEach(async () => {
    const { scoresV1AtlasScoresGet } = await import("@/generated/atlas");
    vi.mocked(scoresV1AtlasScoresGet).mockImplementation(
      async (params) =>
        ({
          data: {
            ...reviewScopeScoresFixture,
            release_id: params?.dataset_version ?? "alpha-2026",
          },
          status: 200,
        }) as never
    );

    mockedSearch = "";
    lastMapScoreFips = "";
    reviewRouter.push.mockClear();
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    history.replaceState(null, "", "/");
    reviewReleaseControls.metadataReleaseId = null;
    reviewReleaseControls.metadataStatus = 200;
    reviewReleaseControls.tier1Result = null;
    vi.unstubAllGlobals();
  });

  it("follows Investigate when a malformed Review URL is still canonicalizing", async () => {
    const search = "?scope=state&county=bad&period=2024&dataset=alpha";
    window.history.pushState(null, "", `/explore${search}`);
    const destination = uxResetDestinationHref(
      "investigate",
      "/explore",
      new URLSearchParams(search.slice(1))
    );
    renderReview(search);
    const anchor = document.createElement("a");
    anchor.textContent = "Investigate";
    anchor.href = destination;
    document.body.append(anchor);
    const stopNavigation = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("click", stopNavigation, true);
    fireEvent.click(anchor);
    try {
      await waitFor(() => {
        const href = reviewRouter.push.mock.calls[0]?.[0] ?? "";
        const url = new URL(href, "http://localhost");
        expect({
          county: url.searchParams.get("county"),
          dataset: url.searchParams.get("dataset"),
          href,
          pathname: url.pathname,
          period: url.searchParams.get("period"),
          scope: url.searchParams.get("scope"),
        }).toStrictEqual({
          county: null,
          dataset: "alpha",
          href: destination,
          pathname: "/app/investigate",
          period: null,
          scope: "ALL",
        });
      });
    } finally {
      document.removeEventListener("click", stopNavigation, true);
      anchor.remove();
      window.history.replaceState(null, "", "/");
    }
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
      if (search.includes("scope=ALL")) {
        fireEvent.click(await screen.findByTestId("review-scope-select"));
        await screen.findByRole("option", { name: "Colorado (CO)" });
      } else {
        await waitFor(() => {
          if (!screen.queryByTestId("review-scope-unsupported")) {
            throw new Error("unsupported scope message did not render");
          }
        });
      }
      const snapshot = {
        colorado: Boolean(
          screen.queryByRole("option", { name: "Colorado (CO)" }) ||
          screen.queryByRole("button", { name: "CO, Colorado" })
        ),
        map: Boolean(screen.queryByTestId("mock-atlas-map")),
        offeredAlaska: Boolean(
          screen.queryByRole("option", { name: "Alaska (AK)" }) ||
          screen.queryByRole("button", { name: "AK, Alaska" })
        ),
        offeredHawaii: Boolean(
          screen.queryByRole("option", { name: "Hawaii (HI)" }) ||
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
        unsupportedAlaska: false,
        unsupportedHawaii: false,
      },
    });
  });

  it("clears a stale county when the review scope is not supported", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    review.mockClear();
    const urlUpdates: string[] = [];
    const search =
      "scope=AK&county=08001&dataset=alpha-2026&period=2023-01-01&compare=08001,08013";
    mockedSearch = search;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={({ queryString }) => urlUpdates.push(queryString)}
          searchParams={`?${search}`}
        >
          <ResetProfessionalShell>
            <ResetReviewExperience />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("review-scope-unsupported").textContent).toBe(
        "Alaska is not supported — lower 48 only."
      );
    });
    await waitFor(() => {
      const latest = urlUpdates.at(-1) ?? "";
      if (latest.includes("county=") || !latest.includes("scope=AK")) {
        throw new Error(latest || "county was not cleared");
      }
    });
    const navigation = screen.getByRole("navigation", {
      name: "Professional workspace",
    });
    const href = (label: string) =>
      navigation
        .querySelector(`a[aria-label="${label}"]`)
        ?.getAttribute("href") ?? "";
    const shell = {
      compare: href("Compare"),
      ask: href("Ask Atlas"),
    };
    const presence = {
      map: Boolean(screen.queryByTestId("mock-atlas-map")),
      picture: Boolean(screen.queryByTestId("review-state-panel")),
    };
    view.unmount();
    const cleared = urlUpdates.at(-1) ?? "";
    expect({
      clearedCounty: cleared.includes("county="),
      clearedScope: cleared.includes("scope=AK"),
      map: presence.map,
      picture: presence.picture,
      reviewCalls: review.mock.calls.length,
      shellCompare:
        shell.compare.includes("county=") || shell.compare.includes("compare="),
      shellAsk: shell.ask,
    }).toStrictEqual({
      clearedCounty: false,
      clearedScope: true,
      map: false,
      picture: false,
      reviewCalls: 0,
      shellCompare: false,
      shellAsk: "/askatlas?dataset=alpha-2026",
    });
  });

  it("clears a mismatched county for scopes outside the lower 48", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    const codes = ["PR", "ZZ", "GU"] as const;
    const snapshots: {
      clearedCounty: boolean;
      clearedScope: boolean;
      map: boolean;
      message: string | null;
      picture: boolean;
      reviewCalls: number;
      shellCompare: boolean;
      shellAsk: string;
    }[] = [];
    for (const code of codes) {
      review.mockClear();
      const urlUpdates: string[] = [];
      const search = `scope=${code}&county=08001&dataset=alpha-2026&period=2023-01-01&compare=08001,08013`;
      mockedSearch = search;
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const view = render(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={({ queryString }) => urlUpdates.push(queryString)}
            searchParams={`?${search}`}
          >
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
      await waitFor(() => {
        expect(screen.getByTestId("review-scope-unsupported").textContent).toBe(
          `${code} is not supported — lower 48 only.`
        );
      });
      await waitFor(() => {
        const latest = urlUpdates.at(-1) ?? "";
        if (latest.includes("county=") || !latest.includes(`scope=${code}`)) {
          throw new Error(latest || "county was not cleared");
        }
      });
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const href = (label: string) =>
        navigation
          .querySelector(`a[aria-label="${label}"]`)
          ?.getAttribute("href") ?? "";
      const cleared = urlUpdates.at(-1) ?? "";
      snapshots.push({
        clearedCounty: cleared.includes("county="),
        clearedScope: cleared.includes(`scope=${code}`),
        map: Boolean(screen.queryByTestId("mock-atlas-map")),
        message: screen.getByTestId("review-scope-unsupported").textContent,
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        reviewCalls: review.mock.calls.length,
        shellCompare:
          href("Compare").includes("county=") ||
          href("Compare").includes("compare="),
        shellAsk: href("Ask Atlas"),
      });
      view.unmount();
    }
    expect(snapshots).toStrictEqual(
      codes.map((code) => ({
        clearedCounty: false,
        clearedScope: true,
        map: false,
        message: `${code} is not supported — lower 48 only.`,
        picture: false,
        reviewCalls: 0,
        shellCompare: false,
        shellAsk: `/askatlas?dataset=alpha-2026`,
      }))
    );
  });

  it("clears the prior county when the next state's review does not succeed", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    let mode: "fail" | "hold" | "ok" = "ok";
    const search = "scope=CO&county=08001&dataset=alpha-2026&period=2023-01-01";
    mockedSearch = search;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    review.mockImplementation(((
      state: string,
      params?: { dataset_version?: string },
      init?: { signal?: AbortSignal }
    ) => {
      if (mode === "fail") {
        return Promise.reject(new Error("service unavailable"));
      }
      if (mode === "hold") {
        const held = Promise.withResolvers<never>();
        const abort = () => {
          held.reject(
            new DOMException("The operation was aborted.", "AbortError")
          );
        };
        if (init?.signal?.aborted) {
          abort();
        } else {
          init?.signal?.addEventListener("abort", abort, { once: true });
        }
        return held.promise;
      }
      return Promise.resolve(defaultStateReviewResponse(state, params));
    }) as never);
    function ReviewShellHarness() {
      const [, setSearchTick] = useState(0);
      return (
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={({ queryString }) => {
              mockedSearch = queryString.replace(/^\?/, "");
              setSearchTick((tick) => tick + 1);
            }}
            searchParams={`?${search}`}
          >
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    }
    const view = render(<ReviewShellHarness />);
    const shellCounty = (label: string) => {
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const href =
        navigation
          .querySelector(`a[aria-label="${label}"]`)
          ?.getAttribute("href") ?? "";
      const params = new URL(href, "http://localhost").searchParams;
      return {
        county: params.get("county"),
        href,
        scope: params.get("scope"),
      };
    };
    try {
      await waitFor(() => {
        const selected = screen
          .getAllByTestId("review-candidate")
          .find((entry) => entry.getAttribute("aria-current") === "true");
        expect(selected?.dataset.fips).toBe("08001");
      });
      expect(shellCounty("Compare").county).toBe("08001");
      mode = "hold";
      fireEvent.click(screen.getByTestId("review-scope-select"));
      const newYork = await screen.findByRole("option", {
        name: "New York (NY)",
      });
      fireEvent.pointerDown(newYork, { pointerType: "mouse" });
      fireEvent.click(newYork);
      await waitFor(() => {
        if (!screen.queryByText("Loading review results…")) {
          throw new Error("review did not stay loading");
        }
        const investigate = shellCounty("Compare");
        if (
          investigate.scope !== "NY" ||
          investigate.county !== null ||
          mockedSearch.includes("county=")
        ) {
          throw new Error(`${mockedSearch} ${investigate.href}`);
        }
      });
      const whileLoading = {
        action: shellCounty("Action").county,
        compare: shellCounty("Compare").county,
        explore: shellCounty("Explore").county,
        investigate: shellCounty("Compare").county,
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        scope: shellCounty("Compare").scope,
        urlCounty: mockedSearch.includes("county="),
      };
      await client.cancelQueries({ queryKey: ["ux-reset-state-review"] });
      await waitFor(() => {
        const investigate = shellCounty("Compare");
        if (
          investigate.scope !== "NY" ||
          investigate.county !== null ||
          investigate.href.includes("08001") ||
          mockedSearch.includes("08001")
        ) {
          throw new Error(`${mockedSearch} ${investigate.href}`);
        }
      });
      const whileAborted = {
        county: shellCounty("Compare").county,
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        scope: shellCounty("Compare").scope,
        url: mockedSearch,
      };
      mode = "fail";
      await client.invalidateQueries({ queryKey: ["ux-reset-state-review"] });
      await waitFor(() => {
        if (!screen.queryByText(/temporarily unavailable/)) {
          throw new Error("review error was not shown");
        }
        const investigate = shellCounty("Compare");
        if (investigate.county !== null || mockedSearch.includes("county=")) {
          throw new Error(`${mockedSearch} ${investigate.href}`);
        }
      });
      const whileFailed = {
        action: shellCounty("Action").county,
        compare: shellCounty("Compare").county,
        explore: shellCounty("Explore").county,
        investigate: shellCounty("Compare").county,
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        scope: shellCounty("Compare").scope,
        urlCounty: mockedSearch.includes("county="),
      };
      view.unmount();
      expect({ whileAborted, whileFailed, whileLoading }).toStrictEqual({
        whileAborted: {
          county: null,
          picture: false,
          scope: "NY",
          url: expect.not.stringContaining("08001"),
        },
        whileFailed: {
          action: null,
          compare: null,
          explore: null,
          investigate: null,
          picture: false,
          scope: "NY",
          urlCounty: false,
        },
        whileLoading: {
          action: null,
          compare: null,
          explore: null,
          investigate: null,
          picture: false,
          scope: "NY",
          urlCounty: false,
        },
      });
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("normalizes mismatched counties on direct loads and scope changes before shell links publish", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    let mode: "empty" | "fail" | "hold" | "ok" = "ok";
    const origin =
      "scope=CO&county=08001&compare=08001,08013&dataset=alpha-2026&period=2023-01-01";
    const mismatched =
      "scope=NY&county=08001&compare=08001,08013&dataset=alpha-2026&period=2023-01-01";
    const matched =
      "scope=NY&county=36001&compare=36001,36003&dataset=alpha-2026&period=2023-01-01";
    review.mockImplementation(((
      state: string,
      params?: { dataset_version?: string },
      init?: { signal?: AbortSignal }
    ) => {
      if (mode === "fail") {
        return Promise.reject(new Error("service unavailable"));
      }
      if (mode === "empty") {
        return Promise.resolve({
          data: buildStateReview({
            resultState: "none_stand_out",
            state,
          }),
          status: 200,
        });
      }
      if (mode === "hold") {
        const held = Promise.withResolvers<never>();
        const abort = () => {
          held.reject(
            new DOMException("The operation was aborted.", "AbortError")
          );
        };
        if (init?.signal?.aborted) {
          abort();
        } else {
          init?.signal?.addEventListener("abort", abort, { once: true });
        }
        return held.promise;
      }
      return Promise.resolve(defaultStateReviewResponse(state, params));
    }) as never);

    function shellCounty() {
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const href =
        navigation
          .querySelector('a[aria-label="Compare"]')
          ?.getAttribute("href") ?? "";
      const params = new URL(href, "http://localhost").searchParams;
      return {
        compare: params.get("compare"),
        county: params.get("county"),
        picture: Boolean(screen.queryByTestId("review-state-panel")),
        scope: params.get("scope"),
        urlCompare: mockedSearch.includes("compare="),
        urlCounty: mockedSearch.includes("county="),
      };
    }

    function ScopeJump({ scope }: { scope: string }) {
      const [, setUrlState] = useQueryStates(reviewSearchParams, {
        history: "push",
      });
      return (
        <button
          data-testid="jump-review-scope"
          type="button"
          onClick={() => {
            void setUrlState({ scope });
          }}
        >
          Jump scope
        </button>
      );
    }

    function ReviewEntry({
      client,
      jumpTo,
      search,
    }: {
      client: QueryClient;
      jumpTo?: string;
      search: string;
    }) {
      const [, setSearchTick] = useState(0);
      return (
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={({ queryString }) => {
              mockedSearch = queryString.replace(/^\?/, "");
              setSearchTick((tick) => tick + 1);
            }}
            searchParams={`?${search}`}
          >
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
            {jumpTo ? <ScopeJump scope={jumpTo} /> : null}
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
    }

    function mount(search: string, jumpTo?: string) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      mockedSearch = search;
      const view = render(
        <ReviewEntry client={client} jumpTo={jumpTo} search={search} />
      );
      return { client, view };
    }

    async function until(ready: () => boolean) {
      await waitFor(() => {
        if (!ready()) {
          throw new Error(mockedSearch);
        }
      });
      return shellCounty();
    }

    async function changeScope(nextMode: typeof mode, jumpTo?: string) {
      mode = "ok";
      const { client, view } = mount(origin, jumpTo);
      try {
        await until(() => {
          const selected = screen
            .queryAllByTestId("review-candidate")
            .find((entry) => entry.getAttribute("aria-current") === "true");
          return selected?.dataset.fips === "08001";
        });
        mode = nextMode;
        if (jumpTo) {
          fireEvent.click(screen.getByTestId("jump-review-scope"));
        } else {
          fireEvent.click(screen.getByTestId("review-scope-select"));
          const newYork = await screen.findByRole("option", {
            name: "New York (NY)",
          });
          fireEvent.pointerDown(newYork, { pointerType: "mouse" });
          fireEvent.click(newYork);
        }
        return { client, view };
      } catch (error) {
        view.unmount();
        throw error;
      }
    }

    try {
      mode = "hold";
      const loadingView = mount(mismatched);
      const directLoading = await until(
        () =>
          shellCounty().county === null &&
          shellCounty().urlCounty === false &&
          shellCounty().urlCompare === true &&
          Boolean(screen.queryByText("Loading review results…"))
      );
      loadingView.view.unmount();
      const matchedLoadingView = mount(matched);
      const directMatchedLoading = await until(
        () =>
          shellCounty().county === "36001" &&
          shellCounty().urlCounty === true &&
          Boolean(screen.queryByText("Loading review results…"))
      );
      matchedLoadingView.view.unmount();

      const abortDirect = mount(mismatched);
      await until(() => Boolean(screen.queryByText("Loading review results…")));
      await abortDirect.client.cancelQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const directAborted = await until(
        () =>
          shellCounty().county === null &&
          shellCounty().urlCounty === false &&
          shellCounty().picture === false
      );
      abortDirect.view.unmount();

      mode = "fail";
      const failedView = mount(mismatched);
      const directFailed = await until(
        () =>
          shellCounty().county === null &&
          Boolean(screen.queryByText(/temporarily unavailable/))
      );
      failedView.view.unmount();
      const matchedFailedView = mount(matched);
      const directMatchedFailed = await until(
        () =>
          shellCounty().county === "36001" &&
          shellCounty().urlCounty === true &&
          Boolean(screen.queryByText(/temporarily unavailable/))
      );
      matchedFailedView.view.unmount();

      mode = "empty";
      const emptyView = mount(mismatched);
      const directEmpty = await until(
        () =>
          shellCounty().county === null &&
          shellCounty().urlCounty === false &&
          Boolean(screen.queryByTestId("review-result-summary"))
      );
      emptyView.view.unmount();

      mode = "ok";
      review.mockClear();
      const unsupportedView = mount(
        "scope=PR&county=08001&compare=08001,08013&dataset=alpha-2026&period=2023-01-01"
      );
      const directUnsupported = await until(
        () =>
          shellCounty().county === null &&
          shellCounty().compare === null &&
          shellCounty().urlCounty === false &&
          shellCounty().urlCompare === false &&
          Boolean(screen.queryByTestId("review-scope-unsupported"))
      );
      const unsupportedReviewCalls = review.mock.calls.length;
      unsupportedView.view.unmount();

      const loadingChange = await changeScope("hold");
      const changedLoading = await until(
        () =>
          shellCounty().scope === "NY" &&
          shellCounty().county === null &&
          shellCounty().compare === "08001,08013" &&
          shellCounty().urlCounty === false &&
          Boolean(screen.queryByText("Loading review results…"))
      );
      await loadingChange.client.cancelQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const changedAborted = await until(
        () =>
          shellCounty().scope === "NY" &&
          shellCounty().county === null &&
          shellCounty().urlCounty === false &&
          shellCounty().picture === false
      );
      loadingChange.view.unmount();

      const failedChange = await changeScope("fail");
      const changedFailed = await until(
        () =>
          shellCounty().scope === "NY" &&
          shellCounty().county === null &&
          shellCounty().compare === "08001,08013" &&
          Boolean(screen.queryByText(/temporarily unavailable/))
      );
      failedChange.view.unmount();

      const emptyChange = await changeScope("empty");
      const changedEmpty = await until(
        () =>
          shellCounty().scope === "NY" &&
          shellCounty().county === null &&
          shellCounty().urlCounty === false &&
          Boolean(screen.queryByTestId("review-result-summary"))
      );
      emptyChange.view.unmount();

      const unsupportedChange = await changeScope("ok", "AK");
      const changedUnsupported = await until(
        () =>
          shellCounty().scope === "AK" &&
          shellCounty().county === null &&
          shellCounty().compare === null &&
          shellCounty().urlCounty === false &&
          shellCounty().urlCompare === false &&
          Boolean(screen.queryByTestId("review-scope-unsupported"))
      );
      unsupportedChange.view.unmount();

      expect({
        changedAborted,
        changedEmpty,
        changedFailed,
        changedLoading,
        changedUnsupported,
        directAborted,
        directEmpty,
        directFailed,
        directLoading,
        directMatchedFailed,
        directMatchedLoading,
        directUnsupported,
        unsupportedReviewCalls,
      }).toStrictEqual({
        changedAborted: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        changedEmpty: {
          compare: "08001,08013",
          county: null,
          picture: true,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        changedFailed: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        changedLoading: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        changedUnsupported: {
          compare: null,
          county: null,
          picture: false,
          scope: "AK",
          urlCompare: false,
          urlCounty: false,
        },
        directAborted: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        directEmpty: {
          compare: "08001,08013",
          county: null,
          picture: true,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        directFailed: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        directLoading: {
          compare: "08001,08013",
          county: null,
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: false,
        },
        directMatchedFailed: {
          compare: "36001,36003",
          county: "36001",
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: true,
        },
        directMatchedLoading: {
          compare: "36001,36003",
          county: "36001",
          picture: false,
          scope: "NY",
          urlCompare: true,
          urlCounty: true,
        },
        directUnsupported: {
          compare: null,
          county: null,
          picture: false,
          scope: "PR",
          urlCompare: false,
          urlCounty: false,
        },
        unsupportedReviewCalls: 0,
      });
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  }, 20_000);

  it("uses published identity for Ask Atlas when the candidate name is blank", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    review.mockResolvedValue({
      data: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "   ",
            fips: "08001",
            reasonText: "Adams was returned without a county name.",
          }),
          reviewCandidate({
            caveat: "Collection dates are unavailable.",
            countyName: "Boulder",
            fips: "08013",
            reasonText: "Boulder was returned with a county name.",
          }),
        ],
        state: "CO",
      }),
      status: 200,
    } as never);
    const search = "scope=CO&county=08001&dataset=alpha-2026";
    mockedSearch = search;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    try {
      render(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter hasMemory searchParams={`?${search}`}>
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
      await waitFor(() => {
        const blankRow = screen
          .getAllByTestId("review-candidate")
          .find((row) => row.dataset.fips === "08001");
        if (!blankRow?.textContent?.includes("Unavailable, CO")) {
          throw new Error(blankRow?.textContent ?? "blank county row missing");
        }
      });
      await waitFor(() => {
        const href = askAtlasContentHref();
        if (
          href.searchParams.get("county") !== "08001" ||
          href.searchParams.has("page_ref")
        ) {
          throw new Error(href.search);
        }
      });
      const href = askAtlasContentHref();
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const shellHref = (label: string) =>
        navigation
          .querySelector(`a[aria-label="${label}"]`)
          ?.getAttribute("href") ?? "";
      const investigate =
        screen.getByTestId("review-investigate").getAttribute("href") ?? "";
      const compare =
        screen.getByTestId("review-compare").getAttribute("href") ?? "";
      const ask = shellHref("Ask Atlas");
      expect({
        askCounty: ask.includes("county=08001"),
        askOtherCounty: ask.includes("08013"),
        compareCounty: compare.includes("county=08001"),
        compareOtherCounty: compare.includes("08013"),
        contentCounty: href.searchParams.get("county"),
        contentPageRef: href.searchParams.get("page_ref"),
        investigateCounty: investigate.includes("county=08001"),
        investigateOtherCounty: investigate.includes("08013"),
        otherCountyOnLink: href.href.includes("Boulder"),
        panel: screen.queryByTestId("ask-atlas-panel"),
        preview: screen
          .getByTestId("review-county-preview")
          .getAttribute("aria-label"),
      }).toStrictEqual({
        askCounty: true,
        askOtherCounty: false,
        compareCounty: true,
        compareOtherCounty: false,
        contentCounty: "08001",
        contentPageRef: null,
        investigateCounty: true,
        investigateOtherCounty: false,
        otherCountyOnLink: false,
        panel: null,
        preview: "County preview for Unavailable, Colorado",
      });
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("hides a loaded review when a later refetch fails", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    let failRefresh = false;
    review.mockImplementation(async (state: string) => {
      if (failRefresh) {
        throw new Error("service unavailable");
      }
      return {
        data: buildStateReview({
          candidates: [
            reviewCandidate({
              caveat: "Collection dates are unavailable.",
              countyName: "Denver",
              fips: "08001",
              reasonText: "Denver was returned by the method.",
            }),
          ],
          state,
        }),
        status: 200 as const,
      };
    });
    const search = "scope=CO&county=08001&dataset=alpha-2026";
    const urlUpdates: string[] = [];
    mockedSearch = search;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    try {
      render(
        <QueryClientProvider client={client}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={({ queryString }) => {
              mockedSearch = queryString.replace(/^\?/, "");
              urlUpdates.push(queryString);
            }}
            searchParams={`?${search}`}
          >
            <ResetProfessionalShell>
              <ResetReviewExperience />
            </ResetProfessionalShell>
          </NuqsTestingAdapter>
        </QueryClientProvider>
      );
      await waitFor(() => {
        const selected = screen.getByTestId("review-candidate");
        if (!selected.textContent?.includes("Denver, CO")) {
          throw new Error(selected.textContent ?? "candidate missing");
        }
      });
      await waitFor(() => {
        const href = askAtlasContentHref();
        if (
          href.searchParams.get("county") !== "08001" ||
          href.searchParams.has("page_ref")
        ) {
          throw new Error(href.search);
        }
      });
      failRefresh = true;
      await client.invalidateQueries({ queryKey: ["ux-reset-state-review"] });
      await waitFor(() => {
        if (
          !screen
            .queryByRole("alert")
            ?.textContent?.includes("temporarily unavailable")
        ) {
          throw new Error("review error was not shown");
        }
      });
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const shellHref = (label: string) =>
        navigation
          .querySelector(`a[aria-label="${label}"]`)
          ?.getAttribute("href") ?? "";
      const latestUrl = urlUpdates.at(-1) ?? search;
      await waitFor(() => {
        if (screen.queryByTestId("review-ask-atlas")) {
          throw new Error("in-content Ask Atlas link remained");
        }
        if (document.querySelector(".app-header a")) {
          throw new Error("header still has a link");
        }
      });
      const ask = shellHref("Ask Atlas");
      expect({
        askCounty: ask.includes("county=08001"),
        candidates: screen.queryAllByTestId("review-candidate").length,
        compareAction: screen.queryByTestId("review-compare"),
        compareCounty: shellHref("Compare").includes("county=08001"),
        failure: screen.getByRole("alert").textContent,
        headerAskLink: document.querySelector(".app-header a"),
        investigateAction: screen.queryByTestId("review-investigate"),
        pageReference: screen.queryByTestId("review-ask-atlas"),
        picture: screen.queryByTestId("review-state-panel"),
        shellCounty: new URL(ask, "http://localhost").searchParams.get(
          "county"
        ),
        staleGeography: ask.includes("Denver"),
        urlCounty: latestUrl.includes("county=08001"),
      }).toStrictEqual({
        askCounty: true,
        candidates: 0,
        compareAction: null,
        compareCounty: true,
        failure: expect.stringContaining("temporarily unavailable"),
        headerAskLink: null,
        investigateAction: null,
        pageReference: null,
        picture: null,
        shellCounty: "08001",
        staleGeography: false,
        urlCounty: true,
      });
      expect(ask.includes("page_ref")).toBeFalsy();
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
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
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
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

  it("keeps a county URL when the saved starting view is a state", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    const updates: string[] = [];
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValue({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    } as never);
    window.history.replaceState(null, "", "/explore?county=08001");
    renderReview("?county=08001", {
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    await waitFor(() => {
      if (screen.queryByText("Loading review scope…")) {
        throw new Error("startup still pending");
      }
    });
    expect({
      countyKept: updates.every((query) => query.includes("county=08001")),
      rendered: renderedReviewScope(),
      stateWrite: updates.some((query) => query.includes("scope=CO")),
    }).toStrictEqual({
      countyKept: true,
      rendered: "ALL",
      stateWrite: false,
    });
  });

  it("keeps a focus-only URL on the national map when the saved view is a state", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    const updates: string[] = [];
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValue({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    } as never);
    window.history.replaceState(null, "", "/explore?focus=ID");
    renderReview("?focus=ID", {
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    await waitFor(() => {
      if (screen.queryByText("Loading review scope…")) {
        throw new Error("startup still pending");
      }
    });
    expect({
      focusKept: updates.every((query) => query.includes("focus=ID")),
      rendered: renderedReviewScope(),
      stateWrite: updates.some((query) => query.includes("scope=CO")),
    }).toStrictEqual({
      focusKept: true,
      rendered: "ALL",
      stateWrite: false,
    });
  });

  it("clears a county that is outside the focused state", async () => {
    const updates: string[] = [];
    window.history.replaceState(
      null,
      "",
      "/explore?scope=ALL&focus=ID&county=56039"
    );
    renderReview("?scope=ALL&focus=ID&county=56039", {
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    await waitFor(() => {
      const latest = updates.at(-1) ?? "";
      if (!(latest.includes("focus=ID") && !latest.includes("county="))) {
        throw new Error(latest || "mismatched county is still in the URL");
      }
    });
    expect(renderedReviewScope()).toBe("ALL");
  });

  it("keeps explicit national scope when profile default is a state", async () => {
    const { getProfileV1MeProfileGet } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValue({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
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

  it("applies a state profile default with replace and without a national flash", async () => {
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    const updates: { history: string; query: string }[] = [];
    const profileGate = Promise.withResolvers<{
      data: { profile: { state_code: string } };
      status: number;
    }>();
    vi.mocked(getProfileV1MeProfileGet).mockReturnValue(
      profileGate.promise as never
    );
    renderReview("", {
      onUrlUpdate: (query, history) => {
        updates.push({ history, query });
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Loading review scope…")).toBeTruthy()
    );
    expect(screen.queryByTestId("review-national-orientation")).toBeNull();
    expect(screen.queryByTestId("review-scope-status")).toBeNull();
    profileGate.resolve({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("CO")
    );
    expect({
      history: updates[0]?.history ?? "",
      national: screen.queryByTestId("review-national-orientation"),
      query: updates[0]?.query ?? "",
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      status: screen.getByTestId("review-scope-status").textContent,
    }).toStrictEqual({
      history: "replace",
      national: null,
      query: expect.stringContaining("scope=CO"),
      saves: 0,
      status: expect.stringContaining("Colorado"),
    });
  });

  it("keeps a scope chosen before the profile default arrives", async () => {
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    const profileGate = Promise.withResolvers<{
      data: { profile: { state_code: string } };
      status: number;
    }>();
    vi.mocked(getProfileV1MeProfileGet).mockReturnValue(
      profileGate.promise as never
    );
    renderReview("");
    await waitFor(() =>
      expect(screen.getByTestId("review-scope-select")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("review-scope-select"));
    const newYork = await screen.findByRole("option", {
      name: "New York (NY)",
    });
    fireEvent.pointerDown(newYork, { pointerType: "mouse" });
    fireEvent.click(newYork);
    profileGate.resolve({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("NY")
    );
    await waitFor(() =>
      expect(screen.getByTestId("review-candidate").textContent).toContain(
        "Albany"
      )
    );
    expect({
      denver: screen.queryByText("Denver"),
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      scope: screen.getByTestId("review-scope-status").textContent,
    }).toStrictEqual({
      denver: null,
      saves: 0,
      scope: expect.stringContaining("New York"),
    });
  });

  it("keeps an explicit United States choice made while the profile is loading", async () => {
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    const profileGate = Promise.withResolvers<{
      data: { profile: { state_code: string } };
      status: number;
    }>();
    vi.mocked(getProfileV1MeProfileGet).mockReturnValue(
      profileGate.promise as never
    );
    const updates: { history: string; query: string }[] = [];
    renderReview("", {
      onUrlUpdate: (query, history) => {
        updates.push({ history, query });
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Loading review scope…")).toBeTruthy()
    );
    fireEvent.click(screen.getByTestId("review-scope-select"));
    const unitedStates = await screen.findByRole("option", {
      name: "United States",
    });
    fireEvent.pointerDown(unitedStates, { pointerType: "mouse" });
    fireEvent.click(unitedStates);
    await waitFor(() =>
      expect(
        updates.some((update) => update.query.includes("scope=ALL"))
      ).toBeTruthy()
    );
    profileGate.resolve({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    });
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    expect({
      denver: screen.queryByText("Denver"),
      loading: screen.queryByText("Loading review scope…"),
      panel: screen.queryByTestId("review-state-panel"),
      rendered: screen.getByTestId("review-scope-results").dataset
        .renderedScope,
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      write: updates.find((update) => update.query.includes("scope=ALL")),
    }).toStrictEqual({
      denver: null,
      loading: null,
      panel: null,
      rendered: "ALL",
      saves: 0,
      write: { history: "push", query: expect.stringContaining("scope=ALL") },
    });
  });

  it("writes the saved state again when a scope-less entry reverts to national", async () => {
    window.history.replaceState(null, "", "/explore");
    mockedSearch = "";
    const writes: string[] = [];
    const onSetScope = (scope: "ALL" | string) => {
      writes.push(scope);
    };
    const view = render(
      <ProfileStartupHarness activeScope="ALL" onSetScope={onSetScope} />
    );
    await waitFor(() => {
      if (!writes.includes("CO")) {
        throw new Error("saved state was not written");
      }
    });
    view.rerender(
      <ProfileStartupHarness activeScope="CO" onSetScope={onSetScope} />
    );
    await waitFor(() => {
      if (screen.getByTestId("startup-harness").dataset.settled !== "true") {
        throw new Error("startup did not settle");
      }
    });
    const writesAfterSettle = writes.length;
    view.rerender(
      <ProfileStartupHarness activeScope="ALL" onSetScope={onSetScope} />
    );
    await waitFor(() => {
      if (writes.length <= writesAfterSettle) {
        throw new Error("saved state was not written again");
      }
    });
    expect(writes.at(-1)).toBe("CO");
  });

  it("applies the saved state after Back from a scope chosen during profile load", async () => {
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    const profileGate = Promise.withResolvers<{
      data: { profile: { state_code: string } };
      status: number;
    }>();
    vi.mocked(getProfileV1MeProfileGet).mockReturnValue(
      profileGate.promise as never
    );
    const updates: { history: string; query: string }[] = [];
    renderReview("", {
      onUrlUpdate: (query, history) => {
        updates.push({ history, query });
      },
    });
    fireEvent.click(screen.getByTestId("review-scope-select"));
    const newYork = await screen.findByRole("option", {
      name: "New York (NY)",
    });
    fireEvent.pointerDown(newYork, { pointerType: "mouse" });
    fireEvent.click(newYork);
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("NY")
    );
    window.history.replaceState(null, "", "/explore");
    window.dispatchEvent(new PopStateEvent("popstate"));
    profileGate.resolve({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("CO")
    );
    expect({
      loading: screen.queryByText("Loading review scope…"),
      national: screen.queryByTestId("review-national-orientation"),
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      status: screen.getByTestId("review-scope-status").textContent,
      write: updates.at(-1),
    }).toStrictEqual({
      loading: null,
      national: null,
      saves: 0,
      status: expect.stringContaining("Colorado"),
      write: { history: "replace", query: expect.stringContaining("scope=CO") },
    });
  });

  it("keeps the national fallback when a failed profile read later returns a state", async () => {
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    let failProfile = true;
    vi.mocked(getProfileV1MeProfileGet).mockImplementation(
      () =>
        (failProfile
          ? Promise.reject(new Error("profile unavailable"))
          : Promise.resolve({
              data: { profile: { starting_view_version: 1, state_code: "CO" } },
              status: 200,
            })) as never
    );
    const updates: string[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderReview("", {
      client,
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    failProfile = false;
    await client.refetchQueries({ queryKey: ["ux-reset-saved-profile"] });
    await waitFor(() =>
      expect(
        screen.getByTestId("review-scope-results").dataset.renderedScope
      ).toBe("ALL")
    );
    expect({
      loading: screen.queryByText("Loading review scope…"),
      national: Boolean(screen.queryByTestId("review-national-orientation")),
      panel: screen.queryByTestId("review-state-panel"),
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      scopeWrites: updates.some((query) => query.includes("scope=CO")),
    }).toStrictEqual({
      loading: null,
      national: true,
      panel: null,
      saves: 0,
      scopeWrites: false,
    });
  });

  it("writes an explicit scope once startup settles", async () => {
    const rows = [
      {
        id: "state-default",
        error: false,
        pick: null,
        profile: { starting_view_version: 1, state_code: "CO" },
        refetch: { state_code: "NY" },
        back: false,
        settledScope: "CO",
        afterScope: "CO",
        forwardScope: "",
        history: "replace",
        later: "CO",
      },
      {
        id: "no-default",
        error: false,
        pick: null,
        profile: null,
        refetch: { state_code: "CO" },
        back: false,
        settledScope: "ALL",
        afterScope: "ALL",
        forwardScope: "",
        history: "replace",
        later: "ALL",
      },
      {
        id: "national-default",
        error: false,
        pick: null,
        profile: { state_code: null },
        refetch: { state_code: "CO" },
        back: false,
        settledScope: "ALL",
        afterScope: "ALL",
        forwardScope: "",
        history: "replace",
        later: "ALL",
      },
      {
        id: "read-failure",
        error: true,
        pick: null,
        profile: null,
        refetch: { state_code: "CO" },
        back: false,
        settledScope: "ALL",
        afterScope: "ALL",
        forwardScope: "",
        history: "replace",
        later: "ALL",
      },
      {
        id: "invalid-state",
        error: false,
        pick: null,
        profile: { state_code: "ZZ" },
        refetch: { state_code: "CO" },
        back: false,
        settledScope: "ALL",
        afterScope: "ALL",
        forwardScope: "",
        history: "replace",
        later: "ALL",
      },
      {
        id: "pick-state",
        error: false,
        pick: "New York (NY)" as const,
        profile: { state_code: "CO" },
        refetch: null,
        back: false,
        settledScope: "NY",
        afterScope: "NY",
        forwardScope: "",
        history: "push",
        later: "NY",
      },
      {
        id: "pick-national",
        error: false,
        pick: "United States" as const,
        profile: { state_code: "CO" },
        refetch: null,
        back: false,
        settledScope: "ALL",
        afterScope: "ALL",
        forwardScope: "",
        history: "push",
        later: "ALL",
      },
      {
        id: "back-then-forward",
        error: false,
        pick: "New York (NY)" as const,
        profile: { starting_view_version: 1, state_code: "CO" },
        refetch: null,
        back: true,
        settledScope: "CO",
        afterScope: "CO",
        forwardScope: "NY",
        history: "replace",
        later: "NY",
      },
    ];
    const observed = [];
    for (const row of rows) {
      cleanup();
      observed.push({
        id: row.id,
        ...(await observeSettledStartup(row)),
      });
    }
    expect(observed).toStrictEqual(
      rows.map((row) => ({
        kept: true,
        history: row.history,
        id: row.id,
        later: row.later,
        laterRendered: row.forwardScope || row.afterScope,
        rendered: row.settledScope,
        saves: 0,
        scope: row.settledScope,
      }))
    );
  });

  it("keeps the resolved state when a later profile refetch returns a different state", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    const { getProfileV1MeProfileGet, saveProfileV1MeProfilePut } =
      await import("@/generated/atlas");
    const geometry = vi.mocked(fetchCountyDisplayGeometry);
    geometry.mockResolvedValue({
      features: [
        {
          geometry: { coordinates: [-104.8, 39.8], type: "Point" },
          properties: { fips: "08001" },
          type: "Feature",
        },
        {
          geometry: { coordinates: [-73.9, 42.6], type: "Point" },
          properties: { fips: "36001" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    let profileState = "CO";
    vi.mocked(getProfileV1MeProfileGet).mockImplementation(
      () =>
        Promise.resolve({
          data: {
            profile: { starting_view_version: 1, state_code: profileState },
          },
          status: 200,
        }) as never
    );
    const updates: string[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    try {
      renderReview("", {
        client,
        onUrlUpdate: (query) => {
          updates.push(query);
        },
      });
      await waitFor(() =>
        expect(
          screen.getByTestId("review-scope-results").dataset.renderedScope
        ).toBe("CO")
      );
      const candidateText = () =>
        screen
          .getAllByTestId("review-candidate")
          .map((candidate) => candidate.textContent ?? "")
          .join(" ");
      await waitFor(() => expect(candidateText()).toContain("Denver"));
      profileState = "NY";
      await client.refetchQueries({ queryKey: ["ux-reset-saved-profile"] });
      await waitFor(() =>
        expect(screen.getByTestId("mock-atlas-map").dataset.mapScoreFips).toBe(
          "08001"
        )
      );
      expect({
        albany: screen.queryByText("Albany"),
        handoff: screen.getByTestId("review-investigate").getAttribute("href"),
        list: candidateText(),
        loading: screen.queryByText("Loading review scope…"),
        rendered: screen.getByTestId("review-scope-results").dataset
          .renderedScope,
        saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
        url: updates.at(-1) ?? "",
      }).toStrictEqual({
        albany: null,
        handoff: expect.stringContaining("scope=CO"),
        list: expect.stringContaining("Denver"),
        loading: null,
        rendered: "CO",
        saves: 0,
        url: expect.stringContaining("scope=CO"),
      });
    } finally {
      geometry.mockResolvedValue({
        features: [],
        type: "FeatureCollection",
      });
    }
  });

  it("rewrites an invalid scope to national without applying the profile state", async () => {
    const {
      getProfileV1MeProfileGet,
      saveProfileV1MeProfilePut,
      stateReviewV1StatesStateReviewGet,
    } = await import("@/generated/atlas");
    vi.mocked(getProfileV1MeProfileGet).mockResolvedValue({
      data: { profile: { starting_view_version: 1, state_code: "CO" } },
      status: 200,
    } as never);
    vi.mocked(stateReviewV1StatesStateReviewGet).mockClear();
    const updates: string[] = [];
    renderReview("?scope=NOT", {
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId("review-national-orientation")).toBeTruthy()
    );
    expect({
      panel: screen.queryByTestId("review-state-panel"),
      reviewCalls: vi.mocked(stateReviewV1StatesStateReviewGet).mock.calls
        .length,
      saves: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      status: screen.getByTestId("review-scope-status").textContent,
      updates,
    }).toStrictEqual({
      panel: null,
      reviewCalls: 0,
      saves: 0,
      status: expect.stringContaining("United States"),
      updates: [expect.stringContaining("scope=ALL")],
    });
  });

  it("does not request a review for an unrecognized state code", async () => {
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    vi.mocked(stateReviewV1StatesStateReviewGet).mockClear();
    renderReview("?scope=ZZ");
    await waitFor(() =>
      expect(screen.getByTestId("review-scope-unsupported").textContent).toBe(
        "ZZ is not supported — lower 48 only."
      )
    );
    expect({
      national: screen.queryByTestId("review-national-orientation"),
      requestScope: screen.getByTestId("review-scope-status").dataset
        .requestScope,
      reviewCalls: vi.mocked(stateReviewV1StatesStateReviewGet).mock.calls
        .length,
    }).toStrictEqual({
      national: null,
      requestScope: "ZZ",
      reviewCalls: 0,
    });
  });

  it("keeps URL, list, map, and handoff on the new scope when a prior review arrives late", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    const { stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
      features: [
        {
          geometry: { coordinates: [-104.8, 39.8], type: "Point" },
          properties: { fips: "08001" },
          type: "Feature",
        },
        {
          geometry: { coordinates: [-73.9, 42.6], type: "Point" },
          properties: { fips: "36001" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    const pending: { resolve: () => void; state: string }[] = [];
    review.mockImplementation(((
      state: string,
      params?: { dataset_version?: string }
    ) => {
      const held = Promise.withResolvers<{
        data: ReturnType<typeof defaultReviewForState>;
        status: 200;
      }>();
      pending.push({
        resolve: () => {
          held.resolve(defaultStateReviewResponse(state, params));
        },
        state,
      });
      return held.promise;
    }) as never);
    const updates: string[] = [];
    try {
      renderReview("?scope=CO", {
        onUrlUpdate: (query) => {
          updates.push(query);
        },
      });
      await waitFor(() =>
        expect(pending.some((entry) => entry.state === "CO")).toBeTruthy()
      );
      fireEvent.click(screen.getByTestId("review-scope-select"));
      const newYork = await screen.findByRole("option", {
        name: "New York (NY)",
      });
      fireEvent.pointerDown(newYork, { pointerType: "mouse" });
      fireEvent.click(newYork);
      await waitFor(() =>
        expect(pending.some((entry) => entry.state === "NY")).toBeTruthy()
      );
      pending.find((entry) => entry.state === "NY")?.resolve();
      await waitFor(() =>
        expect(screen.getByTestId("review-candidate").textContent).toContain(
          "Albany"
        )
      );
      pending.find((entry) => entry.state === "CO")?.resolve();
      await waitFor(() =>
        expect(
          screen.getByTestId("review-investigate").getAttribute("href")
        ).toContain("scope=NY")
      );
      expect({
        denver: screen.queryByText("Denver"),
        handoff: screen.getByTestId("review-investigate").getAttribute("href"),
        list: screen.getByTestId("review-candidate").textContent,
        map: screen.getByTestId("mock-atlas-map").dataset.mapScoreFips,
        rendered: screen.getByTestId("review-scope-results").dataset
          .renderedScope,
        status: screen.getByTestId("review-scope-status").textContent,
        url: updates.at(-1) ?? "",
      }).toStrictEqual({
        denver: null,
        handoff: expect.stringContaining("scope=NY"),
        list: expect.stringContaining("Albany"),
        map: "36001",
        rendered: "NY",
        status: expect.stringContaining("New York"),
        url: expect.stringContaining("scope=NY"),
      });
      expect(
        screen.getByTestId("review-investigate").getAttribute("href")
      ).toContain("county=36001");
      expect(
        screen.getByTestId("mock-atlas-map").dataset.mapScoreFips
      ).not.toContain("08001");
    } finally {
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
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

  it("passes only in-state geometry to the map", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
      features: [
        {
          geometry: { coordinates: [-104.8, 39.8], type: "Point" },
          properties: { fips: "08001" },
          type: "Feature",
        },
        {
          geometry: { coordinates: [-104.9, 39.7], type: "Point" },
          properties: { fips: "08031" },
          type: "Feature",
        },
        {
          geometry: { coordinates: [-73.9, 42.6], type: "Point" },
          properties: { fips: "36001" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    renderReview("?scope=CO");
    await waitFor(() =>
      expect(screen.getByTestId("mock-atlas-map")).toBeTruthy()
    );
    expect(lastMapScoreFips).toBe("08001,08031");
  });

  it("rejects out-of-state map selection", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    vi.mocked(fetchCountyDisplayGeometry).mockResolvedValue({
      features: [
        {
          geometry: { coordinates: [-104.8, 39.8], type: "Point" },
          properties: { fips: "08001" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
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

  it("does not consume return focus until a later Review mount", async () => {
    const selected = reviewScopeScoresFixture.counties[0];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const panel = (
      <QueryClientProvider client={client}>
        <ReviewStatePanel
          county={selected.fips}
          mapCounties={[selected]}
          period="2023-01-01"
          rankedCounties={[selected]}
          releaseId="alpha-2026"
          scopeCode="CO"
        />
      </QueryClientProvider>
    );
    const view = render(panel);
    markReviewReturnFocus(selected.fips);
    view.rerender(panel);
    expect(sessionStorage.getItem("ux-reset-review-return-focus")).toBe(
      selected.fips
    );
    expect(
      document.activeElement instanceof HTMLElement
        ? (document.activeElement.dataset.fips ?? null)
        : null
    ).toBeNull();

    view.unmount();
    render(panel);
    await waitFor(() => {
      const focused = document.activeElement;
      expect(focused instanceof HTMLElement ? focused.dataset.fips : null).toBe(
        selected.fips
      );
    });
    expect(sessionStorage.getItem("ux-reset-review-return-focus")).toBeNull();
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
        /\/explore\?.*county=08013.*mode=evidence.*period=2023-01-01.*scope=CO|scope=CO.*county=08013.*period=2023-01-01.*mode=evidence/
      ),
      label: "County evidence",
      panel: true,
      target: href,
      why: "Boulder is included because the review method returned it.",
    });
    expect(
      screen.getByTestId("review-preview-qualification").textContent
    ).toContain("Limited");
    expect(
      screen.getByTestId("review-preview-qualification").textContent
    ).not.toContain("Collection dates are unavailable");
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
        target: expect.not.stringContaining("county="),
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
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
    const limitedNote = screen.queryByRole("note");
    const limitedText =
      screen.getByTestId("review-preview-qualification").textContent ?? "";
    const limitedWhy = screen.getByTestId("review-preview-why").textContent;
    view.rerender(panel(suppressed));
    const suppressedLabel = screen.getByTestId(
      "review-preview-qualification"
    ).textContent;
    const suppressedReason = screen.queryByRole("note");
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
      limitedNote: null,
      limitedText: expect.stringContaining("Limited"),
      limitedWhy: "Lower review priority",
      partialBadge: "Limited",
      suppressedLabel: expect.stringContaining(
        "Suppressed or privacy-protected"
      ),
      suppressedReason: null,
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
        "The list page stays on Atlas Explorer browse. Browser Back returns to it.Sort stays on Atlas Explorer browse and is not copied into county evidence.",
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
      const ask = new URL(href("Ask Atlas"), "http://localhost");
      ask.searchParams.delete("page_ref");
      const askQuery = ask.searchParams.toString();
      return {
        ask: askQuery ? `${ask.pathname}?${askQuery}` : ask.pathname,
        compare: href("Compare"),
        feed: href("Research & News"),
        settings: href("Settings"),
      };
    };
    const linksFor = (releaseId: string, county: string | null) => {
      const query = county
        ? `scope=CO&county=${county}&dataset=${releaseId}&period=${period}`
        : `scope=CO&dataset=${releaseId}&period=${period}`;
      const ask = county
        ? `/askatlas?county=${county}&dataset=${releaseId}`
        : `/askatlas?dataset=${releaseId}`;
      return {
        ask,
        compare: `/compare?${query}`,
        feed: "/app/feed",
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
            searchParams={new URL(`http://localhost/explore?${search}`).search}
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
      const expected = linksFor(releaseId, county);
      await waitFor(() => {
        const links = shellLinks();
        if (links.compare !== expected.compare || links.ask !== expected.ask) {
          throw new Error(`${links.compare} | ${links.ask}`);
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
      const noneStandOut = await settle(activeRelease, "08001");
      mode = "insufficient";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const insufficient = await settle(activeRelease, "08001");
      mode = "gaps";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const unsupportedWithGaps = await settle(activeRelease, "08001");
      mode = "unsupported";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const unsupportedWithoutGaps = await settle(activeRelease, "08001");
      mode = "candidates";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const candidates = await settle(activeRelease, "08001");
      mode = "none";
      await loading.client.invalidateQueries({
        queryKey: ["ux-reset-state-review"],
      });
      const afterEmptySwitch = await settle(activeRelease, "08001");
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
        afterEmptySwitch: linksFor("release-a", "08001"),
        afterReload: linksFor("release-a", null),
        afterRollover: linksFor("release-b", null),
        candidates: linksFor("release-a", "08001"),
        insufficient: linksFor("release-a", "08001"),
        noneStandOut: linksFor("release-a", "08001"),
        unsupportedWithGaps: linksFor("release-a", "08001"),
        unsupportedWithoutGaps: linksFor("release-a", "08001"),
        whileFailed: {
          ask: "/askatlas?county=08001",
          compare: `/compare?scope=CO&county=08001&period=${period}`,
          feed: "/app/feed",
          settings: "/app/settings",
        },
        whileLoading: {
          ask: "/askatlas?county=08001",
          compare: `/compare?scope=CO&county=08001&period=${period}`,
          feed: "/app/feed",
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
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    renderReview("?scope=NY&county=36001&dataset=alpha-2026");
    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );
    expect(
      screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
        .dataset.sufficiency
    ).toBe("SUFFICIENT");
  });

  it("shows the current Tier 1 batch on a historical review dataset", async () => {
    reviewReleaseControls.metadataReleaseId = "historical-2024";
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    renderReview("?scope=NY&county=36001&dataset=historical-2024");
    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );
    const region = screen.getByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    expect({
      low: /\bLOW\b/.test(region.textContent ?? ""),
      state: region.dataset.state,
      sufficiency: region.dataset.sufficiency,
    }).toStrictEqual({
      low: false,
      state: "ready",
      sufficiency: "SUFFICIENT",
    });
    expect(region.textContent).not.toContain("Not shown for this page release");
    expect(region.textContent).not.toContain("Not on this release");
  });

  it("keeps the Tier 1 tier when the same review county changes release", async () => {
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = renderReview("?scope=NY&county=36001&dataset=alpha-2026", {
      client,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );
    reviewReleaseControls.metadataReleaseId = "historical-2024";
    view.rerenderSearch("?scope=NY&county=36001&dataset=historical-2024");
    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );
    const region = screen.getByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    expect(region.dataset.state).toBe("ready");
    expect(region.textContent).toMatch(/\bHIGH\b/);
    expect(region.textContent).not.toMatch(/\bLOW\b/);
    expect(region.textContent).not.toContain("Not shown for this page release");
  });

  it("shows a Tier 1 result when review release metadata fails", async () => {
    reviewReleaseControls.metadataStatus = 503;
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    renderReview("?scope=NY&county=36001&dataset=older-release");
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.tier
      ).toBe("HIGH")
    );
    const region = screen.getByTestId("tier1-surveillance-priority");
    expect({
      low: /\bLOW\b/.test(region.textContent ?? ""),
      state: region.dataset.state,
      sufficiency: region.dataset.sufficiency,
    }).toStrictEqual({
      low: false,
      state: "result",
      sufficiency: "SUFFICIENT",
    });
    expect(region.textContent).not.toContain("Not on this release");
  });

  it("keeps a matched tier when a metadata refetch fails in the same client", async () => {
    reviewReleaseControls.tier1Result = tier1PriorityForCounty(
      tier1HighSufficientFixture,
      "36001"
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderReview("?scope=NY&county=36001&dataset=alpha-2026", { client });
    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );

    reviewReleaseControls.metadataStatus = 503;
    await client.refetchQueries({
      queryKey: ["ux-reset-review-metadata"],
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("surveillance-intelligence-card-ml-review-priority")
          .dataset.tier
      ).toBe("HIGH")
    );
    const legend =
      screen.queryByTestId("explorer-ml-priority-legend")?.textContent ?? "";
    const pageText = (document.body.textContent ?? "").replace(legend, "");
    const region = screen.getByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    expect({
      high: /\bHIGH\b/.test(pageText),
      low: /\bLOW\b/.test(pageText),
      panels: screen.getAllByTestId(
        "surveillance-intelligence-card-ml-review-priority"
      ).length,
      state: region.dataset.state,
      sufficiency: region.dataset.sufficiency,
    }).toStrictEqual({
      high: true,
      low: false,
      panels: 1,
      state: "ready",
      sufficiency: "SUFFICIENT",
    });
    expect(pageText).not.toContain("Not shown for this page release");
    expect(pageText).not.toContain("Not on this release");
  });

  it("does not mix reproducibility identifiers across scope or release changes", async () => {
    const { metadataV1AtlasMetadataGet, stateReviewV1StatesStateReviewGet } =
      await import("@/generated/atlas");
    const metadata = vi.mocked(metadataV1AtlasMetadataGet);
    const review = vi.mocked(stateReviewV1StatesStateReviewGet);
    const hashFor = (seed: string) => seed.repeat(64);
    const coloradoHash = hashFor("a");
    const newYorkHash = hashFor("b");
    const releaseHash = hashFor("c");
    const coloradoEvaluatedAt = "2026-01-15T16:30:00.000Z";
    const newYorkEvaluatedAt = "2026-02-16T17:31:00.000Z";
    const releaseEvaluatedAt = "2026-03-17T18:32:00.000Z";
    const gap = {
      code: "SOURCE_NATIVE_LINEAGE_UNAVAILABLE",
      county_fips: "36001",
      detail: "Eligible evidence is missing for this county.",
    };
    const reviewBody = (state: string, dataset: string) => {
      if (dataset === "release-b") {
        return {
          ...buildStateReview({
            gaps: [gap],
            resultState: "insufficient_evidence" as const,
            state,
          }),
          configuration_sha256: releaseHash,
          data_release_version: dataset,
          effective_observation_context: "Human snapshot 2024",
          evaluated_at: releaseEvaluatedAt,
          scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
          methodology_version: "2.0.0",
        };
      }
      if (state === "NY") {
        return {
          ...buildStateReview({
            resultState: "none_stand_out",
            state,
          }),
          configuration_sha256: newYorkHash,
          data_release_version: dataset,
          effective_observation_context: "Human snapshot 2022",
          evaluated_at: newYorkEvaluatedAt,
          scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
          methodology_version: "1.1.0",
        };
      }
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
          state,
        }),
        configuration_sha256: coloradoHash,
        data_release_version: dataset,
        evaluated_at: coloradoEvaluatedAt,
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
        methodology_version: "1.0.0",
      };
    };
    let held: PromiseWithResolvers<undefined> | null = null;
    const holdReviews = () => {
      held = Promise.withResolvers<undefined>();
    };
    const releaseHold = () => {
      held?.resolve();
      held = null;
    };
    metadata.mockImplementation(
      async (params?: { dataset_version?: string }) =>
        ({
          data: {
            ...reviewScopeMetadataFixture,
            release_id: params?.dataset_version ?? "alpha-2026",
          },
          status: 200,
        }) as never
    );
    review.mockImplementation((async (
      state: string,
      params?: { dataset_version?: string }
    ) => {
      const dataset = params?.dataset_version ?? "alpha-2026";
      if (held) {
        await held.promise;
      }
      return {
        data: reviewBody(state, dataset),
        status: 200,
      };
    }) as never);
    const read = () => {
      const provenance = screen.getByTestId("review-result-provenance");
      const outer = provenance.querySelector("details");
      if (outer instanceof HTMLDetailsElement && !outer.open) {
        fireEvent.click(within(provenance).getByText("Inspect provenance"));
      }
      const technical = provenance.querySelector(
        ".ux-reset-evidence-provenance-technical"
      );
      if (technical instanceof HTMLDetailsElement && !technical.open) {
        fireEvent.click(
          within(provenance).getByText("Technical reproducibility identifiers")
        );
      }
      const value = (label: string) =>
        within(provenance).getByText(label).nextElementSibling?.textContent ??
        "";
      return {
        configuration: value("Configuration"),
        evaluatedAt: value("Evaluated at"),
        header: (screen.getByTestId("review-methodology").textContent ?? "")
          .replaceAll(/\s+/g, " ")
          .trim(),
        picture:
          screen.getByTestId("review-state-panel").dataset.resultState ?? null,
      };
    };
    const absent = () => ({
      colorado: document.body.textContent?.includes(coloradoHash) ?? false,
      newYork: document.body.textContent?.includes(newYorkHash) ?? false,
      panel: screen.queryByTestId("review-state-panel") !== null,
      release: document.body.textContent?.includes(releaseHash) ?? false,
    });
    try {
      const view = renderReview("?scope=CO&dataset=alpha-2026");
      await waitFor(() => {
        expect(
          screen.getByTestId("review-state-panel").dataset.configurationSha256
        ).toBe(coloradoHash);
      });
      const colorado = read();
      holdReviews();
      fireEvent.click(screen.getByTestId("review-scope-select"));
      const newYork = await screen.findByRole("option", {
        name: "New York (NY)",
      });
      fireEvent.pointerDown(newYork, { pointerType: "mouse" });
      fireEvent.click(newYork);
      await waitFor(() => {
        expect(screen.getByText("Loading review results…")).toBeTruthy();
      });
      const whileScopeChanges = absent();
      releaseHold();
      await waitFor(() => {
        expect(
          screen.getByTestId("review-state-panel").dataset.configurationSha256
        ).toBe(newYorkHash);
      });
      const newYorkResult = read();
      holdReviews();
      view.rerenderSearch("?scope=NY&dataset=release-b");
      await waitFor(() => {
        expect(screen.getByText("Loading review results…")).toBeTruthy();
      });
      const whileReleaseChanges = absent();
      releaseHold();
      await waitFor(() => {
        expect(
          screen.getByTestId("review-state-panel").dataset.configurationSha256
        ).toBe(releaseHash);
      });
      const releaseResult = read();
      view.unmount();
      expect({
        colorado,
        newYorkResult,
        releaseResult,
        whileReleaseChanges,
        whileScopeChanges,
      }).toStrictEqual({
        colorado: {
          configuration: coloradoHash,
          evaluatedAt: expect.stringContaining(coloradoEvaluatedAt),
          header:
            "Method atlas-county-review 1.0.0. Release alpha-2026. Current cumulative county status; human snapshot 2023.",
          picture: "candidates_found",
        },
        newYorkResult: {
          configuration: newYorkHash,
          evaluatedAt: expect.stringContaining(newYorkEvaluatedAt),
          header:
            "Method atlas-county-review 1.1.0. Release alpha-2026. Human snapshot 2022.",
          picture: "none_stand_out",
        },
        releaseResult: {
          configuration: releaseHash,
          evaluatedAt: expect.stringContaining(releaseEvaluatedAt),
          header:
            "Method atlas-county-review 2.0.0. Release release-b. Human snapshot 2024.",
          picture: "insufficient_evidence",
        },
        whileReleaseChanges: {
          colorado: false,
          newYork: false,
          panel: false,
          release: false,
        },
        whileScopeChanges: {
          colorado: false,
          newYork: false,
          panel: false,
          release: false,
        },
      });
    } finally {
      releaseHold();
      metadata.mockImplementation(async () => defaultMetadataResponse());
      review.mockImplementation(
        async (state: string, params?: { dataset_version?: string }) =>
          defaultStateReviewResponse(state, params)
      );
    }
  });

  it("opens a listed state from the scope control without writing Settings", async () => {
    const { saveProfileV1MeProfilePut } = await import("@/generated/atlas");
    const save = vi.mocked(saveProfileV1MeProfilePut);
    save.mockClear();
    renderReview("?scope=ALL");
    await screen.findByTestId("review-national-orientation");
    expect(screen.queryByText(/49 of 49 states/)).toBeNull();
    await chooseReviewScopeOption("Colorado (CO)");
    await waitFor(() => {
      expect(renderedReviewScope()).toBe("CO");
    });
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId("review-national-orientation")).toBeNull();
    expect(screen.queryByTestId("review-state-panel")).toBeTruthy();
  });

  it("keeps the visible national county on Ask Atlas without a page reference", async () => {
    const search = "scope=ALL&county=08001&dataset=alpha-2026";
    mockedSearch = search;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter hasMemory searchParams={`?${search}`}>
          <ResetProfessionalShell>
            <ResetReviewExperience />
          </ResetProfessionalShell>
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("review-published-county-preview").dataset.fips
      ).toBe("08001");
    });
    expect(
      screen
        .getByTestId("review-published-county-preview")
        .querySelector("[data-testid='review-ask-atlas']")
    ).toBeNull();
    const dedicatedAsk = () => {
      const navigation = screen.getByRole("navigation", {
        name: "Professional workspace",
      });
      const href = new URL(
        navigation
          .querySelector('a[aria-label="Ask Atlas"]')
          ?.getAttribute("href") ?? "",
        "http://localhost"
      );
      return {
        county: href.searchParams.get("county"),
        pageRef: href.searchParams.get("page_ref"),
      };
    };
    await waitFor(() => {
      const link = dedicatedAsk();
      if (link.county !== "08001" || link.pageRef !== null) {
        throw new Error(`${link.county ?? "missing"} ${link.pageRef ?? ""}`);
      }
    });
    const bookmarked = dedicatedAsk();
    expect({
      bookmarkPageRef: bookmarked.pageRef,
      bookmarkPreviewCounty: bookmarked.county,
    }).toStrictEqual({
      bookmarkPageRef: null,
      bookmarkPreviewCounty: "08001",
    });

    const boulder = screen
      .getAllByTestId("national-published-county")
      .find((row) => row.dataset.fips === "08013");
    if (!boulder) {
      throw new Error("Boulder was not in the national county list");
    }
    fireEvent.click(boulder);
    await waitFor(() => {
      const chosen = dedicatedAsk();
      if (chosen.county !== "08013") {
        throw new Error(chosen.county ?? "missing county");
      }
    });
    expect(
      screen
        .getByTestId("review-published-county-preview")
        .querySelector("[data-testid='review-ask-atlas']")
    ).toBeNull();
    const chosen = dedicatedAsk();
    expect({
      launcherCounty: chosen.county,
      pageRef: chosen.pageRef,
      previewFips: screen.getByTestId("review-published-county-preview").dataset
        .fips,
    }).toStrictEqual({
      launcherCounty: "08013",
      pageRef: null,
      previewFips: "08013",
    });
  });

  it("keeps a national county selection on the United States map", async () => {
    const { fetchCountyDisplayGeometry } =
      await import("@/lib/county-geography");
    const geometry = vi.mocked(fetchCountyDisplayGeometry);
    geometry.mockResolvedValue({
      features: [
        {
          geometry: {
            coordinates: [
              [
                [-105, 39],
                [-104, 39],
                [-104, 40],
                [-105, 40],
                [-105, 39],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "08001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-74, 42],
                [-73, 42],
                [-73, 43],
                [-74, 43],
                [-74, 42],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "36001" },
          type: "Feature",
        },
        {
          geometry: {
            coordinates: [
              [
                [-150, 60],
                [-149, 60],
                [-149, 61],
                [-150, 61],
                [-150, 60],
              ],
            ],
            type: "Polygon",
          },
          properties: { fips: "02013" },
          type: "Feature",
        },
      ],
      type: "FeatureCollection",
    });
    const updates: string[] = [];
    try {
      renderReview("?scope=ALL", {
        onUrlUpdate: (query) => {
          updates.push(query);
        },
      });
      await waitFor(() => {
        const fips =
          screen.getByTestId("mock-atlas-map").dataset.mapScoreFips ?? "";
        expect(fips).toContain("08001");
        expect(fips).toContain("36001");
        expect(fips).not.toContain("02013");
      });
      fireEvent.click(
        screen.getByRole("button", { name: "About Gap review score" })
      );
      expect(
        screen.getByRole("dialog", { name: "About Gap review score" })
          .textContent
      ).toContain("closer surveillance review");
      expect(screen.getByTestId("explorer-fit-national")).toBeTruthy();
      expect(screen.getByTestId("explorer-preview-empty")).toBeTruthy();
      fireEvent.click(screen.getByTestId("mock-map-select-ny"));
      await waitFor(() => {
        expect(
          updates.some((query) => query.includes("focus=NY"))
        ).toBeTruthy();
      });
      expect(
        updates.some((query) => query.includes("county=36001"))
      ).toBeFalsy();
      fireEvent.click(screen.getByTestId("mock-map-select-ny"));
      await waitFor(() => {
        expect(
          updates.some((query) => query.includes("county=36001"))
        ).toBeTruthy();
      });
      expect({
        national: Boolean(screen.queryByTestId("review-national-orientation")),
        rendered: renderedReviewScope(),
        scope: updates.some((query) => query.includes("scope=NY")),
      }).toStrictEqual({
        national: true,
        rendered: "ALL",
        scope: false,
      });
    } finally {
      geometry.mockResolvedValue({
        features: [],
        type: "FeatureCollection",
      });
    }
  });

  it("returns a state county to national scope without saving the starting view", async () => {
    const { saveProfileV1MeProfilePut } = await import("@/generated/atlas");
    const updates: string[] = [];
    renderReview("?scope=CO&county=08013&layer=boundaries&eco=55", {
      onUrlUpdate: (query) => {
        updates.push(query);
      },
    });
    const usView = await screen.findByRole("button", { name: "US view" });
    const fit = screen.getByRole("button", { name: "Fit CO (Colorado)" });
    expect({
      fill: usView.querySelector("svg")?.getAttribute("fill"),
      following:
        usView.compareDocumentPosition(fit) ===
        Node.DOCUMENT_POSITION_FOLLOWING,
      paths: usView.querySelectorAll("svg path").length,
      stroke: usView.querySelector("svg")?.getAttribute("stroke") ?? null,
    }).toStrictEqual({
      fill: "currentColor",
      following: true,
      paths: 1,
      stroke: null,
    });
    fireEvent.click(usView);
    await waitFor(() => {
      if (!screen.queryByTestId("review-national-orientation")) {
        throw new Error("national scope is not showing");
      }
    });
    const latest = updates.at(-1) ?? "";
    expect({
      county: latest.includes("county="),
      eco: latest.includes("eco=55"),
      focus: latest.includes("focus="),
      layer: latest.includes("layer=boundaries"),
      preview: screen.queryByTestId("review-published-county-preview"),
      profileWrites: vi.mocked(saveProfileV1MeProfilePut).mock.calls.length,
      rankings: screen
        .getAllByTestId("national-published-county")
        .map((row) => row.dataset.fips)
        .toSorted(),
      scope: latest.includes("scope=ALL"),
      scopeLabel: screen.getByTestId("review-scope-select").textContent,
    }).toStrictEqual({
      county: false,
      eco: true,
      focus: false,
      layer: true,
      preview: null,
      profileWrites: 0,
      rankings: ["08001", "08013", "36001"],
      scope: true,
      scopeLabel: expect.stringContaining("United States"),
    });
  });

  it("refits the national map from a zoomed country view and keeps the layer", async () => {
    const updates: string[] = [];
    await installNationalGeometry();
    try {
      renderReview("?scope=ALL&layer=boundaries", {
        onUrlUpdate: (query) => {
          updates.push(query);
        },
      });
      const map = await screen.findByTestId("mock-atlas-map");
      expect(map.dataset.fitSignal).toBe("0");
      fireEvent.click(screen.getByRole("button", { name: "US view" }));
      await waitFor(() => {
        if (screen.getByTestId("mock-atlas-map").dataset.fitSignal !== "1") {
          throw new Error("US view did not request a national fit");
        }
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Fit geography (United States)" })
      );
      await waitFor(() => {
        if (screen.getByTestId("mock-atlas-map").dataset.fitSignal !== "2") {
          throw new Error("Fit geography did not request another fit");
        }
      });
      expect({
        layer: screen.getByTestId("explorer-map-layer").textContent,
        scopeWrites: updates.some((query) => query.includes("scope=")),
      }).toStrictEqual({
        layer: expect.stringContaining("County boundaries"),
        scopeWrites: false,
      });
    } finally {
      await clearNationalGeometry();
    }
  });

  it("clears a focused state and county and restores national rankings", async () => {
    const updates: string[] = [];
    await installNationalGeometry();
    try {
      renderReview("?scope=ALL&focus=CO&county=08013&layer=boundaries", {
        onUrlUpdate: (query) => {
          updates.push(query);
        },
      });
      await screen.findByTestId("mock-atlas-map");
      expect(
        screen
          .getAllByTestId("national-published-county")
          .map((row) => row.dataset.fips)
          .toSorted()
      ).toStrictEqual(["08001", "08013"]);
      fireEvent.click(screen.getByRole("button", { name: "US view" }));
      await waitFor(() => {
        const ranked = screen
          .queryAllByTestId("national-published-county")
          .map((row) => row.dataset.fips);
        if (!ranked.includes("36001")) {
          throw new Error("national rankings are not restored");
        }
      });
      const latest = updates.at(-1) ?? "";
      expect({
        county: latest.includes("county="),
        focus: latest.includes("focus="),
        layer: latest.includes("layer=boundaries"),
        rankings: screen
          .getAllByTestId("national-published-county")
          .map((row) => row.dataset.fips)
          .toSorted(),
        scope: latest.includes("scope=ALL"),
      }).toStrictEqual({
        county: false,
        focus: false,
        layer: true,
        rankings: ["08001", "08013", "36001"],
        scope: true,
      });
    } finally {
      await clearNationalGeometry();
    }
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
