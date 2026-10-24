import { setTimeout as delay } from "node:timers/promises";

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { ExplorerCountyEvidence } from "@/features/ux-reset/review/explorer-county-evidence";
import { CountySummarySurveillance } from "@/features/ux-reset/surveillance-intelligence/county-summary-surveillance";
import { ExplorerSurveillanceIntelligence } from "@/features/ux-reset/surveillance-intelligence/explorer-surveillance-intelligence";
import { SURVEILLANCE_INTELLIGENCE_GUIDE } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import { surveillanceSituationsQueryOptions } from "@/features/ux-reset/surveillance-intelligence/use-surveillance-situations";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import { AtlasApiError } from "@/lib/api-mutator";

import { reviewScopeScoresFixture } from "./fixtures/review-scope-api-fixtures";
import {
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const release: Tier1ActiveRelease = {
  releaseId: reviewScopeScoresFixture.release_id,
  status: "ready",
};

const { evidenceWorkspace, scoresGet, situationsGet, tier1Get } = vi.hoisted(
  () => ({
    evidenceWorkspace: {
      current: null as InvestigateWorkspace | null,
    },
    scoresGet:
      vi.fn<typeof import("@/generated/atlas").scoresV1AtlasScoresGet>(),
    situationsGet:
      vi.fn<
        typeof import("@/generated/atlas").countySurveillanceSituationsGet
      >(),
    tier1Get:
      vi.fn<
        typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
      >(),
  })
);

vi.mock(
  import("@/features/ux-reset/investigate/use-investigate-workspace"),
  () => ({
    useInvestigateWorkspace: () => {
      if (!evidenceWorkspace.current) {
        throw new Error("Explorer evidence workspace was not set.");
      }
      return evidenceWorkspace.current;
    },
  })
);

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    countySurveillanceSituationsGet: (
      ...args: Parameters<typeof situationsGet>
    ) => situationsGet(...args),
    countyTier1SurveillancePriorityGet: (
      ...args: Parameters<typeof tier1Get>
    ) => tier1Get(...args),
    scoresV1AtlasScoresGet: (...args: Parameters<typeof scoresGet>) =>
      scoresGet(...args),
  };
});

const SHA = "b".repeat(64);

function classification(
  classId: string,
  className: string,
  probability: number
) {
  return {
    activated_at: "2026-10-15T00:00:00Z",
    batch_id: "batch",
    batch_version: "batch-v1",
    class_description: `${className} groups published evidence.`,
    class_id: classId,
    class_name: className,
    county_sha256: SHA,
    data_authorization_id: "auth",
    data_publication_authorization: {},
    dictionary_sha256: SHA,
    feature_contract: {},
    fit_git_sha: "abc",
    handoff_approval: {},
    input_bundle_sha256: SHA,
    input_release_id: "governed-2026-10-15-january-climate-prod",
    limitations: ["Not pathogen presence."],
    model_id: "model",
    model_provenance: {},
    model_version: "situation-v1",
    probabilities: [
      {
        class_id: "decoy",
        probability: probability === 0 ? 1 : 1 - probability,
      },
      { class_id: classId, probability },
      { class_id: "other-a", probability: 0 },
      { class_id: "other-b", probability: 0 },
    ],
    source_provenance: {},
    staging_attempt: "1",
  };
}

function situationsBody(
  fips: string,
  four: ReturnType<typeof classification> | null,
  tick: ReturnType<typeof classification> | null,
  releaseId = reviewScopeScoresFixture.release_id
) {
  const unavailable = {
    availability: "UNAVAILABLE",
    batch_id: null,
    batch_version: null,
    compatibility: "UNAVAILABLE",
    data: null,
    input_release_id: null,
    model_id: "model",
    unavailable_reason: "NOT_PUBLISHED",
  };
  return {
    bundle_sha256: SHA,
    county_fips: fips,
    four_state: four
      ? {
          availability: "AVAILABLE",
          batch_id: "batch",
          batch_version: "batch-v1",
          compatibility: "EXACT_INPUT",
          data: four,
          input_release_id: four.input_release_id,
          model_id: "four",
          unavailable_reason: null,
        }
      : unavailable,
    release_id: releaseId,
    tick_pathogen: tick
      ? {
          availability: "AVAILABLE",
          batch_id: "batch",
          batch_version: "batch-v1",
          compatibility: "EXACT_INPUT",
          data: tick,
          input_release_id: tick.input_release_id,
          model_id: "tick",
          unavailable_reason: null,
        }
      : {
          ...unavailable,
          model_id: "tick",
          unavailable_reason: "INCOMPATIBLE_RELEASE",
        },
  };
}

