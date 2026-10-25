import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchParamsHolder = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));

vi.mock(import("next/navigation"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSearchParams: () =>
      searchParamsHolder.value as unknown as ReadonlyURLSearchParams,
  };
});

import { publishedFromForPreset } from "@/features/ux-reset/feed/feed-filters";
import { IntelligenceFeedExperience } from "@/features/ux-reset/feed/intelligence-feed-page";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  intelligenceFeedEnvelope,
  intelligenceSourcesEnvelope,
  mixedIntelligenceFeedItems,
} from "./fixtures/intelligence-feed-fixtures";

const listIntelligenceFeed = vi.hoisted(() =>
  vi.fn<
    (
      params?: {
        page_token?: string;
        published_from?: string;
        source_id?: string;
      },
      options?: unknown
    ) => Promise<{ data: unknown; headers: Headers; status: number }>
  >()
);

const listIntelligenceSources = vi.hoisted(() =>
  vi.fn<
    (
      params?: { page_token?: string },
      options?: unknown
    ) => Promise<{ data: unknown; headers: Headers; status: number }>
  >()
);

const trackFeedFilterApplied = vi.hoisted(() =>
  vi.fn<(dimension: string, value: string, count: number) => void>()
);
const trackFeedFilterCleared = vi.hoisted(() =>
  vi.fn<(scope: string, count: number) => void>()
);

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listIntelligenceFeed:
      listIntelligenceFeed as unknown as typeof actual.listIntelligenceFeed,
    listIntelligenceSources:
      listIntelligenceSources as unknown as typeof actual.listIntelligenceSources,
  };
});

vi.mock(import("@/lib/atlas-analytics"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    trackFeedFilterApplied,
    trackFeedFilterCleared,
  };
});

const SCRIPT_URL = ["java", "script:alert(1)"].join("");

function renderFeed(search = "", options?: { staleTime?: number }) {
  searchParamsHolder.value = new URLSearchParams(search);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: options?.staleTime ?? 0 },
    },
  });
  const urlUpdates: string[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={(event) => {
          searchParamsHolder.value = event.searchParams;
          urlUpdates.push(`${event.options.history}:${event.queryString}`);
        }}
        searchParams={search}
      >
        {children}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return {
    client,
    urlUpdates,
    ...render(<IntelligenceFeedExperience />, { wrapper }),
  };
}

function catalogRows() {
  return mixedIntelligenceFeedItems.map((item) => item.source);
}

function succeed(data: ReturnType<typeof intelligenceFeedEnvelope>) {
  listIntelligenceFeed.mockResolvedValue({
    data,
    headers: new Headers(),
    status: 200,
  });
}

type FeedItem = (typeof mixedIntelligenceFeedItems)[number];

const PRODUCTION_FEED_STALE_TIME = 300_000;

function withTitle(entry: FeedItem, title: string): FeedItem {
  return { ...entry, title };
}

async function choosePublished(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Published" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(option, { button: 0, pointerId: 1 });
  fireEvent.click(option);
}

function installStalePageFeed() {
  const from7 = publishedFromForPreset("7d", new Date());
  let defaultVisits = 0;
  listIntelligenceFeed.mockImplementation(async (params) => {
    const token = params?.page_token;
    if (params?.published_from === from7) {
      return {
        data: intelligenceFeedEnvelope(
          [withTitle(mixedIntelligenceFeedItems[2], "Seven first")],
          token ? null : "7d-1"
        ),
        headers: new Headers(),
        status: 200,
      };
    }
    if (token) {
      return {
        data: intelligenceFeedEnvelope([
          withTitle(mixedIntelligenceFeedItems[1], `Continuation ${token}`),
        ]),
        headers: new Headers(),
        status: 200,
      };
    }
    defaultVisits += 1;
    return {
      data: intelligenceFeedEnvelope(
        [withTitle(mixedIntelligenceFeedItems[0], "Default first")],
        `all-${defaultVisits}`
      ),
      headers: new Headers(),
      status: 200,
    };
  });
}

