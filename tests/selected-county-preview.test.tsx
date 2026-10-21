import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { buildReviewCountyPreview } from "@/features/ux-reset/review/review-county-preview";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import { ReviewPublishedCountyPreview } from "@/features/ux-reset/review/review-published-county-preview";
import { ReviewRationalePanel } from "@/features/ux-reset/review/review-rationale-panel";
import {
  EXPLORER_MAP_FOLLOW_UP_ID,
  scrollToSuggestedFollowUp,
} from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import * as atlasClient from "@/generated/atlas";
import { CountyV1CountiesFipsGetResponse } from "@/generated/zod/atlas";

import autauga from "./fixtures/review-al-v11-01001.json";
import baldwin from "./fixtures/review-al-v11-01003.json";
import { reviewScopeScoresFixture } from "./fixtures/review-scope-api-fixtures";

vi.mock(import("next/navigation"), async (original) => ({
  ...(await original()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams() as ReadonlyURLSearchParams,
}));
vi.mock(import("@/features/ux-reset/investigate/load-county-evidence"), () => ({
  loadInvestigateCountyRecord: vi.fn<typeof loadInvestigateCountyRecord>(),
}));

const county = {
  county: "Baldwin County",
  fips: "01003",
  state: "AL",
  stateName: "Alabama",
};

function renderPublished(detail: unknown) {
  vi.mocked(loadInvestigateCountyRecord).mockResolvedValue(
    CountyV1CountiesFipsGetResponse.parse(detail)
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReviewPublishedCountyPreview
        compareHref="/compare?county=01003"
        county={county}
        releaseId="governed-release"
        onOpen={() => {}}
      />
      <section id={EXPLORER_MAP_FOLLOW_UP_ID} tabIndex={-1}>
        Suggested follow-up
      </section>
    </QueryClientProvider>
  );
}

describe("selected county preview", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("scrolls smoothly and skips motion when reduced motion is requested", () => {
    const target = document.createElement("section");
    target.tabIndex = -1;
    document.body.append(target);
    const scroll = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    target.scrollIntoView = scroll;
    expect(scrollToSuggestedFollowUp(target, false)).toBeTruthy();
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toBe(target);
    scrollToSuggestedFollowUp(target, true);
    expect(scroll).toHaveBeenLastCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(scrollToSuggestedFollowUp(null, true)).toBeFalsy();
    target.remove();
  });

  it("keeps six rows in order and only the two approved actions", async () => {
    const availability = vi.spyOn(
      atlasClient,
      "canonicalGeographyAvailability"
    );
    renderPublished(baldwin);
    await expect(
      screen.findByText(/At least 5 Lyme disease cases were reported in 2023/)
    ).resolves.toBeInTheDocument();
    const labels = [1, 2, 3, 4, 5, 6].map(
      (number) =>
        screen.getByTestId(`review-rationale-${number}`).querySelector("h4")
          ?.textContent
    );
    const sources = screen.getByTestId("review-sources-methods");
    const fips = screen.getByTestId("review-preview-fips").textContent ?? "";
    expect({
      askAtlas: screen.queryByTestId("review-ask-atlas"),
      canonical: screen.queryByText(/Canonical geography/),
      community: screen.getByRole("heading", { name: "Community context" })
        .textContent,
      compareVariant: screen.getByRole("link", { name: "Compare This County" })
        .dataset.variant,
      evidence: screen.queryByTestId("review-view-county-evidence"),
      fips,
      followUp: screen.getByRole("button", { name: "View County Follow-Up" })
        .textContent,
      influenceAfterEvidence:
        screen.getByTestId("ranking-influence").previousElementSibling ===
        screen.getByTestId("review-rationale"),
      influenceClosed: screen
        .getByTestId("ranking-influence")
        .hasAttribute("open"),
      investigate: screen.queryByTestId("review-investigate"),
      labels,
      sourcesClosed: sources.hasAttribute("open"),
      sourcesRelease: sources.textContent,
      surveillance: screen.getByRole("heading", {
        name: "Surveillance evidence",
      }).textContent,
    }).toStrictEqual({
      askAtlas: null,
      canonical: null,
      community: "Community context",
      compareVariant: "outline",
      evidence: null,
      fips: "FIPS 01003",
      followUp: "View County Follow-Up",
      influenceAfterEvidence: true,
      influenceClosed: false,
      investigate: null,
      labels: [
        "Published Lyme case data",
        "Tick presence",
        "Borrelia burgdorferi detection",
        "Social vulnerability",
        "Health insurance coverage",
        "Rurality",
      ],
      sourcesClosed: false,
      sourcesRelease: expect.stringContaining(
        "governed-2026-10-06-nlcd-demo-cohort"
      ),
      surveillance: "Surveillance evidence",
    });
    expect(fips).not.toContain("Release");
    fireEvent.click(
      screen.getByRole("button", { name: "View County Follow-Up" })
    );
    expect({
      availabilityCalls: availability.mock.calls.length,
      focused: document.activeElement?.id,
    }).toStrictEqual({
      availabilityCalls: 0,
      focused: EXPLORER_MAP_FOLLOW_UP_ID,
    });
  });

  it("keeps an Inspect provenance trigger on each numbered rationale row", async () => {
    renderPublished(baldwin);
    await screen.findByText(
      /At least 5 Lyme disease cases were reported in 2023/
    );
    expect(
      [1, 2, 3, 4, 5, 6].map(
        (number) =>
          within(screen.getByTestId(`review-rationale-${number}`)).getAllByText(
            /^Inspect provenance for /
          ).length
      )
    ).toStrictEqual([2, 2, 1, 1, 1, 1]);
    expect(
      within(screen.getByTestId("review-rationale-1")).getByText(
        "Inspect provenance for Minimum reported cases"
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("review-rationale-1")).getByText(
        "Inspect provenance for Minimum reported incidence"
      )
    ).toBeInTheDocument();
  });

  it("inspects claim provenance and governed source urls", async () => {
    const tickUrl =
      "https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html";
    const pathogenUrl = tickUrl;
    const fieldValue = (view: ReturnType<typeof within>, field: string) =>
      view.getByTestId(field).querySelector("dd")?.textContent ?? "";
    const claim = (item: HTMLElement, summary: string) => {
      fireEvent.click(within(item).getByText(summary));
      const inspect = within(item)
        .getAllByTestId("evidence-provenance-inspect")
        .find(
          (element) => element.querySelector("summary")?.textContent === summary
        );
      if (!inspect) {
        throw new Error(`Missing provenance disclosure: ${summary}`);
      }
      return within(inspect);
    };
    const sourceHref = (view: ReturnType<typeof within>) =>
      view
        .getByTestId("evidence-provenance-source")
        .querySelector("a")
        ?.getAttribute("href") ?? null;
    const releaseHref = (key: string) =>
      screen
        .getByTestId("review-sources-methods")
        .querySelector(`[data-source-key="${key}"]`)
        ?.getAttribute("href") ?? null;

    renderPublished(baldwin);
    await screen.findByText(
      /At least 5 Lyme disease cases were reported in 2023/
    );
    const tick = screen.getByTestId("review-rationale-2");
    const pathogen = screen.getByTestId("review-rationale-3");
    const tickClaim = claim(
      tick,
      "Inspect provenance for Ixodes scapularis status"
    );
    const pathogenClaim = claim(
      pathogen,
      "Inspect provenance for Borrelia burgdorferi status"
    );
    expect({
      pathogenHref: sourceHref(pathogenClaim),
      pathogenLimitations: pathogenClaim.queryByTestId(
        "evidence-provenance-limitations"
      ),
      pathogenPeriod: fieldValue(pathogenClaim, "evidence-provenance-period"),
      pathogenReason: fieldValue(pathogenClaim, "evidence-provenance-state"),
      pathogenReleaseHref: releaseHref("pathogen"),
      tickClaims: within(tick).getAllByTestId("evidence-provenance-inspect")
        .length,
      tickFreshness: fieldValue(tickClaim, "evidence-provenance-freshness"),
      tickHref: sourceHref(tickClaim),
      tickLimitations: tickClaim.queryByTestId(
        "evidence-provenance-limitations"
      ),
      tickPeriod: fieldValue(tickClaim, "evidence-provenance-period"),
      tickReason: fieldValue(tickClaim, "evidence-provenance-state"),
      tickReleaseHref: releaseHref("tick"),
    }).toStrictEqual({
      pathogenHref: pathogenUrl,
      pathogenLimitations: null,
      pathogenPeriod: "Unavailable",
      pathogenReason: "Unavailable. No county-linked record.",
      pathogenReleaseHref: pathogenUrl,
      tickClaims: 2,
      tickFreshness: "Dataset vintage through 2025-12-31.",
      tickHref: tickUrl,
      tickLimitations: null,
      tickPeriod: "Unavailable",
      tickReason: "Limited. Coverage or methodology limits apply.",
      tickReleaseHref: tickUrl,
    });

    cleanup();
    renderPublished({
      ...baldwin,
      release: {
        ...baldwin.release,
        sources: baldwin.release.sources.map((source) =>
          source.key === "tick" || source.key === "pathogen"
            ? { ...source, vintage: "" }
            : source
        ),
      },
    });
    await screen.findByText(
      /At least 5 Lyme disease cases were reported in 2023/
    );
    const unknownTick = claim(
      screen.getByTestId("review-rationale-2"),
      "Inspect provenance for Ixodes scapularis status"
    );
    const unknownPathogen = claim(
      screen.getByTestId("review-rationale-3"),
      "Inspect provenance for Borrelia burgdorferi status"
    );
    expect({
      pathogenFreshness: fieldValue(
        unknownPathogen,
        "evidence-provenance-freshness"
      ),
      pathogenHref: sourceHref(unknownPathogen),
      pathogenPeriod: fieldValue(unknownPathogen, "evidence-provenance-period"),
      tickFreshness: fieldValue(unknownTick, "evidence-provenance-freshness"),
      tickHref: sourceHref(unknownTick),
      tickPeriod: fieldValue(unknownTick, "evidence-provenance-period"),
    }).toStrictEqual({
      pathogenFreshness: "Unavailable",
      pathogenHref: pathogenUrl,
      pathogenPeriod: "Unavailable",
      tickFreshness: "Unavailable",
      tickHref: tickUrl,
      tickPeriod: "Unavailable",
    });
  });

  it("keeps a missing case count distinct from zero", async () => {
    renderPublished(autauga);
    await expect(
      screen.findByText("No county-linked 2023 Lyme case record is available.")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText(/At least 0 Lyme disease cases/)).toBeNull();
  });

  it("does not request canonical geography for the review-candidate preview", () => {
    const availability = vi.spyOn(
      atlasClient,
      "canonicalGeographyAvailability"
    );
    const score = reviewScopeScoresFixture.counties[0];
    if (!score) {
      throw new Error("Missing score fixture");
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewCountyPreviewPanel
          compareHref="/compare?county=08001"
          droppedNotes={[]}
          href="/explore?county=08001&mode=evidence"
          preview={buildReviewCountyPreview(score)}
          releaseId="alpha-2026"
          release={{
            releaseId: "alpha-2026",
            status: "ready",
          }}
          onOpen={() => {}}
          onViewCountyEvidence={() => {}}
        />
      </QueryClientProvider>
    );
    expect(screen.queryByTestId("canonical-geography-availability")).toBeNull();
    expect(availability).not.toHaveBeenCalled();
  });

  it("keeps one response-tier pill and drops the legacy priority badge", async () => {
    const cases = [
      "Priority 1 — Urgent follow-up",
      "Priority 2 — Review",
      "Watch — Monitor signals",
      "Lower — routine",
      "",
      "unavailable",
      "Unknown",
      "Not assessed",
      "Priority 10",
    ] as const;
    const readings: { legacyBadge: boolean; pills: number; title: string }[] =
      [];
    for (const priority of cases) {
      cleanup();
      renderPublished({ ...baldwin, priority });
      await screen.findByTestId("selected-county-response-tier");
      const card = screen.getByTestId("review-published-county-preview");
      readings.push({
        legacyBadge: card.querySelector(".priority-pill") !== null,
        pills: card.querySelectorAll(
          "[data-testid='selected-county-response-tier']"
        ).length,
        title:
          card.querySelector(".response-tier-pill-title")?.textContent ?? "",
      });
    }
    expect(readings).toStrictEqual(
      cases.map(() => ({
        legacyBadge: false,
        pills: 1,
        title: "Moderate review priority",
      }))
    );
    expect(
      screen.queryByText("This is not a disease-risk estimate.")
    ).toBeNull();
    expect(screen.queryByText("Monitor for changes")).toBeNull();
  });

  it("renders status-specific published Lyme case rows", () => {
    const row = (
      humanStatus: string,
      count: number | null,
      rate: number | null
    ) => {
      cleanup();
      render(
        <ReviewRationalePanel
          detail={CountyV1CountiesFipsGetResponse.parse({
            ...autauga,
            case_count_floor_2023: count,
            scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
            human_status: humanStatus,
            incidence_floor_2023: rate,
          })}
        />
      );
      const rowElement = screen.getByTestId("review-rationale-1");
      expect(
        rowElement.querySelector("[data-slot='tooltip-trigger']")
      ).toBeNull();
      expect(
        within(rowElement).queryByRole("button", {
          name: /Minimum reported/,
        })
      ).toBeNull();
      return rowElement.querySelector("p")?.textContent ?? "";
    };
    expect({
      absent: row("published_count_floor", null, null),
      countOnly: row("published_count_floor", 4, null),
      missing: row("missing", null, null),
      noCountyRecord: row("no_county_linked_record", null, null),
      publishedZero: row("published_count_floor", 0, 0),
      rateOnly: row("published_count_floor", null, 2.14),
      suppressed: row("suppressed", null, null),
    }).toStrictEqual({
      absent:
        "A 2023 minimum reported case count was published, but the count and rate are unavailable.",
      countOnly:
        "Minimum reported cases: At least 4 Lyme disease cases were reported in 2023. The published data establish a minimum number of reported cases. The actual reported total may be higher.",
      missing: "The 2023 county Lyme case count is missing.",
      noCountyRecord: "No county-linked 2023 Lyme case record is available.",
      publishedZero:
        "Minimum reported cases: At least 0 Lyme disease cases were reported in 2023. The published data establish a minimum number of reported cases. The actual reported total may be higher. Minimum reported incidence: At least 0.0 reported cases per 100,000 residents. The published data establish a minimum reported incidence. The actual reported rate may be higher.",
      rateOnly:
        "Minimum reported incidence: At least 2.1 reported cases per 100,000 residents. The published data establish a minimum reported incidence. The actual reported rate may be higher.",
      suppressed: "The 2023 county Lyme case count is suppressed.",
    });
  });
});