function ok<T>(data: T) {
  return { data, headers: new Headers(), status: 200 as const };
}

function situationsResponse(
  fips: string,
  four: ReturnType<typeof classification> | null,
  tick: ReturnType<typeof classification> | null,
  releaseId = reviewScopeScoresFixture.release_id
) {
  return ok(situationsBody(fips, four, tick, releaseId)) as Awaited<
    ReturnType<
      typeof import("@/generated/atlas").countySurveillanceSituationsGet
    >
  >;
}

function renderIntelligence(
  fips = "01001",
  initialRelease: Tier1ActiveRelease = release
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Harness({ initialFips }: { initialFips: string }) {
    const [county, setCounty] = useState(initialFips);
    const [activeRelease, setActiveRelease] = useState(initialRelease);
    return (
      <>
        <button type="button" onClick={() => setCounty("08001")}>
          Switch county
        </button>
        <button type="button" onClick={() => setActiveRelease(release)}>
          Resolve release
        </button>
        <ExplorerSurveillanceIntelligence
          fips={county}
          release={activeRelease}
        />
      </>
    );
  }
  return render(
    <QueryClientProvider client={client}>
      <Harness initialFips={fips} />
    </QueryClientProvider>
  );
}

function renderView(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("Explorer County Surveillance Intelligence", () => {
  afterEach(() => {
    cleanup();
    evidenceWorkspace.current = null;
    scoresGet.mockReset();
    situationsGet.mockReset();
    tier1Get.mockReset();
  });

  it("requests the published score, Tier 1, and situations clients by FIPS", async () => {
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "08001",
        classification("class-3", "Pathogen not recorded", 0.25),
        classification("class-0", "Established blacklegged tick", 0.25)
      )
    );
    renderIntelligence("08001");
    await expect(screen.findByText("75.0")).resolves.toBeInTheDocument();
    expect(situationsGet).toHaveBeenCalledExactlyOnceWith(
      "08001",
      expect.anything()
    );
    expect(tier1Get).toHaveBeenCalledWith("08001", expect.anything());
    expect(scoresGet).toHaveBeenCalledOnce();
  });

  it("renders the county summary as four visual tiles with one closed expansion", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "08001",
        classification(
          "class-3",
          "A very long surveillance class name that must wrap inside the tile",
          0.25
        ),
        classification("class-0", "Established blacklegged tick", 0)
      )
    );
    renderView(<CountySummarySurveillance fips="08001" release={release} />);
    await screen.findByText("75.0");
    const grid = screen.getByTestId("surveillance-intelligence-grid");
    expect(
      [...grid.querySelectorAll("article")].map(
        (article) => article.dataset.perspective
      )
    ).toStrictEqual([
      "gap-score",
      "ml-review-priority",
      "surveillance-situation",
      "ecological-situation",
    ]);
    const priority = screen.getByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    const situation = screen.getByTestId(
      "surveillance-intelligence-card-surveillance-situation"
    );
    const ecological = screen.getByTestId(
      "surveillance-intelligence-card-ecological-situation"
    );
    expect({
      collapsed: screen.queryByTestId("surveillance-intelligence-details"),
      ecological: ecological.textContent,
      guideOpen: screen
        .getByTestId("surveillance-intelligence-guide")
        .hasAttribute("open"),
      confidence: priority.textContent?.includes("confidence") ?? false,
      percentile: priority.textContent,
      priority: priority.textContent,
      score: screen.getByTestId("selected-county-gap-score").textContent,
      situation: situation.textContent,
      zero: within(ecological).queryByRole("meter"),
    }).toStrictEqual({
      collapsed: null,
      confidence: false,
      ecological: expect.stringContaining("Established blacklegged tick"),
      guideOpen: false,
      percentile: expect.stringContaining(
        "Within-batch percentile 30.7 out of 100"
      ),
      priority: expect.stringContaining("LOW"),
      score: expect.stringContaining("75.0"),
      situation: expect.stringContaining(
        "A very long surveillance class name that must wrap inside the tile"
      ),
      zero: null,
    });
    await user.click(
      within(priority).getByRole("button", { name: /ML Review Priority/ })
    );
    const details = screen.getByTestId("surveillance-intelligence-details");
    await user.click(within(details).getByText("Methodology & source"));
    const methodology = details.textContent;
    within(situation).getByRole("button").focus();
    await user.keyboard(" ");
    const openDetails = screen.getByTestId("surveillance-intelligence-details");
    expect({
      anomalyBar: within(openDetails).queryByRole("progressbar", {
        name: /anomaly/i,
      }),
      methodology,
      perspective: openDetails.dataset.perspective,
      priorityExpanded: within(priority)
        .getByRole("button", { name: /ML Review Priority/ })
        .getAttribute("aria-expanded"),
    }).toStrictEqual({
      anomalyBar: null,
      methodology: expect.stringMatching(
        /Insufficient[\s\S]*not a probability/
      ),
      perspective: "surveillance-situation",
      priorityExpanded: "false",
    });
  });

  it("explains the surveillance and ecology patterns in each mark tooltip", async () => {
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "08001",
        classification("class-3", "Pathogen not recorded", 0.25),
        classification(
          "class-0",
          "Established blacklegged tick",
          0.999961073640964
        )
      )
    );
    renderView(<CountySummarySurveillance fips="08001" release={release} />);
    await screen.findByText("75.0");
    const tooltip = (id: string) =>
      within(
        screen.getByTestId(`surveillance-intelligence-card-${id}`)
      ).getByRole("button").dataset.tooltip;
    expect({
      ecology: tooltip("ecological-situation"),
      priority: tooltip("ml-review-priority"),
      score: tooltip("gap-score"),
      surveillance: tooltip("surveillance-situation"),
    }).toStrictEqual({
      ecology: expect.stringContaining(
        "Assigned group: Established blacklegged tick."
      ),
      priority: "Low · 30.7",
      score: "Published score",
      surveillance: expect.stringContaining(
        "Assigned group: Pathogen not recorded."
      ),
    });
    expect(tooltip("surveillance-situation")).not.toMatch(
      /strong fit|partial fit|no fit/i
    );
    expect(
      within(
        screen.getByTestId(
          "surveillance-intelligence-card-surveillance-situation"
        )
      )
        .getByRole("button")
        .querySelector(".lucide-clipboard-list")
    ).toBeTruthy();
    expect(
      within(
        screen.getByTestId(
          "surveillance-intelligence-card-ecological-situation"
        )
      )
        .getByRole("button")
        .querySelector("svg")
    ).toBeTruthy();
  });

  it("keeps v1 grouping and technical details collapsed until requested", async () => {
    const user = userEvent.setup();
    const four = classification(
      "surveillance-situation-four-state.v1.class-3",
      "Pathogen not recorded",
      0.8734583879465485
    );
    four.model_id = "surveillance-situation-four-state";
    four.model_version = "v1";
    four.probabilities = [
      {
        class_id: "surveillance-situation-four-state.v1.class-0",
        probability: 0.12654161205345155,
      },
      {
        class_id: "surveillance-situation-four-state.v1.class-1",
        probability: 0,
      },
      {
        class_id: "surveillance-situation-four-state.v1.class-2",
        probability: 5.481617999014906e-238,
      },
      {
        class_id: "surveillance-situation-four-state.v1.class-3",
        probability: 0.8734583879465485,
      },
    ];
    const tick = classification(
      "surveillance-situation-tick-pathogen.v1.class-1",
      "Blacklegged tick not established, pathogen not recorded",
      0.64
    );
    tick.model_id = "surveillance-situation-tick-pathogen";
    tick.model_version = "v1";
    tick.probabilities = [
      {
        class_id: "surveillance-situation-tick-pathogen.v1.class-0",
        probability: 0.2,
      },
      {
        class_id: "surveillance-situation-tick-pathogen.v1.class-1",
        probability: 0.64,
      },
      {
        class_id: "surveillance-situation-tick-pathogen.v1.class-2",
        probability: 0.16,
      },
      {
        class_id: "surveillance-situation-tick-pathogen.v1.class-3",
        probability: 0,
      },
    ];
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"))
    );
    situationsGet.mockResolvedValue(situationsResponse("08001", four, tick));
    renderView(<CountySummarySurveillance fips="08001" release={release} />);
    const situation = await screen.findByTestId(
      "surveillance-intelligence-card-surveillance-situation"
    );
    await waitFor(() => {
      expect(situation).toHaveTextContent("Pathogen not recorded");
    });
    expect({
      jargon: situation.textContent?.includes("Class membership") ?? false,
      label: situation.textContent,
    }).toStrictEqual({
      jargon: false,
      label: expect.stringContaining("Pathogen not recorded"),
    });
    await user.click(
      within(situation).getByRole("button", {
        name: /Combined surveillance pattern/,
      })
    );
    const details = screen.getByTestId("surveillance-intelligence-details");
    const grouping = within(details)
      .getByText("Model grouping details")
      .closest("details");
    const technical = within(details)
      .getByText("Technical details")
      .closest("details");
    expect({
      absence: details.textContent,
      classId: technical?.textContent,
      groupingOpen: grouping?.hasAttribute("open") ?? true,
      notation: technical?.textContent,
      release: details.textContent,
      technicalOpen: technical?.hasAttribute("open") ?? true,
    }).toStrictEqual({
      absence: expect.stringContaining(
        "No record does not mean the tick or pathogen is absent."
      ),
      classId: expect.stringContaining(
        "surveillance-situation-four-state.v1.class-3"
      ),
      groupingOpen: false,
      notation: expect.stringContaining("5.481617999014906e-238"),
      release: expect.stringContaining(
        "Model results use the same data release as this page."
      ),
      technicalOpen: false,
    });
    await user.click(within(details).getByText("Model grouping details"));
    expect({
      less: details.textContent?.includes("Less than 0.1%") ?? false,
      selected:
        details.textContent?.includes("87.3% — Assigned group") ?? false,
    }).toStrictEqual({ less: true, selected: true });
    await user.click(
      within(
        screen.getByTestId(
          "surveillance-intelligence-card-ecological-situation"
        )
      ).getByRole("button", {
        name: /Tick and pathogen pattern/,
      })
    );
    expect(
      screen.getByTestId("surveillance-intelligence-details").textContent
    ).toContain("Limited tick and pathogen records");
  });

  it("keeps a situation visible when Tier 1 fails, then retries only that model", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockRejectedValue(
      new AtlasApiError(
        "Model-assisted surveillance priority could not be loaded.",
        "/v1/counties/08001/tier1-surveillance-priority",
        503,
        null
      )
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "08001",
        classification("class-3", "Pathogen not recorded", 0.25),
        null
      )
    );
    renderIntelligence("08001");
    const priority = await screen.findByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    await waitFor(
      () => {
        expect(priority).toHaveTextContent("Could not be loaded");
      },
      { timeout: 8000 }
    );
    expect(
      screen.getByTestId(
        "surveillance-intelligence-card-surveillance-situation"
      )
    ).toHaveTextContent("Class membership 25.0%");
    expect(
      screen.getByTestId("surveillance-intelligence-card-ecological-situation")
    ).toHaveTextContent("Incompatible");
    expect(
      screen.getByTestId("surveillance-intelligence-guide")
    ).toHaveTextContent(SURVEILLANCE_INTELLIGENCE_GUIDE);
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "08001"))
    );
    await user.click(
      screen.getByTestId("surveillance-intelligence-retry-ml-review-priority")
    );
    await waitFor(() => {
      expect(priority).toHaveTextContent(
        "Percentile 30.7 · Evidence sufficiency Insufficient"
      );
    });
  });

  it("uses one inline details panel for mouse and keyboard activation", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Pathogen not recorded", 0.2),
        classification("class-0", "Established blacklegged tick", 0.2)
      )
    );
    renderIntelligence("01001");
    const situationButton = within(
      await screen.findByTestId(
        "surveillance-intelligence-card-surveillance-situation"
      )
    ).getByRole("button", { name: /Combined surveillance pattern/ });
    await user.click(situationButton);
    expect(situationButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByTestId("surveillance-intelligence-details")
    ).toHaveAttribute("data-perspective", "surveillance-situation");
    const gapButton = within(
      screen.getByTestId("surveillance-intelligence-card-gap-score")
    ).getByRole("button", { name: /Surveillance Gap Score/ });
    gapButton.focus();
    await user.keyboard("{Enter}");
    expect(gapButton).toHaveAttribute("aria-expanded", "true");
    expect(situationButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByTestId("surveillance-intelligence-details")
    ).toHaveTextContent("published Surveillance Gap Score");
  });

  it("closes the shared details panel with Space and on county change", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockImplementation(async (fips: string) =>
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, fips))
    );
    situationsGet.mockImplementation(
      async (fips: string, options?: RequestInit) => {
        if (fips === "01001") {
          await delay(30, undefined, {
            signal: options?.signal ?? undefined,
          });
        }
        return situationsResponse(
          fips,
          classification(
            fips === "01001" ? "late-class" : "denver-class",
            fips === "01001"
              ? "Late county class"
              : "Denver surveillance class",
            0.4
          ),
          classification(
            fips === "01001" ? "late-tick" : "denver-tick",
            fips === "01001"
              ? "Late ecological class"
              : "Denver ecological class",
            0.4
          )
        );
      }
    );
    renderIntelligence("01001");
    const gapButton = within(
      await screen.findByTestId("surveillance-intelligence-card-gap-score")
    ).getByRole("button", { name: /Surveillance Gap Score/ });
    gapButton.focus();
    await user.keyboard(" ");
    expect(gapButton).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(
      screen.queryByTestId("surveillance-intelligence-details")
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch county" }));
    await screen.findByText("Denver surveillance class");
    expect(screen.queryByText("Late county class")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("county-surveillance-intelligence")
    ).toHaveAttribute("data-fips", "08001");
  });

  it("exposes headings, the responsive grid, and reduced-motion styling", async () => {
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Named class", 0.2),
        null
      )
    );
    renderIntelligence("01001");
    await expect(
      screen.findByRole("heading", {
        name: "County Surveillance Intelligence",
      })
    ).resolves.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    expect(screen.getByTestId("surveillance-intelligence-grid")).toHaveClass(
      "grid-cols-1",
      "md:grid-cols-2"
    );
    expect(
      screen.getByRole("button", { name: /Surveillance Gap Score/ }).className
    ).toContain("motion-reduce:transition-none");
    expect(
      screen.getByTestId("county-surveillance-intelligence")
    ).not.toHaveTextContent(/composite|models agree|models disagree/i);
  });

  it("drops an in-flight county when the section unmounts", async () => {
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockImplementation(
      async (_fips: string, options?: RequestInit) => {
        await delay(60_000, undefined, {
          signal: options?.signal ?? undefined,
        });
        return situationsResponse("01001", null, null);
      }
    );
    const view = renderView(
      <ExplorerSurveillanceIntelligence fips="01001" release={release} />
    );
    await expect(
      screen.findAllByText("Class membership is loading.")
    ).resolves.not.toHaveLength(0);
    view.unmount();
    expect(
      screen.queryByTestId("county-surveillance-intelligence")
    ).not.toBeInTheDocument();
  });

  it("requests situations for a valid FIPS without a page release", () => {
    const client = new QueryClient();
    expect(
      surveillanceSituationsQueryOptions("0100", client).enabled
    ).toBeFalsy();
    expect(
      surveillanceSituationsQueryOptions("01001", client).enabled
    ).toBeTruthy();
  });

  it("requests situations while the page release is still pending", async () => {
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Pathogen not recorded", 0.2),
        classification("class-0", "Established blacklegged tick", 0.2)
      )
    );
    renderIntelligence("01001", { status: "pending" });
    await screen.findByText("Pathogen not recorded");
    expect(situationsGet).toHaveBeenCalledOnce();
    expect(situationsGet).toHaveBeenCalledExactlyOnceWith(
      "01001",
      expect.anything()
    );
    expect(tier1Get).toHaveBeenCalledWith("01001", expect.anything());
  });

  it("shows a situation response whose release does not match the page", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Pathogen not recorded", 0.2),
        classification("class-0", "Established blacklegged tick", 0.2),
        "governed-other-release"
      )
    );
    renderIntelligence("01001");
    const card = await screen.findByTestId(
      "surveillance-intelligence-card-surveillance-situation"
    );
    await within(card).findByText("Pathogen not recorded");
    expect(card).not.toHaveTextContent("Not shown for this page release");
    await user.click(
      within(card).getByRole("button", {
        name: /Combined surveillance pattern/,
      })
    );
    const disclosure = screen.getByTestId(
      "surveillance-intelligence-disclosure"
    );
    expect(disclosure).toHaveTextContent("governed-other-release");
    expect(card).toHaveTextContent("Pathogen not recorded");
  });

  it("shows governed source provenance in the situation disclosure", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(ok(reviewScopeScoresFixture));
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    const four = classification("class-3", "Pathogen not recorded", 0.2);
    four.source_provenance = {
      human: {
        dataset_id: "x5j9-wybp",
        source_id: "cdc_lyme",
        vintage: "2023",
      },
    };
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        four,
        classification("class-0", "Established blacklegged tick", 0.2)
      )
    );
    renderIntelligence("01001");
    const card = await screen.findByTestId(
      "surveillance-intelligence-card-surveillance-situation"
    );
    await user.click(
      within(card).getByRole("button", {
        name: /Combined surveillance pattern/,
      })
    );
    expect(
      screen.getByTestId("surveillance-intelligence-disclosure")
    ).toHaveTextContent("cdc_lyme · x5j9-wybp · vintage 2023");
    expect(
      screen.getByTestId("surveillance-intelligence-disclosure")
    ).toHaveTextContent(release.releaseId);
  });
});

