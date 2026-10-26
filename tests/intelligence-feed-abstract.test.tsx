import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import {
  FEED_ABSTRACT_SHOWN_MESSAGE,
  FEED_ABSTRACT_UNAVAILABLE_MESSAGE,
  FEED_ITEM_MISSING_MESSAGE,
} from "@/features/ux-reset/feed/feed-presentation";
import { IntelligenceFeedExperience } from "@/features/ux-reset/feed/intelligence-feed-page";
import type { FeedEntry } from "@/generated/models/feedEntry";
import type { FeedListEntry } from "@/generated/models/feedListEntry";
import { FeedEntryRead } from "@/generated/zod/feedEntryRead.zod";
import { MetadataFeed } from "@/generated/zod/metadataFeed.zod";
import { AtlasApiError } from "@/lib/api-mutator";
import { atlasAnalytics } from "@/lib/atlas-analytics";

import {
  intelligenceFeedDetail,
  intelligenceFeedEntry,
  intelligenceSourcesEnvelope,
} from "./fixtures/intelligence-feed-fixtures";

const listIntelligenceFeed = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: unknown; headers: Headers; status: number }>>()
);
const listIntelligenceSources = vi.hoisted(() =>
  vi.fn<() => Promise<{ data: unknown; headers: Headers; status: number }>>()
);
const trackFeedItemDetailOpened = vi.hoisted(() =>
  vi.fn<(surface: string, sourceFamily: string) => void>()
);
const getIntelligenceFeedEntry = vi.hoisted(() =>
  vi.fn<
    (
      itemId: string,
      options?: unknown
    ) => Promise<{ data: unknown; headers: Headers; status: number }>
  >()
);

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getIntelligenceFeedEntry:
      getIntelligenceFeedEntry as unknown as typeof actual.getIntelligenceFeedEntry,
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
    trackFeedItemDetailOpened,
  };
});

const COURTESY = "Courtesy of the U.S. National Library of Medicine";
const COPYRIGHT = "© 2026 Fixture Publisher.";
const PUBMED_URL = "https://pubmed.ncbi.nlm.nih.gov/12345678/";
const PRODUCTION_FEED_STALE_TIME = 300_000;

const listFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/feed-pubmed-abstracts.json"),
    "utf-8"
  )
) as { data: FeedListEntry[] };
const fullFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/fixtures/feed-pubmed-entry-full.json"),
    "utf-8"
  )
) as {
  entries: Record<string, { data: FeedEntry }>;
};

function row(title: string): FeedListEntry {
  const found = listFixture.data.find((entry) => entry.title === title);
  if (!found) {
    throw new Error(`Missing fixture row ${title}`);
  }
  return found;
}

function detail(title: string): FeedEntry {
  const entry = fullFixture.entries[row(title).item_id]?.data;
  if (!entry) {
    throw new Error(`Missing fixture detail ${title}`);
  }
  return entry;
}

function renderFeed(options?: { staleTime?: number }) {
  searchParamsHolder.value = new URLSearchParams();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: options?.staleTime ?? 0 },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory searchParams="">
        {children}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
  return render(<IntelligenceFeedExperience />, { wrapper });
}

function mockDetail(entry: FeedEntry) {
  getIntelligenceFeedEntry.mockResolvedValue({
    data: {
      data: entry,
      meta: { projection_version: "intelligence-feed-read-v2" },
    },
    headers: new Headers(),
    status: 200,
  });
}

