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

import { CompareSurveillanceIntelligence } from "@/features/ux-reset/compare/compare-surveillance-intelligence";
import {
  SURVEILLANCE_INTELLIGENCE_GUIDE,
  SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import type { Tier1ActiveRelease } from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models/tier1CountyPriority";
import { AtlasApiError } from "@/lib/api-mutator";

import { reviewScopeScoresFixture } from "./fixtures/review-scope-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const PAGE_RELEASE = reviewScopeScoresFixture.release_id;
const release: Tier1ActiveRelease = {
  releaseId: PAGE_RELEASE,
  status: "ready",
};

const { scoresGet, situationsGet, tier1Get } = vi.hoisted(() => ({
  scoresGet: vi.fn<typeof import("@/generated/atlas").scoresV1AtlasScoresGet>(),
  situationsGet:
    vi.fn<typeof import("@/generated/atlas").countySurveillanceSituationsGet>(),
  tier1Get:
    vi.fn<
      typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
    >(),
}));

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
const LEFT = "01001";
const RIGHT = "08001";

function classification(
  classId: string,
  className: string,
  probability: number,
  inputReleaseId = "governed-2026-10-15-january-climate-prod"
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
    input_release_id: inputReleaseId,
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

function unavailableVariant(reason: string) {
  return {
    availability: "UNAVAILABLE",
    batch_id: null,
    batch_version: null,
    compatibility: "UNAVAILABLE",
    data: null,
    input_release_id: null,
    model_id: "model",
    unavailable_reason: reason,
  };
}

function availableVariant(
  data: ReturnType<typeof classification>,
  modelId: string
) {
  return {
    availability: "AVAILABLE",
    batch_id: "batch",
    batch_version: "batch-v1",
    compatibility: "EXACT_INPUT",
    data,
    input_release_id: data.input_release_id,
    model_id: modelId,
    unavailable_reason: null,
  };
}

function situationsBody(
  fips: string,
  four:
    | ReturnType<typeof availableVariant>
    | ReturnType<typeof unavailableVariant>,
  tick:
    | ReturnType<typeof availableVariant>
    | ReturnType<typeof unavailableVariant>,
  releaseId = reviewScopeScoresFixture.release_id
) {
  return {
    bundle_sha256: SHA,
    county_fips: fips,
    four_state: four,
    release_id: releaseId,
    tick_pathogen: tick,
  };
}

function ok<T>(data: T) {
  return { data, headers: new Headers(), status: 200 as const };
}

function situationsResponse(
  fips: string,
  four:
    | ReturnType<typeof availableVariant>
    | ReturnType<typeof unavailableVariant>,
  tick:
    | ReturnType<typeof availableVariant>
    | ReturnType<typeof unavailableVariant>,
  releaseId = reviewScopeScoresFixture.release_id
) {
  return ok(situationsBody(fips, four, tick, releaseId)) as Awaited<
    ReturnType<
      typeof import("@/generated/atlas").countySurveillanceSituationsGet
    >
  >;
}

function pageTier1(result: Tier1CountyPriority, fips: string) {
  return tier1PriorityForCounty(result, fips);
}

function scoresResponse(counties: readonly { fips: string; score: number }[]) {
  const template = reviewScopeScoresFixture.counties[0];
  if (!template) {
    throw new Error("Score fixture is empty.");
  }
  return ok({
    ...reviewScopeScoresFixture,
    counties: counties.map((county) => ({
      ...template,
      county: county.fips,
      fips: county.fips,
      in_contiguous_tick_scope: true,
      score: { ...template.score, score: county.score },
    })),
  });
}

function renderPair(left = LEFT, right = RIGHT) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Harness({
    initialLeft,
    initialRight,
  }: {
    initialLeft: string;
    initialRight: string;
  }) {
    const [pair, setPair] = useState({
      left: initialLeft,
      right: initialRight,
    });
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setPair({ left: "08013", right: "36001" });
          }}
        >
          Switch pair
        </button>
        <CompareSurveillanceIntelligence
          leftFips={pair.left}
          leftLabel={`County A ${pair.left}`}
          release={release}
          rightFips={pair.right}
          rightLabel={`County B ${pair.right}`}
        />
      </>
    );
  }
  return render(
    <QueryClientProvider client={client}>
      <Harness initialLeft={left} initialRight={right} />
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

function installHappyPath() {
  scoresGet.mockResolvedValue(
    scoresResponse([
      { fips: LEFT, score: 36.64 },
      { fips: RIGHT, score: 0 },
      { fips: "08013", score: 70 },
      { fips: "36001", score: 60 },
    ])
  );
  tier1Get.mockImplementation(async (fips: string) => {
    if (fips === LEFT) {
      return ok(pageTier1(tier1LowInsufficientFixture, fips));
    }
    return ok(pageTier1(tier1HighSufficientFixture, fips));
  });
  situationsGet.mockImplementation(async (fips: string) => {
    if (fips === LEFT) {
      return situationsResponse(
        fips,
        availableVariant(
          classification("class-3", "Pathogen not recorded", 0.873),
          "four"
        ),
        unavailableVariant("NOT_PUBLISHED")
      );
    }
    return situationsResponse(
      fips,
      unavailableVariant("INCOMPATIBLE_RELEASE"),
      availableVariant(
        classification(
          "class-0",
          "Established blacklegged tick",
          0.999,
          "other-release"
        ),
        "tick"
      )
    );
  });
}

describe("Compare County Surveillance Intelligence", () => {
  afterEach(() => {
    cleanup();
    scoresGet.mockReset();
    situationsGet.mockReset();
    tier1Get.mockReset();
  });

  it("requests each existing client once per county and keeps row order", async () => {
    installHappyPath();
    renderPair();
    const table = await screen.findByTestId(
      "compare-surveillance-intelligence-table"
    );
    await waitFor(() => {
      expect(
        screen.getByTestId(`compare-surveillance-cell-gap-score-${LEFT}`)
      ).toHaveTextContent("36.6");
    });
    const rows = within(table).getAllByRole("listitem");
    expect(rows.map((row) => row.dataset.perspective)).toStrictEqual([
      ...SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
    ]);
    expect(scoresGet).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ dataset_version: PAGE_RELEASE }),
      expect.anything()
    );
    expect(tier1Get.mock.calls.map((call) => call[0]).sort()).toStrictEqual([
      LEFT,
      RIGHT,
    ]);
    expect(
      situationsGet.mock.calls.map((call) => call[0]).sort()
    ).toStrictEqual([LEFT, RIGHT]);
  });

  it("shows each county gap score and keeps zero distinct from a missing score", async () => {
    installHappyPath();
    renderPair();
    const gapLeft = await screen.findByTestId(
      `compare-surveillance-cell-gap-score-${LEFT}`
    );
    await waitFor(() => {
      expect(gapLeft).toHaveTextContent("36.6");
    });
    expect(gapLeft).toHaveTextContent("Human/ecological discordance");
    expect(gapLeft).toHaveTextContent("Full value 36.64");
    const gapRight = screen.getByTestId(
      `compare-surveillance-cell-gap-score-${RIGHT}`
    );
    expect(gapRight).toHaveTextContent("0.0");
    expect(gapRight).not.toHaveTextContent("Unavailable");
  });

  it("shows LOW with insufficient evidence beside an independent HIGH result", async () => {
    installHappyPath();
    renderPair();
    const priorityLeft = await screen.findByTestId(
      `compare-surveillance-cell-ml-review-priority-${LEFT}`
    );
    await waitFor(() => {
      expect(priorityLeft).toHaveTextContent("LOW");
    });
    expect(priorityLeft).toHaveTextContent("Percentile 30.7");
    expect(priorityLeft).toHaveTextContent("Evidence sufficiency Insufficient");
    const priorityRight = screen.getByTestId(
      `compare-surveillance-cell-ml-review-priority-${RIGHT}`
    );
    expect(priorityRight).toHaveTextContent("HIGH");
    expect(priorityRight).toHaveTextContent("Evidence sufficiency Sufficient");
  });

  it("keeps situation availability independent and uses the matching class id", async () => {
    installHappyPath();
    renderPair();
    const situationLeft = await screen.findByTestId(
      `compare-surveillance-cell-surveillance-situation-${LEFT}`
    );
    await waitFor(() => {
      expect(situationLeft).toHaveTextContent("Pathogen not recorded");
    });
    expect(situationLeft).toHaveTextContent("Class membership 87.3%");
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-ecological-situation-${LEFT}`
      )
    ).toHaveTextContent("Unavailable");
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-surveillance-situation-${RIGHT}`
      )
    ).toHaveTextContent("Incompatible");
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-ecological-situation-${RIGHT}`
      )
    ).toHaveTextContent("Established blacklegged tick");
  });

  it("reuses the fixed guide and does not invent a comparison verdict", async () => {
    installHappyPath();
    renderPair();
    await screen.findByText("Pathogen not recorded");
    expect(screen.getByTestId("compare-intelligence-guide")).toHaveTextContent(
      SURVEILLANCE_INTELLIGENCE_GUIDE
    );
    expect(
      screen.getByTestId("compare-surveillance-intelligence")
    ).not.toHaveTextContent(
      /composite|winner|loser|differ by|models agree|delta/i
    );
  });

  it("keeps a missing county score distinct from zero", async () => {
    scoresGet.mockResolvedValue(scoresResponse([{ fips: RIGHT, score: 0 }]));
    tier1Get.mockResolvedValue(
      ok(pageTier1(tier1LowInsufficientFixture, LEFT))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        LEFT,
        unavailableVariant("NOT_PUBLISHED"),
        unavailableVariant("NOT_PUBLISHED")
      )
    );
    renderPair();
    const missing = await screen.findByTestId(
      `compare-surveillance-cell-gap-score-${LEFT}`
    );
    await waitFor(() => {
      expect(missing).toHaveTextContent("Unavailable");
    });
    expect(missing).not.toHaveTextContent("0.0");
    expect(
      screen.getByTestId(`compare-surveillance-cell-gap-score-${RIGHT}`)
    ).toHaveTextContent("0.0");
  });

  it("opens one paired details region below the table", async () => {
    const user = userEvent.setup();
    installHappyPath();
    renderPair();
    const situationButton = await screen.findByRole("button", {
      name: "Combined surveillance pattern",
    });
    await user.click(situationButton);
    const table = screen.getByTestId("compare-surveillance-intelligence-table");
    const details = screen.getByTestId(
      "compare-surveillance-intelligence-details"
    );
    expect(table.compareDocumentPosition(details)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(situationButton).toHaveAttribute("aria-expanded", "true");
    const panels = screen.getAllByTestId("surveillance-intelligence-details");
    expect(panels).toHaveLength(2);
    expect(panels[0]).toHaveTextContent("County A");
    expect(panels[1]).toHaveTextContent("County B");
  });

  it("reads class membership from the matching class id in paired details", async () => {
    const user = userEvent.setup();
    installHappyPath();
    renderPair();
    await user.click(
      await screen.findByRole("button", {
        name: "Combined surveillance pattern",
      })
    );
    const panels = screen.getAllByTestId("surveillance-intelligence-details");
    expect(panels[0]).toHaveAttribute("data-fips", LEFT);
    expect(panels[0]).toHaveTextContent("class-3");
    expect(panels[0]).toHaveTextContent("87.3%");
    expect(panels[0]).toHaveTextContent("0.873");
    expect(panels[1]).toHaveTextContent(
      "This model result cannot be shown with the data release used by this page."
    );
  });

  it("replaces the open perspective from the keyboard and closes it with Space", async () => {
    const user = userEvent.setup();
    installHappyPath();
    renderPair();
    const situationButton = await screen.findByRole("button", {
      name: "Combined surveillance pattern",
    });
    await user.click(situationButton);
    const gapButton = screen.getByRole("button", {
      name: "Surveillance Gap Score",
    });
    gapButton.focus();
    await user.keyboard("{Enter}");
    expect(gapButton).toHaveAttribute("aria-expanded", "true");
    expect(situationButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getAllByTestId("surveillance-intelligence-details")[0]
    ).toHaveTextContent("36.6");
    await user.keyboard(" ");
    expect(
      screen.queryByTestId("compare-surveillance-intelligence-details")
    ).not.toBeInTheDocument();
  });

  it("shows mixed releases in disclosure without equating them", async () => {
    const user = userEvent.setup();
    installHappyPath();
    renderPair();
    await screen.findByText("LOW");
    await user.click(
      screen.getByRole("button", { name: "ML Review Priority" })
    );
    const priority = screen.getAllByTestId("surveillance-intelligence-details");
    const priorityText = priority[0]?.textContent ?? "";
    expect({
      modelRelease: priorityText.includes(
        "governed-2026-09-18-unknown-coverage"
      ),
      pageRelease: priorityText.includes(PAGE_RELEASE),
      releaseLabel: priorityText.includes("Model input release"),
    }).toStrictEqual({
      modelRelease: true,
      pageRelease: false,
      releaseLabel: true,
    });
    await user.click(
      screen.getByRole("button", { name: "Tick and pathogen pattern" })
    );
    const ecological = screen.getAllByTestId(
      "surveillance-intelligence-details"
    );
    const leftText = ecological[0]?.textContent ?? "";
    const rightText = ecological[1]?.textContent ?? "";
    expect({
      leftUnpublished: leftText.includes("not published"),
      rightRelease: rightText.includes("other-release"),
    }).toStrictEqual({
      leftUnpublished: true,
      rightRelease: true,
    });
    expect(ecological[1]).toHaveTextContent("99.9% (full value 0.999)");
  });

  it("loads situations while the page release is still pending", async () => {
    installHappyPath();
    renderView(
      <CompareSurveillanceIntelligence
        leftFips={LEFT}
        leftLabel="Autauga"
        release={{ status: "pending" }}
        rightFips={RIGHT}
        rightLabel="Adams"
      />
    );
    await screen.findAllByText("Pathogen not recorded");
    expect(situationsGet).toHaveBeenCalledWith(LEFT, expect.anything());
    expect(situationsGet).toHaveBeenCalledWith(RIGHT, expect.anything());
    expect(tier1Get).toHaveBeenCalledWith(LEFT, expect.anything());
    expect(tier1Get).toHaveBeenCalledWith(RIGHT, expect.anything());
  });

  it("shows situation classes when the response release differs from the page", async () => {
    scoresGet.mockResolvedValue(
      scoresResponse([
        { fips: LEFT, score: 36.6 },
        { fips: RIGHT, score: 14.8 },
      ])
    );
    tier1Get.mockImplementation(async (fips: string) =>
      ok(pageTier1(tier1LowInsufficientFixture, fips))
    );
    situationsGet.mockImplementation(async (fips: string) =>
      situationsResponse(
        fips,
        availableVariant(
          classification("class-3", `${fips} class`, 0.2),
          "four"
        ),
        unavailableVariant("NOT_PUBLISHED"),
        fips === LEFT ? "other-situation-release" : PAGE_RELEASE
      )
    );
    renderPair();
    const leftSituation = await screen.findByTestId(
      `compare-surveillance-cell-surveillance-situation-${LEFT}`
    );
    await waitFor(() => {
      expect(leftSituation).toHaveTextContent(`${LEFT} class`);
    });
    expect(leftSituation).not.toHaveTextContent(
      "Not shown for this page release"
    );
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-surveillance-situation-${RIGHT}`
      )
    ).toHaveTextContent(`${RIGHT} class`);
  });

  it("shows a tier when the model release differs from the page", async () => {
    scoresGet.mockResolvedValue(
      scoresResponse([
        { fips: LEFT, score: 36.6 },
        { fips: RIGHT, score: 14.8 },
      ])
    );
    tier1Get.mockImplementation(async (fips: string) =>
      ok(pageTier1(tier1LowInsufficientFixture, fips))
    );
    situationsGet.mockResolvedValue(
      situationsResponse(
        LEFT,
        unavailableVariant("NOT_PUBLISHED"),
        unavailableVariant("NOT_PUBLISHED")
      )
    );
    renderPair();
    const rightPriority = await screen.findByTestId(
      `compare-surveillance-cell-ml-review-priority-${RIGHT}`
    );
    await waitFor(() => {
      expect(rightPriority).toHaveTextContent("LOW");
    });
    expect(rightPriority).not.toHaveTextContent(
      "Not shown for this page release"
    );
    expect(
      screen.getByTestId(`compare-surveillance-cell-ml-review-priority-${LEFT}`)
    ).toHaveTextContent("LOW");
  });

  it("retries one county without clearing the other county's result", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(
      scoresResponse([
        { fips: LEFT, score: 36.6 },
        { fips: RIGHT, score: 70 },
      ])
    );
    let failLeft = true;
    tier1Get.mockImplementation(async (fips: string) => {
      if (fips === LEFT && failLeft) {
        throw new AtlasApiError(
          "Model-assisted surveillance priority could not be loaded.",
          `/v1/counties/${fips}/tier1-surveillance-priority`,
          503,
          null
        );
      }
      return ok(
        pageTier1(
          fips === LEFT
            ? tier1LowInsufficientFixture
            : tier1HighSufficientFixture,
          fips
        )
      );
    });
    situationsGet.mockImplementation(async (fips: string) =>
      situationsResponse(
        fips,
        availableVariant(
          classification("class-3", `${fips} class`, 0.2),
          "four"
        ),
        unavailableVariant("NOT_PUBLISHED")
      )
    );
    renderPair();
    const leftPriority = await screen.findByTestId(
      `compare-surveillance-cell-ml-review-priority-${LEFT}`
    );
    await waitFor(
      () => {
        expect(leftPriority).toHaveTextContent("Could not be loaded");
      },
      { timeout: 8000 }
    );
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-ml-review-priority-${RIGHT}`
      )
    ).toHaveTextContent("HIGH");
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-surveillance-situation-${LEFT}`
      )
    ).toHaveTextContent(`${LEFT} class`);
    failLeft = false;
    await user.click(
      screen.getByTestId(
        `compare-surveillance-retry-ml-review-priority-${LEFT}`
      )
    );
    await waitFor(() => {
      expect(leftPriority).toHaveTextContent("LOW");
    });
    expect(
      screen.getByTestId(
        `compare-surveillance-cell-ml-review-priority-${RIGHT}`
      )
    ).toHaveTextContent("HIGH");
  }, 15_000);

  it("closes details and drops the previous county when the pair changes", async () => {
    const user = userEvent.setup();
    scoresGet.mockResolvedValue(
      scoresResponse([
        { fips: LEFT, score: 36.6 },
        { fips: RIGHT, score: 70 },
        { fips: "08013", score: 12 },
        { fips: "36001", score: 11 },
      ])
    );
    tier1Get.mockImplementation(async (fips: string) =>
      ok(pageTier1(tier1LowInsufficientFixture, fips))
    );
    situationsGet.mockImplementation(
      async (fips: string, options?: RequestInit) => {
        if (fips === LEFT) {
          await delay(40, undefined, { signal: options?.signal ?? undefined });
        }
        return situationsResponse(
          fips,
          availableVariant(
            classification(
              `${fips}-class`,
              fips === LEFT
                ? "Late Autauga class"
                : `${fips} surveillance class`,
              0.4
            ),
            "four"
          ),
          availableVariant(
            classification(`${fips}-tick`, `${fips} ecological class`, 0.4),
            "tick"
          )
        );
      }
    );
    renderPair();
    const gapButton = await screen.findByRole("button", {
      name: "Surveillance Gap Score",
    });
    gapButton.focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Switch pair" }));
    await screen.findByText("08013 surveillance class");
    expect(screen.queryByText("Late Autauga class")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("compare-surveillance-intelligence-details")
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("compare-surveillance-cell-gap-score-08013")
    ).toHaveAttribute("data-county", "County A, County A 08013");
    expect(
      screen.getByTestId("compare-surveillance-cell-gap-score-36001")
    ).toHaveAttribute("data-side", "b");
  });

  it("exposes headings, expanded state, and reduced-motion styling", async () => {
    installHappyPath();
    renderPair();
    await expect(
      screen.findByRole("heading", {
        name: "County Surveillance Intelligence",
      })
    ).resolves.toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Surveillance Gap Score",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.className).toContain("motion-reduce:transition-none");
    expect(
      screen.getByTestId(`compare-surveillance-cell-gap-score-${LEFT}`)
    ).toHaveAttribute("data-county", "County A, County A 01001");
    expect(
      screen.getByTestId(`compare-surveillance-cell-gap-score-${RIGHT}`)
    ).toHaveAttribute("data-county", expect.stringMatching(/County B/));
  });

  it("drops an in-flight county when the section unmounts", async () => {
    scoresGet.mockResolvedValue(scoresResponse([{ fips: LEFT, score: 1 }]));
    tier1Get.mockResolvedValue(
      ok(pageTier1(tier1LowInsufficientFixture, LEFT))
    );
    situationsGet.mockImplementation(
      async (_fips: string, options?: RequestInit) => {
        await delay(60_000, undefined, {
          signal: options?.signal ?? undefined,
        });
        return situationsResponse(
          LEFT,
          unavailableVariant("NOT_PUBLISHED"),
          unavailableVariant("NOT_PUBLISHED")
        );
      }
    );
    const view = renderView(
      <CompareSurveillanceIntelligence
        leftFips={LEFT}
        leftLabel="Autauga"
        release={release}
        rightFips={RIGHT}
        rightLabel="Adams"
      />
    );
    await expect(
      screen.findAllByText("Class membership is loading.")
    ).resolves.not.toHaveLength(0);
    view.unmount();
    expect(
      screen.queryByTestId("compare-surveillance-intelligence")
    ).not.toBeInTheDocument();
  });
});
