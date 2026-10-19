import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { buildReviewCountyPreview } from "@/features/ux-reset/review/review-county-preview";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import { ReviewPublishedCountyPreview } from "@/features/ux-reset/review/review-published-county-preview";
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
        "No county-level 2023 Lyme case count was published. A missing record is not treated as zero cases."
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
});