function cardFor(title: string): HTMLElement {
  const heading = screen.getByRole("heading", {
    name: `${title} (opens in a new tab)`,
  });
  const card = heading.closest("li");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Missing card ${title}`);
  }
  return card;
}

describe("PubMed abstract previews", () => {
  beforeEach(() => {
    listIntelligenceSources.mockResolvedValue({
      data: intelligenceSourcesEnvelope([]),
      headers: new Headers(),
      status: 200,
    });
    listIntelligenceFeed.mockResolvedValue({
      data: listFixture,
      headers: new Headers(),
      status: 200,
    });
  });

  afterEach(() => {
    cleanup();
    listIntelligenceFeed.mockReset();
    listIntelligenceSources.mockReset();
    trackFeedItemDetailOpened.mockReset();
    getIntelligenceFeedEntry.mockReset();
  });

  it("parses the committed fixtures and keeps abstract off list rows", () => {
    const feedDir = path.join(process.cwd(), "src/features/ux-reset/feed");
    const names = readdirSync(feedDir);
    const listHasAbstract: "abstract" extends keyof FeedListEntry
      ? true
      : false = false;
    expect({
      cardReadsAbstract: readFileSync(
        path.join(feedDir, "feed-item-card.tsx"),
        "utf-8"
      ).includes(".abstract"),
      list: MetadataFeed.safeParse(listFixture).success,
      listHasAbstract,
      pubmedUrls: names.map((name) =>
        readFileSync(path.join(feedDir, name), "utf-8").includes(
          "pubmed.ncbi.nlm.nih.gov"
        )
      ),
      rows: listFixture.data.map((entry) => {
        const payload = fullFixture.entries[entry.item_id];
        return {
          byId: FeedEntryRead.safeParse(payload).success,
          listAbstract: Object.hasOwn(entry, "abstract"),
          previewOnById: Object.hasOwn(payload?.data ?? {}, "abstract_preview"),
        };
      }),
    }).toStrictEqual({
      cardReadsAbstract: false,
      list: true,
      listHasAbstract: false,
      pubmedUrls: names.map(() => false),
      rows: listFixture.data.map(() => ({
        byId: true,
        listAbstract: false,
        previewOnById: false,
      })),
    });
  });

  it("renders every abstract state from the list fields", async () => {
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture preview article (opens in a new tab)",
    });
    const preview = row("Fixture preview article");
    const previewCard = cardFor("Fixture preview article");
    const previewLink = within(previewCard).getByRole("link", {
      name: /View on PubMed/,
    });
    const shortCard = cardFor("Fixture short abstract");
    const emptyPreview = cardFor("Fixture empty preview");
    const other = cardFor("Fixture county surveillance");
    const quietText =
      cardFor("Fixture quiet abstract").textContent?.toLowerCase() ?? "";
    const absentTitles = [
      "Fixture blank abstract",
      "Fixture record without abstract",
      "Fixture private abstract",
      "Fixture quiet abstract",
    ];
    expect({
      absent: absentTitles.map((title) => {
        const card = cardFor(title);
        return {
          abstract: within(card).queryByTestId("feed-abstract"),
          href: within(card)
            .getByRole("link", { name: /View on PubMed/ })
            .getAttribute("href"),
          region: within(card).queryByTestId("feed-abstract-region"),
          toggle: within(card).queryByRole("button", {
            name: "Show full abstract",
          }),
        };
      }),
      calls: getIntelligenceFeedEntry.mock.calls.length,
      emptyAbstract: within(emptyPreview).queryByTestId("feed-abstract"),
      emptyCopyright: within(emptyPreview).getByTestId(
        "feed-abstract-copyright"
      ).textContent,
      emptyToggle: within(emptyPreview).getByRole("button", {
        name: "Show full abstract",
      }).textContent,
      linkAnalytics: previewLink.dataset.atlasAnalyticsControl ?? null,
      otherAbstract: within(other).queryByTestId("feed-abstract"),
      otherDescription:
        within(other).getByTestId("feed-description").textContent,
      otherPubmed: within(other).queryByRole("link", {
        name: /View on PubMed/,
      }),
      previewCopyright: within(previewCard).getByTestId(
        "feed-abstract-copyright"
      ).textContent,
      previewCourtesy: within(previewCard).getAllByText(COURTESY).length,
      previewLength: preview.abstract_preview?.length,
      previewLink: previewLink.getAttribute("href"),
      previewRel: previewLink.getAttribute("rel"),
      previewTarget: previewLink.getAttribute("target"),
      previewText: within(previewCard).getByTestId("feed-abstract").textContent,
      previewToggle: within(previewCard).getByRole("button", {
        name: "Show full abstract",
      }).textContent,
      quietRemoved: quietText.includes("removed"),
      quietSuppressed: quietText.includes("suppressed"),
      quietWithheld: quietText.includes("withheld"),
      shortCopyright: within(shortCard).queryByTestId(
        "feed-abstract-copyright"
      ),
      shortLength: row("Fixture short abstract").abstract_preview?.length,
      shortReadMore: within(shortCard).queryByRole("button", {
        name: "Read more",
      }),
      shortText: within(shortCard).getByTestId("feed-abstract").textContent,
      shortToggle: within(shortCard).queryByRole("button", {
        name: "Show full abstract",
      }),
      toggleAnalytics:
        within(previewCard).getByRole("button", { name: "Show full abstract" })
          .dataset.atlasAnalyticsControl ?? null,
    }).toStrictEqual({
      absent: absentTitles.map(() => ({
        abstract: null,
        href: PUBMED_URL,
        region: null,
        toggle: null,
      })),
      calls: 0,
      emptyAbstract: null,
      emptyCopyright: COPYRIGHT,
      emptyToggle: "Show full abstract",
      linkAnalytics: null,
      otherAbstract: null,
      otherDescription: "County surveillance note for a non PubMed item.",
      otherPubmed: null,
      previewCopyright: COPYRIGHT,
      previewCourtesy: 1,
      previewLength: 1000,
      previewLink: PUBMED_URL,
      previewRel: "noopener noreferrer",
      previewTarget: "_blank",
      previewText: preview.abstract_preview,
      previewToggle: "Show full abstract",
      quietRemoved: false,
      quietSuppressed: false,
      quietWithheld: false,
      shortCopyright: null,
      shortLength: 400,
      shortReadMore: null,
      shortText: row("Fixture short abstract").abstract_preview,
      shortToggle: null,
      toggleAnalytics: null,
    });
  });

  it("expands a longer abstract once, then restores the preview", async () => {
    const user = userEvent.setup();
    const track = vi
      .spyOn(atlasAnalytics, "track")
      .mockImplementation(() => {});
    renderFeed({ staleTime: PRODUCTION_FEED_STALE_TIME });
    const card = cardFor(
      await screen
        .findByRole("heading", {
          name: "Fixture preview article (opens in a new tab)",
        })
        .then(() => "Fixture preview article")
    );
    const full = detail("Fixture preview article").abstract?.text ?? "";
    const previewText = row("Fixture preview article").abstract_preview;
    mockDetail(detail("Fixture preview article"));
    const toggle = within(card).getByRole("button", {
      name: "Show full abstract",
    });
    const collapsed = {
      controls: toggle.getAttribute("aria-controls"),
      expanded: toggle.getAttribute("aria-expanded"),
      region: within(card).getByTestId("feed-abstract-region").id,
    };
    toggle.focus();
    await user.keyboard("{Enter}");
    const expanded = await within(card).findByText(full);
    const shown = within(card).getByRole("button", { name: "Show less" });
    const expandedFocus = document.activeElement;
    shown.focus();
    await user.keyboard(" ");
    await within(card).findByText(previewText ?? "");
    const collapsedFocus = document.activeElement;
    await user.click(shown);
    await within(card).findByText(full);
    expect({
      calls: getIntelligenceFeedEntry.mock.calls.map((call) => call[0]),
      collapsed,
      collapsedFocus,
      expanded: shown.getAttribute("aria-expanded"),
      expandedFocus,
      fullLength: full.length,
      status: within(card).getByTestId("feed-abstract-status").textContent,
      text: expanded.textContent,
      trackedDetail: trackFeedItemDetailOpened.mock.calls,
      trackedEvents: track.mock.calls,
    }).toStrictEqual({
      calls: [row("Fixture preview article").item_id],
      collapsed: {
        controls: collapsed.region,
        expanded: "false",
        region: collapsed.region,
      },
      collapsedFocus: shown,
      expanded: "true",
      expandedFocus: shown,
      fullLength: 3000,
      status: FEED_ABSTRACT_SHOWN_MESSAGE,
      text: full,
      trackedDetail: [],
      trackedEvents: [],
    });
    track.mockRestore();
  });

  it("keeps Read more opening the detail panel", async () => {
    const user = userEvent.setup();
    renderFeed({ staleTime: PRODUCTION_FEED_STALE_TIME });
    const card = cardFor(
      await screen
        .findByRole("heading", {
          name: "Fixture preview article (opens in a new tab)",
        })
        .then(() => "Fixture preview article")
    );
    const full = detail("Fixture preview article").abstract?.text ?? "";
    mockDetail(detail("Fixture preview article"));
    await user.click(within(card).getByRole("button", { name: "Read more" }));
    const dialog = await screen.findByRole("dialog");
    expect({
      abstract: (await within(dialog).findByTestId("feed-abstract"))
        .textContent,
      courtesy: within(dialog).getAllByText(COURTESY).length,
      panelAnalytics: within(dialog).getByRole("link", {
        name: /View on PubMed/,
      }).dataset.atlasAnalyticsControl,
      pubmed: within(dialog)
        .getByRole("link", { name: /View on PubMed/ })
        .getAttribute("href"),
      tracked: trackFeedItemDetailOpened.mock.calls,
    }).toStrictEqual({
      abstract: full,
      courtesy: 1,
      panelAnalytics: "feed_item_pubmed_open",
      pubmed: PUBMED_URL,
      tracked: [["feed_card_read_more", "pubmed"]],
    });
  });

  it("loads the full text when the preview is an empty string", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture empty preview (opens in a new tab)",
    });
    const card = cardFor("Fixture empty preview");
    mockDetail(detail("Fixture empty preview"));
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    expect({
      calls: getIntelligenceFeedEntry.mock.calls.length,
      text: (await within(card).findByTestId("feed-abstract")).textContent,
    }).toStrictEqual({
      calls: 1,
      text: "Fixture full abstract after an empty preview.",
    });
  });

  it("keeps the preview when the full abstract cannot be loaded", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture preview article (opens in a new tab)",
    });
    const card = cardFor("Fixture preview article");
    const preview = row("Fixture preview article").abstract_preview;
    getIntelligenceFeedEntry.mockRejectedValueOnce(
      new AtlasApiError("down", "/v1/intelligence/feed/x", 503, null)
    );
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    expect({
      preview: within(card).getByTestId("feed-abstract").textContent,
      pubmed: within(card)
        .getByRole("link", { name: /View on PubMed/ })
        .getAttribute("href"),
      status: (await within(card).findByTestId("feed-abstract-status"))
        .textContent,
    }).toStrictEqual({
      preview,
      pubmed: PUBMED_URL,
      status: FEED_ABSTRACT_UNAVAILABLE_MESSAGE,
    });
    mockDetail(detail("Fixture preview article"));
    await user.click(within(card).getByRole("button", { name: "Retry" }));
    expect({
      error: within(card).queryByText(FEED_ABSTRACT_UNAVAILABLE_MESSAGE),
      length: (await within(card).findByTestId("feed-abstract")).textContent
        ?.length,
    }).toStrictEqual({
      error: null,
      length: 3000,
    });
  });

  it("keeps an empty preview when the network fails", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture empty preview (opens in a new tab)",
    });
    const card = cardFor("Fixture empty preview");
    getIntelligenceFeedEntry.mockRejectedValueOnce(new Error("offline"));
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    expect({
      abstract: within(card).queryByTestId("feed-abstract"),
      retry: within(card).getByRole("button", { name: "Retry" }).textContent,
      status: (await within(card).findByTestId("feed-abstract-status"))
        .textContent,
    }).toStrictEqual({
      abstract: null,
      retry: "Retry",
      status: FEED_ABSTRACT_UNAVAILABLE_MESSAGE,
    });
  });

  it("keeps the preview when the item is no longer in the feed", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture long abstract (opens in a new tab)",
    });
    const card = cardFor("Fixture long abstract");
    getIntelligenceFeedEntry.mockRejectedValueOnce(
      new AtlasApiError("missing", "/v1/intelligence/feed/x", 404, null)
    );
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    expect({
      preview: within(card).getByTestId("feed-abstract").textContent,
      retry: within(card).queryByRole("button", { name: "Retry" }),
      status: (await within(card).findByTestId("feed-abstract-status"))
        .textContent,
    }).toStrictEqual({
      preview: row("Fixture long abstract").abstract_preview,
      retry: null,
      status: FEED_ITEM_MISSING_MESSAGE,
    });
  });

  it("keeps the preview when the item id is rejected", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture long abstract (opens in a new tab)",
    });
    const card = cardFor("Fixture long abstract");
    getIntelligenceFeedEntry.mockRejectedValueOnce(
      new AtlasApiError("invalid", "/v1/intelligence/feed/x", 422, null)
    );
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    expect({
      retry: within(card).queryByRole("button", { name: "Retry" }),
      status: (await within(card).findByTestId("feed-abstract-status"))
        .textContent,
    }).toStrictEqual({
      retry: null,
      status: FEED_ITEM_MISSING_MESSAGE,
    });
  });

  it("drops a stale preview when by-id is no longer present", async () => {
    const user = userEvent.setup();
    const changed = intelligenceFeedEntry("changed", {
      abstractHasMore: true,
      abstractPreview: "Fixture preview that the item no longer serves.",
      abstractState: "present",
      attribution: COURTESY,
      copyrightLine: COPYRIGHT,
      description: { state: "not_provided", text: null },
      organization: "National Library of Medicine",
      pmid: "12345678",
      publisher: "Fixture Journal",
      pubmedUrl: PUBMED_URL,
      sourceFamily: "pubmed",
      sourceFamilyLabel: "PubMed",
      sourceId: "pubmed-fixture",
      title: "Fixture changed record",
      trust: "research_index",
    });
    listIntelligenceFeed.mockResolvedValue({
      data: {
        ...listFixture,
        data: [changed],
      },
      headers: new Headers(),
      status: 200,
    });
    mockDetail(
      intelligenceFeedDetail("changed", {
        abstract: { copyright_line: null, state: "suppressed", text: null },
        attribution: COURTESY,
        description: { state: "not_provided", text: null },
        organization: "National Library of Medicine",
        pmid: "12345678",
        publisher: "Fixture Journal",
        pubmedUrl: PUBMED_URL,
        sourceFamily: "pubmed",
        sourceFamilyLabel: "PubMed",
        sourceId: "pubmed-fixture",
        title: "Fixture changed record",
        trust: "research_index",
      })
    );
    renderFeed();
    const card = cardFor(
      await screen
        .findByRole("heading", {
          name: "Fixture changed record (opens in a new tab)",
        })
        .then(() => "Fixture changed record")
    );
    await user.click(
      within(card).getByRole("button", { name: "Show full abstract" })
    );
    await waitFor(() => {
      if (within(card).queryByTestId("feed-abstract")) {
        throw new Error("Stale abstract is still shown");
      }
    });
    const text = card.textContent?.toLowerCase() ?? "";
    expect({
      preview: text.includes("fixture preview that the item"),
      removed: text.includes("removed"),
      suppressed: text.includes("suppressed"),
      withheld: text.includes("withheld"),
    }).toStrictEqual({
      preview: false,
      removed: false,
      suppressed: false,
      withheld: false,
    });
  });

  it("shows the by-id abstract state in the detail panel", async () => {
    const user = userEvent.setup();
    renderFeed();
    await screen.findByRole("heading", {
      name: "Fixture record without abstract (opens in a new tab)",
    });
    const cases = [
      "Fixture record without abstract",
      "Fixture blank abstract",
      "Fixture private abstract",
      "Fixture quiet abstract",
      "Fixture short abstract",
    ];
    const seen = [];
    for (const title of cases) {
      mockDetail(detail(title));
      await user.click(
        within(cardFor(title)).getByRole("button", { name: "Details" })
      );
      const dialog = await screen.findByRole("dialog");
      const panelText = dialog.textContent?.toLowerCase() ?? "";
      seen.push({
        abstract:
          within(dialog).queryByTestId("feed-abstract")?.textContent ?? null,
        copyright: within(dialog).queryByTestId("feed-abstract-copyright"),
        courtesy: within(dialog).getAllByText(COURTESY).length,
        notice: dialog.textContent?.includes(
          "No abstract in the PubMed record."
        ),
        pubmed: within(dialog)
          .getByRole("link", { name: /View on PubMed/ })
          .getAttribute("href"),
        removed: panelText.includes("removed"),
        suppressed: panelText.includes("suppressed"),
        withheld: panelText.includes("withheld"),
      });
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await waitFor(() => {
        if (screen.queryByRole("dialog")) {
          throw new Error("Detail panel is still open");
        }
      });
    }
    expect(seen).toStrictEqual([
      {
        abstract: null,
        copyright: null,
        courtesy: 1,
        notice: true,
        pubmed: PUBMED_URL,
        removed: false,
        suppressed: false,
        withheld: false,
      },
      {
        abstract: null,
        copyright: null,
        courtesy: 1,
        notice: false,
        pubmed: PUBMED_URL,
        removed: false,
        suppressed: false,
        withheld: false,
      },
      {
        abstract: null,
        copyright: null,
        courtesy: 1,
        notice: false,
        pubmed: PUBMED_URL,
        removed: false,
        suppressed: false,
        withheld: false,
      },
      {
        abstract: null,
        copyright: null,
        courtesy: 1,
        notice: false,
        pubmed: PUBMED_URL,
        removed: false,
        suppressed: false,
        withheld: false,
      },
      {
        abstract: row("Fixture short abstract").abstract_preview,
        copyright: null,
        courtesy: 1,
        notice: false,
        pubmed: PUBMED_URL,
        removed: false,
        suppressed: false,
        withheld: false,
      },
    ]);
  });
});
