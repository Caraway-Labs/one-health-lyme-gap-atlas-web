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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchExploreCountyDirectory } from "@/features/ux-reset/explore/load-explore-resources";
import { loadInvestigateCountyRecord } from "@/features/ux-reset/investigate/load-county-evidence";
import { ReviewOperatingPicture } from "@/features/ux-reset/review/review-operating-picture";
import { reviewHumanFloorEvidence } from "@/features/ux-reset/review/review-published-county-preview";
import { CountyV1CountiesFipsGetResponse } from "@/generated/zod/atlas";

import autauga from "./fixtures/review-al-01001.json";
import baldwin from "./fixtures/review-al-01003.json";
import barbour from "./fixtures/review-al-01005.json";
import identities from "./fixtures/review-al-published-identities.json";
import {
  buildStateReview,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";

vi.mock(import("next/navigation"), async (original) => ({
  ...(await original()),
  usePathname: () => "/explore",
  useSearchParams: () =>
    new URLSearchParams("scope=AL") as ReadonlyURLSearchParams,
}));
vi.mock(import("@/components/atlas-map"), () => ({
  AtlasMap: ({
    onSelect,
  }: {
    onSelect: (fips: string, surface: "map") => void;
  }) => (
    <div>
      {[...identities, { fips: "99999" }].map((entry) => (
        <button
          key={entry.fips}
          type="button"
          data-testid={`map-${entry.fips}`}
          onClick={() => onSelect(entry.fips, "map")}
        >
          {entry.fips}
        </button>
      ))}
    </div>
  ),
}));
vi.mock(import("@/lib/county-geography"), async (original) => ({
  ...(await original()),
  fetchCountyDisplayGeometry: vi.fn<
    typeof import("@/lib/county-geography").fetchCountyDisplayGeometry
  >(async () => ({
    type: "FeatureCollection",
    features: identities.map((entry) => ({
      type: "Feature" as const,
      properties: { fips: entry.fips },
      geometry: {
        type: "Point" as const,
        coordinates: [-86, 32] as [number, number],
      },
    })),
  })),
}));
vi.mock(import("@/features/ux-reset/explore/load-explore-resources"), () => ({
  fetchExploreCountyDirectory: vi.fn<typeof fetchExploreCountyDirectory>(),
}));
vi.mock(import("@/features/ux-reset/investigate/load-county-evidence"), () => ({
  loadInvestigateCountyRecord: vi.fn<typeof loadInvestigateCountyRecord>(),
}));

const releaseId = baldwin.release.release_id;
const onCountyChange =
  vi.fn<(fips: string | null, history: "push" | "replace") => void>();
function picture(
  county: string | null = null,
  release = releaseId,
  candidate = false
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const review = buildStateReview({
    state: "AL",
    resultState: candidate ? "candidates_found" : "unsupported",
    candidates: candidate
      ? [
          reviewCandidate({
            fips: "01003",
            countyName: "Baldwin County",
            reasonText: "Authoritative reason",
            caveat: "Authoritative caveat",
          }),
        ]
      : [],
  });
  review.data_release_version = release;
  const view = render(
    <QueryClientProvider client={client}>
      <ReviewOperatingPicture
        county={county}
        review={review}
        scopeCode="AL"
        stateName="Alabama"
        onCountyChange={onCountyChange}
      />
    </QueryClientProvider>
  );
  return { ...view, client };
}
describe("Published Review county exploration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchExploreCountyDirectory).mockResolvedValue(identities);
    vi.mocked(loadInvestigateCountyRecord).mockImplementation(
      async ({ fips }) =>
        CountyV1CountiesFipsGetResponse.parse(
          [autauga, baldwin, barbour].find((entry) => entry.fips === fips)
        )
    );
  });
  afterEach(cleanup);

  it("keeps all 67 published AL counties mouse-selectable with zero candidates", async () => {
    picture();
    await screen.findByRole("heading", { name: "Counties" });
    await waitFor(() => {
      expect(document.querySelectorAll(".ux-reset-ranked-row")).toHaveLength(
        67
      );
    });
    expect(screen.queryAllByTestId("review-candidate")).toHaveLength(0);
    expect(screen.getByTestId("review-backend-result")).toHaveTextContent(
      "Unsupported"
    );
    for (const entry of identities) {
      fireEvent.click(await screen.findByTestId(`map-${entry.fips}`));
      expect(onCountyChange).toHaveBeenLastCalledWith(entry.fips, "push");
    }
    onCountyChange.mockClear();
    fireEvent.click(screen.getByTestId("map-99999"));
    expect(onCountyChange).not.toHaveBeenCalled();
  });

  it.each(["01001", "01003", "01005"])(
    "retains direct-link selection %s and builds factual handoff",
    async (fips) => {
      picture(fips);
      const preview = await screen.findByTestId(
        "review-published-county-preview"
      );
      expect(preview).toHaveAttribute("data-fips", fips);
      expect(screen.getByTestId("review-compare")).toHaveAttribute(
        "href",
        expect.stringContaining(`county=${fips}`)
      );
      expect(screen.queryByTestId("review-investigate")).toBeNull();
      expect(screen.queryByTestId("review-ask-atlas")).toBeNull();
      await waitFor(() =>
        expect(loadInvestigateCountyRecord).toHaveBeenCalledWith(
          expect.objectContaining({ fips, releaseId })
        )
      );
      expect(onCountyChange).not.toHaveBeenCalled();
    }
  );

  it.each(["01999", "08001"])(
    "clears unpublished or out-of-scope %s only after directory confirmation",
    async (fips) => {
      picture(fips);
      await waitFor(() =>
        expect(onCountyChange).toHaveBeenCalledWith(null, "replace")
      );
      expect(loadInvestigateCountyRecord).not.toHaveBeenCalled();
      expect(screen.queryByTestId("review-compare")).not.toBeInTheDocument();
    }
  );

  it("does not clear a county while the directory is loading or failed", async () => {
    vi.mocked(fetchExploreCountyDirectory).mockRejectedValue(new Error("503"));
    picture("01003");
    expect(onCountyChange).not.toHaveBeenCalled();
    await screen.findByText(/Published counties could not be loaded/);
    expect(onCountyChange).not.toHaveBeenCalled();
    expect(loadInvestigateCountyRecord).not.toHaveBeenCalled();
  });

  it("preserves candidate rationale separately from factual exploration", async () => {
    picture("01003", releaseId, true);
    await expect(
      screen.findByTestId("review-preview-why")
    ).resolves.toHaveTextContent("Authoritative reason");
    expect(
      screen.queryByTestId("review-published-county-preview")
    ).not.toBeInTheDocument();
  });

  it("pins directory and profile requests to the requested release", async () => {
    picture("01003", "different-release");
    await waitFor(() =>
      expect(fetchExploreCountyDirectory).toHaveBeenCalledWith(
        "different-release",
        expect.any(AbortSignal)
      )
    );
    await waitFor(() =>
      expect(loadInvestigateCountyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ releaseId: "different-release" })
      )
    );
  });

  it("shows profile loading, operational failure and absent record distinctly", async () => {
    vi.mocked(loadInvestigateCountyRecord).mockRejectedValue(
      new Error("release mismatch")
    );
    picture("01003");
    await screen.findByText(/Published county evidence could not be loaded/);
    expect(screen.queryByText(/case-count floor is 5/)).not.toBeInTheDocument();
    cleanup();
    vi.mocked(loadInvestigateCountyRecord).mockResolvedValue(null);
    picture("01003");
    await screen.findByText(/No published county record was returned/);
  });

  it("renders captured production floor, null and pathogen no-record semantics", async () => {
    picture("01003");
    await screen.findByText(/case-count floor is 5/);
    expect(
      screen.queryByText(/A published floor is a minimum/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/does not establish pathogen absence/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /No county-level B. burgdorferi detection record is available/
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("review-rationale")).toBeInTheDocument();
    for (const detail of [autauga, barbour]) {
      const evidence = reviewHumanFloorEvidence(
        CountyV1CountiesFipsGetResponse.parse(detail)
      );
      expect(evidence.displayValue).toBe("Unavailable");
      expect(evidence.valueNote).toContain("not converted to zero");
      expect(evidence.provenance.observationPeriod).toBe("2023");
    }
  });

  it("withholds cached facts when a profile refresh fails", async () => {
    const view = picture("01003");
    await screen.findByText(/case-count floor is 5/);
    vi.mocked(loadInvestigateCountyRecord).mockRejectedValue(new Error("503"));
    await view.client.invalidateQueries({
      queryKey: ["ux-reset-review-published-county"],
    });
    await screen.findByText(/Published county evidence could not be loaded/);
    expect(screen.queryByText(/case-count floor is 5/)).toBeNull();
    expect(onCountyChange).not.toHaveBeenCalled();
  });

  it("withholds cached identities after directory refresh failure without clearing URL", async () => {
    const view = picture("01003");
    await screen.findByText(/case-count floor is 5/);
    vi.mocked(fetchExploreCountyDirectory).mockRejectedValue(new Error("503"));
    await view.client.invalidateQueries({
      queryKey: ["ux-reset-review-county-directory"],
    });
    await screen.findByText(/Published counties could not be loaded/);
    expect(screen.queryByTestId("review-published-county-preview")).toBeNull();
    expect(onCountyChange).not.toHaveBeenCalled();
  });

  it("keeps selection during loading and clears it only for a successful empty directory", async () => {
    const pending = Promise.withResolvers<typeof identities>();
    vi.mocked(fetchExploreCountyDirectory).mockReturnValue(pending.promise);
    picture("01003");
    expect(screen.getByText("Loading published counties…")).toBeInTheDocument();
    expect(onCountyChange).not.toHaveBeenCalled();
    pending.resolve([]);
    await screen.findByText(/No published counties were returned/);
    await waitFor(() =>
      expect(onCountyChange).toHaveBeenCalledWith(null, "replace")
    );
  });

  it.each([
    {
      status: "SUPPRESSED",
      floor: null,
      display: "Suppressed",
      availability: "limited",
    },
    {
      status: "published_count_floor",
      floor: 0,
      display: "0 (published count floor)",
      availability: "limited",
    },
    {
      status: "published_count_floor",
      floor: null,
      display: "Unavailable",
      availability: "unavailable",
    },
    {
      status: "unexpected-status",
      floor: 5,
      display: "Unavailable",
      availability: "unavailable",
    },
    {
      status: "published_count_floor",
      floor: -1,
      display: "Unavailable",
      availability: "unavailable",
    },
  ])("keeps human status $status and floor $floor conservative", (entry) => {
    const model = reviewHumanFloorEvidence({
      ...CountyV1CountiesFipsGetResponse.parse(baldwin),
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: entry.status,
      case_count_floor_2023: entry.floor,
    });
    expect(model.displayValue).toBe(entry.display);
    expect(model.availability).toBe(entry.availability);
    expect(model.provenance.evidenceType).toBe("Unavailable");
  });
});