const PAGE_RELEASE = "governed-2026-10-15-january-climate-prod";

function countyEvidenceWorkspace(releaseId: string): InvestigateWorkspace {
  return {
    bundle: null,
    catalogError: null,
    catalogRefreshError: null,
    compare: [],
    countyDetail: null,
    countyRecord: null,
    countyRecordAbsent: false,
    countyRecordError: null,
    countyRecordLoading: false,
    countyRecordRefreshError: null,
    directory: [],
    directoryError: null,
    directoryLoading: false,
    directoryRefreshError: null,
    evidenceError: null,
    evidenceFetching: false,
    evidenceLoading: false,
    identity: {
      fips: "01001",
      label: "Autauga County",
      stateCode: "AL",
    },
    indicatorError: null,
    indicatorRefreshError: null,
    measures: [],
    metadata: null,
    metadataError: null,
    metadataLoading: false,
    metadataRefreshError: null,
    observationOutcome: "settled-absent",
    period: null,
    recovery: null,
    releaseId,
    requestedDataset: null,
    requestedFips: "01001",
    retryDirectory: vi.fn<() => void>(),
    retryEvidence: vi.fn<() => void>(),
    scope: "AL",
    scopeLabel: "Alabama",
    selection: { kind: "missing" },
    setCounty: vi.fn<(fips: string) => void>(),
    stateLabel: "Alabama (AL)",
    suggestedFollowUpEvidence: null,
  };
}

