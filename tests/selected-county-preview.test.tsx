import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

import autauga from "./fixtures/review-al-01001.json";
import baldwin from "./fixtures/review-al-01003.json";
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
      screen.findByText(/case-count floor is 5/)
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

  it("keeps a missing case count distinct from zero", async () => {
    renderPublished(autauga);
    await expect(
      screen.findByText(
        "No county-linked 2023 Lyme case record is available. That is not zero cases."
      )
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText(/case-count floor is 0/)).toBeNull();
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

  it("badges only recognized review priorities", async () => {
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
    const readings: Record<string, { badge: string | null; text: string }> = {};
    for (const priority of cases) {
      cleanup();
      renderPublished({ ...baldwin, priority });
      const region = await screen.findByTestId("review-preview-priority");
      readings[priority || "blank"] = {
        badge: region.querySelector(".priority-pill")?.textContent ?? null,
        text: region.textContent ?? "",
      };
    }
    expect(readings).toStrictEqual({
      blank: {
        badge: null,
        text: "Review priority is unavailable for this county. Unavailable is not a finding of no risk.",
      },
      "Lower — routine": {
        badge: "Lower review priority",
        text: "Lower review priorityPublished review priority for follow-up. This is not a disease-risk estimate.",
      },
      "Not assessed": {
        badge: null,
        text: "Not assessedThis published priority is not a recognized review category. It is not a disease-risk estimate.",
      },
      "Priority 1 — Urgent follow-up": {
        badge: "Highest review priority",
        text: "Highest review priorityPublished review priority for follow-up. This is not a disease-risk estimate.",
      },
      "Priority 10": {
        badge: null,
        text: "Priority 10This published priority is not a recognized review category. It is not a disease-risk estimate.",
      },
      "Priority 2 — Review": {
        badge: "Moderate review priority",
        text: "Moderate review priorityPublished review priority for follow-up. This is not a disease-risk estimate.",
      },
      unavailable: {
        badge: null,
        text: "Review priority is unavailable for this county. Unavailable is not a finding of no risk.",
      },
      Unknown: {
        badge: null,
        text: "UnknownThis published priority is not a recognized review category. It is not a disease-risk estimate.",
      },
      "Watch — Monitor signals": {
        badge: "Monitor for changes",
        text: "Monitor for changesPublished review priority for follow-up. This is not a disease-risk estimate.",
      },
    });
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
            human_status: humanStatus,
            incidence_floor_2023: rate,
          })}
        />
      );
      return screen.getByTestId("review-rationale-1").textContent ?? "";
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
        "1Published Lyme case dataA 2023 case-count floor was published, but the count and rate are unavailable. Unavailable numbers are not zero cases.",
      countOnly:
        "1Published Lyme case dataThe published 2023 case-count floor is 4. A published floor is a minimum, not an exact count or rate.",
      missing:
        "1Published Lyme case dataThe 2023 county Lyme case count is missing. A missing count is not zero cases.",
      noCountyRecord:
        "1Published Lyme case dataNo county-linked 2023 Lyme case record is available. That is not zero cases.",
      publishedZero:
        "1Published Lyme case dataThe published 2023 case-count floor is 0. The published 2023 minimum rate is 0.0 cases per 100,000. A published floor is a minimum, not an exact count or rate.",
      rateOnly:
        "1Published Lyme case dataThe published 2023 minimum rate is 2.1 cases per 100,000. A published floor is a minimum, not an exact count or rate.",
      suppressed:
        "1Published Lyme case dataThe 2023 county Lyme case count is suppressed. Suppression is not zero cases.",
    });
  });
});
