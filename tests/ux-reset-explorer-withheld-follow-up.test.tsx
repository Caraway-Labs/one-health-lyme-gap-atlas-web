import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetReviewExperience } from "@/features/ux-reset/review/reset-review-experience";
import type { StateReviewResultState } from "@/generated/models/stateReviewResultState";

import {
  buildStateReview,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";
import {
  reviewScopeMetadataFixture,
  reviewScopeScoresFixture,
} from "./fixtures/review-scope-api-fixtures";

const NEXT_CHECK = "Inspect the withheld Denver source record.";
const REASON = "Withheld Denver rationale must stay unpublished.";
const withheldRecommendation =
  /Inspect the withheld Denver source record|Withheld Denver rationale must stay unpublished|PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW|No suggested follow-up was returned/;

const reviewResult = vi.hoisted(() => ({
  resultState: "candidates_found" as StateReviewResultState,
}));
const reviewRouter = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

let mockedSearch = "";

vi.mock(import("next/navigation"), async (importOriginal) => {
  const navigation = {
    ...(await importOriginal()),
    usePathname: () => "/explore",
    useRouter: () => reviewRouter,
    useSearchParams: () =>
      new URLSearchParams(mockedSearch) as ReadonlyURLSearchParams,
  };
  return navigation as never;
});

vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: () => <div data-testid="mock-atlas-map" />,
}));

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const geography = {
    ...(await importOriginal()),
    fetchCountyDisplayGeometry: vi.fn<
      () => Promise<{ features: []; type: "FeatureCollection" }>
    >(async () => ({
      features: [],
      type: "FeatureCollection",
    })),
  };
  return geography as never;
});

vi.mock(import("@/generated/atlas"), () => {
  const atlas = {
    countyTier1SurveillancePriorityGet: vi.fn<
      () => Promise<{ data: null; status: number }>
    >(async () => ({ data: null, status: 404 })),
    getProfileV1MeProfileGet: vi.fn<
      () => Promise<{ data: { profile: null }; status: number }>
    >(async () => ({ data: { profile: null }, status: 200 })),
    metadataV1AtlasMetadataGet: vi.fn<
      () => Promise<{ data: typeof reviewScopeMetadataFixture; status: number }>
    >(async () => ({ data: reviewScopeMetadataFixture, status: 200 })),
    scoresV1AtlasScoresGet: vi.fn<
      () => Promise<{ data: typeof reviewScopeScoresFixture; status: number }>
    >(async () => ({ data: reviewScopeScoresFixture, status: 200 })),
    stateReviewV1StatesStateReviewGet: vi.fn<
      (state: string) => Promise<{
        data: ReturnType<typeof buildStateReview>;
        status: number;
      }>
    >(async (state: string) => ({
      data: buildStateReview({
        candidates: [
          reviewCandidate({
            caveat: "Collection dates are unavailable for this status.",
            countyName: "Denver",
            fips: "08001",
            nextCheck: NEXT_CHECK,
            reasonText: REASON,
          }),
        ],
        resultState: reviewResult.resultState,
        state,
      }),
      status: 200,
    })),
  };
  return atlas as never;
});

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
  search: string,
  onUrlUpdate?: (update: {
    history: "push" | "replace";
    queryString: string;
  }) => void
) {
  mockedSearch = search.startsWith("?") ? search.slice(1) : search;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={({ options, queryString }) =>
          onUrlUpdate?.({ history: options.history, queryString })
        }
        searchParams={
          new URL(`http://localhost/explore?${mockedSearch}`).search
        }
      >
        <ResetReviewExperience />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );
}

async function openedFollowUp(mode: "evidence" | "follow-up"): Promise<string> {
  const view = renderReview(`?scope=CO&county=08001&mode=${mode}`);
  await screen.findByTestId("explorer-follow-up");
  await waitFor(
    () => {
      const marker = screen.getByTestId("explorer-follow-up").dataset.followUp;
      if (marker === "loading" || marker === "waiting") {
        throw new Error("follow-up is still loading");
      }
    },
    { timeout: 4000 }
  );
  const followUp = screen.getByTestId("explorer-follow-up");
  const root = screen.getByTestId("explorer-county-evidence");
  const text = `${mode}:${followUp.dataset.followUp}:${root.textContent ?? ""}`;
  view.unmount();
  return text;
}

describe("withheld Explorer follow-up", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(["unsupported", "none_stand_out", "insufficient_evidence"] as const)(
    "keeps a %s candidate out of evidence and follow-up",
    async (resultState) => {
      stubDesktopMatchMedia();
      reviewResult.resultState = resultState;
      const seen = `${await openedFollowUp("evidence")}\n${await openedFollowUp("follow-up")}`;
      expect(seen).toContain(
        "Review category is withheld because this result does not publish candidates."
      );
      expect(seen).toContain("Why review this county?");
      expect(seen).not.toContain("Suggested follow-up is withheld");
      expect(seen).not.toMatch(withheldRecommendation);
    }
  );

  it("pins the reviewed release when opening county evidence", async () => {
    stubDesktopMatchMedia();
    reviewResult.resultState = "candidates_found";
    const updates: { history: "push" | "replace"; queryString: string }[] = [];
    renderReview("?scope=CO&county=08001", (update) => {
      updates.push(update);
    });
    fireEvent.click(await screen.findByTestId("review-view-county-evidence"));
    await waitFor(() => {
      const pinned = updates.find(
        (update) =>
          new URLSearchParams(update.queryString).get("mode") === "evidence"
      );
      if (!pinned) {
        throw new Error("county evidence did not write mode");
      }
      const params = new URLSearchParams(pinned.queryString);
      expect({
        county: params.get("county"),
        dataset: params.get("dataset"),
        history: pinned.history,
        mode: params.get("mode"),
      }).toStrictEqual({
        county: "08001",
        dataset: "alpha-2026",
        history: "push",
        mode: "evidence",
      });
    });
  });

  it("shows the same candidate when the result state agrees", async () => {
    stubDesktopMatchMedia();
    reviewResult.resultState = "candidates_found";
    const evidence = await openedFollowUp("evidence");
    const followUp = await openedFollowUp("follow-up");
    const combined = `${evidence}\n${followUp}`;
    expect(combined).toContain("Denver");
    expect(combined).toContain(REASON);
    expect(combined).not.toContain(NEXT_CHECK);
  });
});