function renderCountyEvidence(releaseId: string) {
  evidenceWorkspace.current = countyEvidenceWorkspace(releaseId);
  renderView(
    <ExplorerCountyEvidence
      followUp={{ status: "factual" }}
      methodologyLabel={null}
      mode="evidence"
      onBackToMap={vi.fn<() => void>()}
    />
  );
}

describe("Explorer county evidence owns one Tier 1 presentation", () => {
  afterEach(() => {
    cleanup();
    evidenceWorkspace.current = null;
    scoresGet.mockReset();
    situationsGet.mockReset();
    tier1Get.mockReset();
  });

  async function showPriority() {
    scoresGet.mockResolvedValue(
      ok({ ...reviewScopeScoresFixture, release_id: PAGE_RELEASE })
    );
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Pathogen not recorded", 0.2),
        classification("class-0", "Established blacklegged tick", 0.2),
        PAGE_RELEASE
      )
    );
    renderCountyEvidence(PAGE_RELEASE);
    const priority = await screen.findByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    await within(priority).findByText("LOW");
    return priority;
  }

  it("shows the tier when the model release differs from the page", async () => {
    scoresGet.mockResolvedValue(
      ok({ ...reviewScopeScoresFixture, release_id: PAGE_RELEASE })
    );
    tier1Get.mockResolvedValue(
      ok(tier1PriorityForCounty(tier1LowInsufficientFixture, "01001"))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        "01001",
        classification("class-3", "Pathogen not recorded", 0.2),
        classification("class-0", "Established blacklegged tick", 0.2),
        PAGE_RELEASE
      )
    );
    renderCountyEvidence(PAGE_RELEASE);
    const priority = await screen.findByTestId(
      "surveillance-intelligence-card-ml-review-priority"
    );
    await waitFor(() => {
      expect(priority).toHaveTextContent("LOW");
    });
    expect(priority).toHaveTextContent("Evidence sufficiency Insufficient");
    expect(priority).not.toHaveTextContent("Not shown for this page release");
    await userEvent.click(
      within(priority).getByRole("button", { name: /ML Review Priority/ })
    );
    expect(
      screen.queryByTestId("tier1-surveillance-priority")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/different release than the evidence on screen/)
    ).not.toBeInTheDocument();
    expect(tier1Get).toHaveBeenCalledOnce();
  });

  it("shows LOW and Insufficient once when the model release matches", async () => {
    const priority = await showPriority();
    expect(priority).toHaveTextContent("LOW");
    expect(priority).toHaveTextContent("Evidence sufficiency Insufficient");
    expect(screen.getAllByText("LOW")).toHaveLength(1);
    expect(
      screen.queryByTestId("tier1-surveillance-priority")
    ).not.toBeInTheDocument();
    expect(tier1Get).toHaveBeenCalledOnce();
  });
});