function pageTokenCalls() {
  return listIntelligenceFeed.mock.calls.filter(
    (call) => call[0]?.page_token === "page-2"
  );
}

function loadedItemTitles(): (string | null)[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

function mockNextPageFailure(
  first: FeedItem,
  second: FeedItem,
  status: 500 | 503
) {
  let attempts = 0;
  listIntelligenceFeed.mockImplementation(
    async (params?: { page_token?: string }) => {
      if (params?.page_token) {
        attempts += 1;
        if (attempts === 1) {
          throw new AtlasApiError(
            status === 503 ? "disabled" : "failed",
            "/v1/intelligence/feed",
            status,
            "req-next"
          );
        }
        return {
          data: intelligenceFeedEnvelope([second]),
          headers: new Headers(),
          status: 200,
        };
      }
      return {
        data: intelligenceFeedEnvelope([first], "page-2"),
        headers: new Headers(),
        status: 200,
      };
    }
  );
}

describe("intelligence feed page", () => {
  beforeEach(() => {
    listIntelligenceSources.mockResolvedValue({
      data: intelligenceSourcesEnvelope(catalogRows()),
      headers: new Headers(),
      status: 200,
    });
  });

  afterEach(() => {
    cleanup();
    listIntelligenceFeed.mockReset();
    listIntelligenceSources.mockReset();
    trackFeedFilterApplied.mockReset();
    trackFeedFilterCleared.mockReset();
  });

  it("lists a realistic source mix and quiet missing dates", async () => {
    succeed(intelligenceFeedEnvelope(mixedIntelligenceFeedItems));
    renderFeed();

    await expect(
      screen.findByRole("heading", {
        name: /Lyme disease surveillance update/,
      })
    ).resolves.toBeTruthy();
    expect({
      cdc: screen.getByText("CDC").textContent,
      date: screen.getByText("March 2, 2026").textContent,
      notProvided: screen.getByText("Publication date not provided")
        .textContent,
      published: screen.getByRole("combobox", { name: "Published" })
        .textContent,
      request: listIntelligenceFeed.mock.calls[0]?.[0] ?? null,
      withheld: screen.getByText("Publication date withheld").textContent,
    }).toStrictEqual({
      cdc: "CDC",
      date: "March 2, 2026",
      notProvided: "Publication date not provided",
      published: expect.stringContaining("All dates"),
      request: null,
      withheld: "Publication date withheld",
    });
  });

  it("opens publisher pages with the workspace external-link contract", async () => {
    succeed(intelligenceFeedEnvelope(mixedIntelligenceFeedItems));
    renderFeed();

    const cdc = await screen.findByRole("link", {
      name: "Lyme disease surveillance update (opens in a new tab)",
    });
    expect(cdc.getAttribute("href")).toBe(
      "https://www.cdc.gov/lyme/index.html"
    );
    expect(cdc.getAttribute("rel")).toBe("noopener noreferrer");
    expect(cdc.getAttribute("target")).toBe("_blank");
    const pubmed = screen.getByRole("link", {
      name: "County-level Lyme reporting, a review (opens in a new tab)",
    });
    expect(pubmed.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps an empty projection quiet", async () => {
    succeed(intelligenceFeedEnvelope([]));
    renderFeed();

    await expect(
      screen.findByRole("heading", { name: "No new items" })
    ).resolves.toBeTruthy();
    expect({
      alert: screen.queryByRole("alert"),
      body: Boolean(
        screen.getByText(
          "Approved trusted sources have no items in this feed right now."
        )
      ),
      failure: screen.queryByText(/fail|error|unavailable/i),
      request: listIntelligenceFeed.mock.calls[0]?.[0] ?? null,
      showAllDates: screen.queryByRole("button", { name: "Show all dates" }),
      state: screen.getByTestId("intelligence-feed").dataset.feedState,
    }).toStrictEqual({
      alert: null,
      body: true,
      failure: null,
      request: null,
      showAllDates: null,
      state: "empty",
    });
  });

  it("omits a publisher link when the canonical URL is not http(s)", async () => {
    const [cdc] = mixedIntelligenceFeedItems;
    succeed(
      intelligenceFeedEnvelope([
        {
          ...cdc,
          canonical_url: SCRIPT_URL,
          publication_date_state: "not_provided",
          published_at: null,
          title: "Guarded publisher item",
        },
      ])
    );
    renderFeed();

    await expect(
      screen.findByRole("heading", { name: "Guarded publisher item" })
    ).resolves.toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Guarded publisher item/ })
    ).toBeNull();
    expect(screen.getByText("Publication date not provided")).toBeTruthy();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
  });

  it("shows a failed request separately from an empty feed", async () => {
    listIntelligenceFeed.mockRejectedValue(
      new AtlasApiError("failed", "/v1/intelligence/feed", 500, "req-1")
    );
    renderFeed();

    await expect(
      screen.findByRole("heading", {
        name: "Intelligence feed request failed",
      })
    ).resolves.toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No new items")).toBeNull();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "error"
    );
  });

  it("shows a disabled feed as unavailable", async () => {
    listIntelligenceFeed.mockRejectedValue(
      new AtlasApiError("disabled", "/v1/intelligence/feed", 503, "req-2")
    );
    renderFeed();

    await expect(
      screen.findByRole("heading", {
        name: "Intelligence feed unavailable",
      })
    ).resolves.toBeTruthy();
    expect(
      screen.getByText(/disabled or temporarily unavailable/i)
    ).toBeTruthy();
    expect(screen.queryByText("No new items")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "unavailable"
    );
  });

  it("loads the next contract page without reordering items", async () => {
    const [first, second] = mixedIntelligenceFeedItems;
    listIntelligenceFeed.mockImplementation(
      async (params?: { page_token?: string }) => ({
        data: intelligenceFeedEnvelope(
          params?.page_token ? [second] : [first],
          params?.page_token ? null : "page-2"
        ),
        headers: new Headers(),
        status: 200,
      })
    );
    renderFeed();

    await expect(
      screen.findByRole("heading", {
        name: /Lyme disease surveillance update/,
      })
    ).resolves.toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await expect(
      screen.findByRole("heading", {
        name: /County-level Lyme reporting, a review/,
      })
    ).resolves.toBeTruthy();
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect({
      first: titles[0],
      firstRequest: listIntelligenceFeed.mock.calls[0]?.[0] ?? null,
      nextPage: listIntelligenceFeed.mock.calls.some(
        (call) =>
          call[0]?.page_token === "page-2" &&
          call[0]?.published_from === undefined
      ),
      second: titles[1],
    }).toStrictEqual({
      first: expect.stringContaining("Lyme disease surveillance update"),
      firstRequest: null,
      nextPage: true,
      second: expect.stringContaining("County-level Lyme reporting, a review"),
    });
  });

  it("keeps page one when the next page returns 500", async () => {
    const [first, second] = mixedIntelligenceFeedItems;
    mockNextPageFailure(first, second, 500);
    renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", {
      name: "More items could not be loaded",
    });
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
    expect(
      screen.queryByRole("heading", {
        name: "Intelligence feed request failed",
      })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Lyme disease surveillance update/ })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", {
      name: /County-level Lyme reporting, a review/,
    });
    expect(loadedItemTitles()).toStrictEqual([
      expect.stringContaining("Lyme disease surveillance update"),
      expect.stringContaining("County-level Lyme reporting, a review"),
    ]);
    expect(pageTokenCalls()).toHaveLength(2);
  });

  it("keeps page one when the next page returns 503", async () => {
    const [first, second] = mixedIntelligenceFeedItems;
    mockNextPageFailure(first, second, 503);
    renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", { name: "More items are unavailable" });
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
    expect(
      screen.queryByRole("heading", { name: "Intelligence feed unavailable" })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Lyme disease surveillance update/ })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", {
      name: /County-level Lyme reporting, a review/,
    });
    expect(loadedItemTitles()).toStrictEqual([
      expect.stringContaining("Lyme disease surveillance update"),
      expect.stringContaining("County-level Lyme reporting, a review"),
    ]);
    expect(pageTokenCalls()).toHaveLength(2);
  });

  it("keeps loaded items when a refresh fails", async () => {
    const [first] = mixedIntelligenceFeedItems;
    let calls = 0;
    listIntelligenceFeed.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) {
        throw new AtlasApiError(
          "failed",
          "/v1/intelligence/feed",
          500,
          "req-refresh"
        );
      }
      return {
        data: intelligenceFeedEnvelope([first]),
        headers: new Headers(),
        status: 200,
      };
    });
    const { client } = renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    await act(async () => {
      await client.refetchQueries();
    });

    await expect(
      screen.findByRole("heading", {
        name: "The feed could not be refreshed",
      })
    ).resolves.toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "The last loaded items are still shown."
    );
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
    expect(
      screen.getByRole("heading", { name: /Lyme disease surveillance update/ })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect({
        calls,
        refreshError: screen.queryByRole("heading", {
          name: "The feed could not be refreshed",
        }),
      }).toStrictEqual({ calls: 3, refreshError: null });
    });
  });

  it("keeps loaded items when a refresh is unavailable", async () => {
    const [first] = mixedIntelligenceFeedItems;
    let calls = 0;
    listIntelligenceFeed.mockImplementation(async () => {
      calls += 1;
      if (calls > 1) {
        throw new AtlasApiError(
          "disabled",
          "/v1/intelligence/feed",
          503,
          "req-refresh-unavailable"
        );
      }
      return {
        data: intelligenceFeedEnvelope([first]),
        headers: new Headers(),
        status: 200,
      };
    });
    const { client } = renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    await act(async () => {
      await client.refetchQueries();
    });

    await expect(
      screen.findByRole("heading", {
        name: "A feed refresh is unavailable",
      })
    ).resolves.toBeTruthy();
    expect(
      screen.getByText(/The last loaded items are still shown/)
    ).toBeTruthy();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
    expect(
      screen.queryByRole("heading", { name: "Intelligence feed unavailable" })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Lyme disease surveillance update/ })
    ).toBeTruthy();
  });

  it("requests the default date, chips, clear, and an empty filtered result", async () => {
    succeed(intelligenceFeedEnvelope([]));
    renderFeed("?published=7d&source=cdc-lyme");

    await screen.findByRole("heading", {
      name: "No items match these filters",
    });
    expect({
      chip: Boolean(
        screen.getByRole("button", {
          name: "Remove filter Published: Past 7 days",
        })
      ),
      defaultEmpty: screen.queryByRole("heading", { name: "No new items" }),
      help: screen.getByText(
        "Items without a publication date appear under All dates."
      ).textContent,
      summary: screen.getByText("Showing 0 items").textContent,
      wider: Boolean(
        screen.getByText("Try another source or a wider date range.")
      ),
    }).toStrictEqual({
      chip: true,
      defaultEmpty: null,
      help: "Items without a publication date appear under All dates.",
      summary: "Showing 0 items",
      wider: true,
    });
    await waitFor(() => {
      expect(listIntelligenceFeed).toHaveBeenCalledWith(
        {
          published_from: publishedFromForPreset("7d", new Date()),
          source_id: "cdc-lyme",
        },
        expect.anything()
      );
    });
  });

  it("clears filters, records analytics, and returns focus to the filter bar", async () => {
    succeed(intelligenceFeedEnvelope([]));
    const { urlUpdates } = renderFeed("?published=7d");

    await screen.findByRole("heading", {
      name: "No items in this date window",
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0]
    );
    await waitFor(() => {
      expect({
        cleared: screen.queryByRole("button", { name: "Clear filters" }),
        focus: document.activeElement,
        pushed: urlUpdates.some((update) => update.startsWith("push:")),
        tracked: trackFeedFilterCleared.mock.calls,
      }).toStrictEqual({
        cleared: null,
        focus: screen.getByRole("group", { name: "Feed filters" }),
        pushed: true,
        tracked: [["all", 0]],
      });
    });
  });

  it("shows too many items separately from a failed request", async () => {
    listIntelligenceFeed.mockRejectedValue(
      new AtlasApiError(
        "Narrow the source or publication dates.",
        "/v1/intelligence/feed",
        400,
        "req-broad",
        null,
        {
          code: "QUERY_TOO_BROAD",
          detail: "Narrow the source or publication dates.",
        }
      )
    );
    renderFeed();

    await screen.findByRole("heading", {
      name: "Too many items to show at once",
    });
    expect({
      failed: screen.queryByRole("heading", {
        name: "Intelligence feed request failed",
      }),
      guidance: Boolean(
        screen.getByText("Choose a source or a shorter date range.")
      ),
      publishedDisabled: screen
        .getByRole("combobox", { name: "Published" })
        .hasAttribute("disabled"),
      sourceDisabled: screen
        .getByRole("combobox", { name: "Source" })
        .hasAttribute("disabled"),
      state: screen.getByTestId("intelligence-feed").dataset.feedState,
    }).toStrictEqual({
      failed: null,
      guidance: true,
      publishedDisabled: false,
      sourceDisabled: false,
      state: "too-broad",
    });
  });

  it("keeps the feed usable when the source catalog fails", async () => {
    succeed(intelligenceFeedEnvelope(mixedIntelligenceFeedItems));
    listIntelligenceSources.mockRejectedValue(
      new AtlasApiError(
        "failed",
        "/v1/intelligence/sources",
        500,
        "req-sources"
      )
    );
    renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    expect(screen.getByText("Sources couldn't load")).toBeTruthy();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "ready"
    );
    const retrySources = within(screen.getByRole("status")).getByRole(
      "button",
      {
        name: "Try again",
      }
    );
    expect(retrySources.dataset.atlasAnalyticsControl).toBe(
      "feed_sources_retry"
    );
    fireEvent.click(retrySources);
    await waitFor(() => {
      expect(listIntelligenceSources.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("restarts the current filter once when Show more has a stale token", async () => {
    const [first, second] = mixedIntelligenceFeedItems;
    let bareCalls = 0;
    listIntelligenceFeed.mockImplementation(async (params) => {
      if (params?.page_token) {
        throw new AtlasApiError(
          "Projection changed; restart pagination.",
          "/v1/intelligence/feed",
          400,
          "req-stale",
          null,
          { detail: "Projection changed; restart pagination." }
        );
      }
      bareCalls += 1;
      if (bareCalls === 1) {
        return {
          data: intelligenceFeedEnvelope([first], "page-2"),
          headers: new Headers(),
          status: 200,
        };
      }
      return {
        data: intelligenceFeedEnvelope([second]),
        headers: new Headers(),
        status: 200,
      };
    });
    renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", {
      name: /County-level Lyme reporting, a review/,
    });
    expect(
      screen.queryByRole("heading", { name: "More items could not be loaded" })
    ).toBeNull();
    expect(
      screen.queryByRole("heading", {
        name: /Lyme disease surveillance update/,
      })
    ).toBeNull();
    expect(bareCalls).toBe(2);
  });

  it("shows the next-page failure when a stale-token restart also fails", async () => {
    const [first] = mixedIntelligenceFeedItems;
    let bareCalls = 0;
    listIntelligenceFeed.mockImplementation(async (params) => {
      if (params?.page_token) {
        throw new AtlasApiError(
          "Projection changed; restart pagination.",
          "/v1/intelligence/feed",
          400,
          "req-stale",
          null,
          { detail: "Projection changed; restart pagination." }
        );
      }
      bareCalls += 1;
      if (bareCalls > 1) {
        throw new AtlasApiError(
          "failed",
          "/v1/intelligence/feed",
          500,
          "req-restart"
        );
      }
      return {
        data: intelligenceFeedEnvelope([first], "page-2"),
        headers: new Headers(),
        status: 200,
      };
    });
    renderFeed();

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", {
      name: "More items could not be loaded",
    });
    expect(
      screen.getByRole("heading", { name: /Lyme disease surveillance update/ })
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", {
        name: "Intelligence feed request failed",
      })
    ).toBeNull();
  });

  it("applies a source from the catalog without sending the source id to analytics", async () => {
    succeed(intelligenceFeedEnvelope(mixedIntelligenceFeedItems));
    renderFeed();
    await screen.findByRole("combobox", { name: "Source" });
    fireEvent.click(screen.getByRole("combobox", { name: "Source" }));
    const cdc = await screen.findByRole("option", {
      name: "Centers for Disease Control and Prevention",
    });
    fireEvent.pointerDown(cdc, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(cdc, { button: 0, pointerId: 1 });
    fireEvent.click(cdc);
    await waitFor(() => {
      expect(listIntelligenceFeed).toHaveBeenCalledWith(
        expect.objectContaining({ source_id: "cdc-lyme" }),
        expect.anything()
      );
    });
    expect(trackFeedFilterApplied).toHaveBeenCalledWith(
      "feed_source",
      "source_selected",
      1
    );
    expect(JSON.stringify(trackFeedFilterApplied.mock.calls)).not.toContain(
      "cdc-lyme"
    );
    expect(screen.getByText("Showing 3 items")).toBeTruthy();
  });

  it("keeps a deep-linked source when the catalog is empty", async () => {
    listIntelligenceSources.mockResolvedValue({
      data: intelligenceSourcesEnvelope([]),
      headers: new Headers(),
      status: 200,
    });
    succeed(intelligenceFeedEnvelope([mixedIntelligenceFeedItems[0]]));
    const { urlUpdates } = renderFeed("?source=cdc-lyme");

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    expect({
      chip: Boolean(
        screen.getByRole("button", {
          name: "Remove filter Source: cdc-lyme",
        })
      ),
      source: screen.getByRole("combobox", { name: "Source" }).textContent,
      sourceIds: listIntelligenceFeed.mock.calls.map(
        (call) => call[0]?.source_id
      ),
      urlUpdates,
    }).toStrictEqual({
      chip: true,
      source: expect.stringContaining("cdc-lyme"),
      sourceIds: ["cdc-lyme"],
      urlUpdates: [],
    });
  });

  it("keeps a deep-linked source missing from a partial catalog", async () => {
    listIntelligenceSources.mockResolvedValue({
      data: intelligenceSourcesEnvelope([mixedIntelligenceFeedItems[1].source]),
      headers: new Headers(),
      status: 200,
    });
    succeed(intelligenceFeedEnvelope([mixedIntelligenceFeedItems[0]]));
    const { urlUpdates } = renderFeed("?source=cdc-lyme");

    await screen.findByRole("heading", {
      name: /Lyme disease surveillance update/,
    });
    expect(
      listIntelligenceFeed.mock.calls.every(
        (call) => call[0]?.source_id === "cdc-lyme"
      )
    ).toBeTruthy();
    expect(urlUpdates).toStrictEqual([]);
    expect(
      screen.getByRole("combobox", { name: "Source" }).textContent
    ).toContain("cdc-lyme");
  });

  it("shows undated items on the default feed and offers all dates from a short window", async () => {
    const older = {
      ...mixedIntelligenceFeedItems[0],
      published_at: "2020-01-15T00:00:00Z",
      title: "Older surveillance note",
    };
    const undated = {
      ...mixedIntelligenceFeedItems[1],
      publication_date_state: "invalid" as const,
      published_at: null,
      title: "Undated surveillance note",
    };
    listIntelligenceFeed.mockImplementation(async (params) => ({
      data: intelligenceFeedEnvelope(
        params?.published_from ? [] : [older, undated]
      ),
      headers: new Headers(),
      status: 200,
    }));
    renderFeed();

    await screen.findByRole("heading", { name: /Older surveillance note/ });
    expect({
      dateWindow: screen.queryByRole("heading", {
        name: "No items in this date window",
      }),
      missingDate: screen.getByText("Publication date not available")
        .textContent,
      request: listIntelligenceFeed.mock.calls[0]?.[0] ?? null,
      undated: screen.getByRole("heading", {
        name: /Undated surveillance note/,
      }).textContent,
    }).toStrictEqual({
      dateWindow: null,
      missingDate: "Publication date not available",
      request: null,
      undated: expect.stringContaining("Undated surveillance note"),
    });

    await choosePublished("Past 30 days");
    await screen.findByRole("heading", {
      name: "No items in this date window",
    });
    expect({
      chip: Boolean(
        screen.getByRole("button", {
          name: "Remove filter Published: Past 30 days",
        })
      ),
      publishedFrom:
        listIntelligenceFeed.mock.calls.at(-1)?.[0]?.published_from ?? null,
      state: screen.getByTestId("intelligence-feed").dataset.feedState,
      unfiltered: screen.queryByText(
        "Approved trusted sources have no items in this feed right now."
      ),
      window: Boolean(
        screen.getByText(
          "Past 30 days has no matching items. All dates includes older items and items without a publication date."
        )
      ),
    }).toStrictEqual({
      chip: true,
      publishedFrom: publishedFromForPreset("30d", new Date()),
      state: "filtered-empty",
      unfiltered: null,
      window: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Show all dates" }));
    await screen.findByRole("heading", { name: /Older surveillance note/ });
    expect({
      request:
        listIntelligenceFeed.mock.calls.at(-1)?.[0]?.published_from ?? null,
      undated: Boolean(
        screen.getByRole("heading", { name: /Undated surveillance note/ })
      ),
    }).toStrictEqual({
      request: null,
      undated: true,
    });
  });

  it("uses the unfiltered empty message only when the request does not narrow", async () => {
    succeed(intelligenceFeedEnvelope([]));
    renderFeed("?published=all");

    await screen.findByRole("heading", { name: "No new items" });
    expect(
      screen.getByText(
        "Approved trusted sources have no items in this feed right now."
      )
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "No items in this date window" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all dates" })).toBeNull();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "empty"
    );
  });

  it("resets a cached filter to page one when that filter is selected again", async () => {
    installStalePageFeed();
    renderFeed("", { staleTime: PRODUCTION_FEED_STALE_TIME });

    await screen.findByRole("heading", { name: /Default first/ });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", { name: /Continuation all-1/ });
    await choosePublished("Past 7 days");
    await screen.findByRole("heading", { name: /Seven first/ });

    const callsBeforeReturn = listIntelligenceFeed.mock.calls.length;
    await choosePublished("All dates");
    await screen.findByRole("heading", { name: /Default first/ });
    expect(
      screen.queryByRole("heading", { name: /Continuation all-1/ })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", { name: /Continuation all-2/ });
    expect(
      screen.queryByRole("heading", { name: /Continuation all-1/ })
    ).toBeNull();
    expect(
      listIntelligenceFeed.mock.calls
        .slice(callsBeforeReturn)
        .map((call) => call[0]?.page_token ?? null)
    ).toStrictEqual([null, "all-2"]);
  });

  it("resets the default filter to page one when filters are cleared", async () => {
    installStalePageFeed();
    renderFeed("", { staleTime: PRODUCTION_FEED_STALE_TIME });

    await screen.findByRole("heading", { name: /Default first/ });
    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", { name: /Continuation all-1/ });
    await choosePublished("Past 7 days");
    await screen.findByRole("heading", { name: /Seven first/ });

    const callsBeforeClear = listIntelligenceFeed.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await screen.findByRole("heading", { name: /Default first/ });
    expect(
      screen.queryByRole("heading", { name: /Continuation all-1/ })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more items" }));
    await screen.findByRole("heading", { name: /Continuation all-2/ });
    expect(
      listIntelligenceFeed.mock.calls
        .slice(callsBeforeClear)
        .map((call) => call[0]?.page_token ?? null)
    ).toStrictEqual([null, "all-2"]);
  });
});
