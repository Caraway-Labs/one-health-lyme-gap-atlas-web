import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntelligenceFeedExperience } from "@/features/ux-reset/feed/intelligence-feed-page";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  intelligenceFeedEnvelope,
  mixedIntelligenceFeedItems,
} from "./fixtures/intelligence-feed-fixtures";

const listIntelligenceFeed = vi.hoisted(() =>
  vi.fn<
    (
      params?: { page_token?: string },
      options?: unknown
    ) => Promise<{ data: unknown; headers: Headers; status: number }>
  >()
);

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listIntelligenceFeed:
      listIntelligenceFeed as unknown as typeof actual.listIntelligenceFeed,
  };
});

const SCRIPT_URL = ["java", "script:alert(1)"].join("");

function renderFeed() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...render(<IntelligenceFeedExperience />, { wrapper }),
  };
}

function succeed(data: ReturnType<typeof intelligenceFeedEnvelope>) {
  listIntelligenceFeed.mockResolvedValue({
    data,
    headers: new Headers(),
    status: 200,
  });
}

type FeedItem = (typeof mixedIntelligenceFeedItems)[number];

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
  afterEach(() => {
    cleanup();
    listIntelligenceFeed.mockReset();
  });

  it("lists a realistic source mix and quiet missing dates", async () => {
    succeed(intelligenceFeedEnvelope(mixedIntelligenceFeedItems));
    renderFeed();

    await expect(
      screen.findByRole("heading", {
        name: /Lyme disease surveillance update/,
      })
    ).resolves.toBeTruthy();
    expect(screen.getByText("CDC")).toBeTruthy();
    expect(screen.getByText("March 2, 2026")).toBeTruthy();
    expect(screen.getByText("Publication date not provided")).toBeTruthy();
    expect(screen.getByText("Publication date withheld")).toBeTruthy();
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
    expect(
      screen.getByText(
        "Approved trusted sources have no items in this feed right now."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/fail|error|unavailable/i)).toBeNull();
    expect(screen.getByTestId("intelligence-feed").dataset.feedState).toBe(
      "empty"
    );
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
    expect(titles[0]).toContain("Lyme disease surveillance update");
    expect(titles[1]).toContain("County-level Lyme reporting, a review");
    expect(listIntelligenceFeed).toHaveBeenCalledWith(
      { page_token: "page-2" },
      expect.anything()
    );
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
});
