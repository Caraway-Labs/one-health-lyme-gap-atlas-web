import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  presentTier1SurveillancePriority,
  TIER1_FAILED_MESSAGE,
  TIER1_LIMITATION,
  TIER1_MODEL_ASSISTED_LABEL,
  TIER1_REASON_ABSENCE,
  TIER1_REGION_LABEL,
  TIER1_STALE_MESSAGE,
  TIER1_SUPPORT_NOTE,
  TIER1_UNAVAILABLE_MESSAGE,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";
import {
  Tier1SurveillancePriority,
  Tier1SurveillancePriorityPanel,
} from "@/features/ux-reset/surveillance-priority/tier1-surveillance-priority";
import type { Tier1CountyPriority } from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1MediumSufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const { tier1Get } = vi.hoisted(() => ({
  tier1Get:
    vi.fn<
      typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
    >(),
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    countyTier1SurveillancePriorityGet: (
      ...args: Parameters<
        typeof import("@/generated/atlas").countyTier1SurveillancePriorityGet
      >
    ) => tier1Get(...args),
  };
});

function notEstimableFixture(fips: string): Tier1CountyPriority {
  return {
    ...tier1HighSufficientFixture,
    county_fips: fips,
    evidence_sufficiency: "NOT_ESTIMABLE",
    priority_percentile: null,
    priority_tier: null,
    raw_model_score: null,
    reasons: [],
  };
}

function renderPanel(
  view: ReturnType<typeof presentTier1SurveillancePriority>
) {
  return render(
    <Tier1SurveillancePriorityPanel headingLevel="h2" view={view} />
  );
}

function renderConnected(fips: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Tier1SurveillancePriority fips={fips} headingLevel="h3" />
    </QueryClientProvider>
  );
}

describe("Tier 1 surveillance priority presentation", () => {
  afterEach(() => {
    cleanup();
    tier1Get.mockReset();
  });

  it("shows a returned HIGH result, model-assisted label, reasons, and limitation", () => {
    const view = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: tier1HighSufficientFixture.county_fips,
      result: tier1HighSufficientFixture,
      status: "success",
    });
    expect(view.kind).toBe("result");
    if (view.kind !== "result") {
      return;
    }
    expect({
      percentile: view.details.percentileLabel,
      reasons: view.reasons.map((reason) => reason.text),
      score: view.details.rawScoreLabel,
      sufficiency: view.sufficiency,
      tier: view.tier,
    }).toStrictEqual({
      percentile: "98.56824689786828",
      reasons: tier1HighSufficientFixture.reasons.map((reason) => reason.text),
      score: "2.0739835966635036",
      sufficiency: "SUFFICIENT",
      tier: "HIGH",
    });
    renderPanel(view);
    const region = screen.getByRole("region", { name: TIER1_REGION_LABEL });
    expect({
      signal: region.dataset.signal,
      sufficiency: region.dataset.sufficiency,
      tier: region.dataset.tier,
    }).toStrictEqual({
      signal: "model-assisted",
      sufficiency: "SUFFICIENT",
      tier: "HIGH",
    });
    expect({
      details: screen.getByText("Model and as-of details").textContent,
      label: screen.getByText(TIER1_MODEL_ASSISTED_LABEL).textContent,
      limitation: screen.getByTestId("tier1-limitation").textContent,
      reason: screen.getByRole("list", { name: "Contributing reasons" })
        .textContent,
      sufficiency: screen.getByTestId("tier1-evidence-sufficiency").textContent,
      support: screen.getByText(TIER1_SUPPORT_NOTE).textContent,
      tier: screen.getByTestId("tier1-priority-tier").textContent,
    }).toStrictEqual({
      details: "Model and as-of details",
      label: TIER1_MODEL_ASSISTED_LABEL,
      limitation: TIER1_LIMITATION,
      reason: expect.stringContaining("Publisher reports pathogen Present."),
      sufficiency: "Sufficient",
      support: TIER1_SUPPORT_NOTE,
      tier: "HIGH",
    });
  });

  it("keeps LOW distinct from insufficient evidence", () => {
    const view = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "01001",
      result: tier1LowInsufficientFixture,
      status: "success",
    });
    renderPanel(view);
    const region = screen.getByTestId("tier1-surveillance-priority");
    expect({
      sufficiency: region.dataset.sufficiency,
      sufficiencyText: screen.getByTestId("tier1-evidence-sufficiency")
        .textContent,
      tier: region.dataset.tier,
      tierText: screen.getByTestId("tier1-priority-tier").textContent,
    }).toStrictEqual({
      sufficiency: "INSUFFICIENT",
      sufficiencyText: "Insufficient",
      tier: "LOW",
      tierText: "LOW",
    });
    expect(screen.getByText(TIER1_LIMITATION).textContent).toContain(
      "not disease risk or predicted incidence"
    );
  });

  it("shows MEDIUM from the returned tier without using the percentile as a tier", () => {
    const view = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "01003",
      result: tier1MediumSufficientFixture,
      status: "success",
    });
    expect(view.kind === "result" ? view.tier : null).toBe("MEDIUM");
  });

  it("does not render unavailable output as LOW", () => {
    const view = presentTier1SurveillancePriority({
      errorStatus: 404,
      requestedFips: "99999",
      result: null,
      status: "error",
    });
    renderPanel(view);
    const region = screen.getByTestId("tier1-surveillance-priority");
    expect(region.dataset.state).toBe("unavailable");
    expect(region.dataset.tier).toBeUndefined();
    expect(region.textContent).toContain(TIER1_UNAVAILABLE_MESSAGE);
    expect(region.textContent).not.toMatch(/\bLOW\b/);
    expect(screen.queryByTestId("tier1-priority-tier")).toBeNull();
  });

  it("does not treat a failed or stale request as LOW", () => {
    const failed = presentTier1SurveillancePriority({
      errorStatus: 503,
      requestedFips: "09110",
      result: null,
      status: "error",
    });
    const stale = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "09110",
      result: tier1MediumSufficientFixture,
      status: "success",
    });
    const { unmount } = renderPanel(failed);
    expect(screen.getByRole("alert").textContent).toContain(
      TIER1_FAILED_MESSAGE
    );
    expect(
      screen.getByTestId("tier1-surveillance-priority").dataset.tier
    ).toBeUndefined();
    unmount();
    renderPanel(stale);
    expect(screen.getByRole("alert").textContent).toContain(
      TIER1_STALE_MESSAGE
    );
    expect(
      screen.getByTestId("tier1-surveillance-priority").textContent
    ).not.toMatch(/\bMEDIUM\b|\bLOW\b|\bHIGH\b/);
  });

  it("does not invent reasons or a tier when reasons are absent or the result is not estimable", () => {
    const noReasons = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "09110",
      result: { ...tier1HighSufficientFixture, reasons: [] },
      status: "success",
    });
    const notEstimable = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "09110",
      result: notEstimableFixture("09110"),
      status: "success",
    });
    const incoherent = presentTier1SurveillancePriority({
      errorStatus: null,
      requestedFips: "01001",
      result: {
        ...tier1LowInsufficientFixture,
        priority_percentile: 99,
        priority_tier: null,
        raw_model_score: null,
      },
      status: "success",
    });
    const noReasonsView = renderPanel(noReasons);
    expect({
      absent: screen.getByTestId("tier1-reasons-absent").textContent,
      list: screen.queryByRole("list", { name: "Contributing reasons" }),
      tier: screen.getByTestId("tier1-priority-tier").textContent,
    }).toStrictEqual({
      absent: TIER1_REASON_ABSENCE,
      list: null,
      tier: "HIGH",
    });
    noReasonsView.unmount();
    const abstainedView = renderPanel(notEstimable);
    const abstained = screen.getByTestId("tier1-surveillance-priority");
    expect({
      low: /\bLOW\b/.test(abstained.textContent ?? ""),
      state: abstained.dataset.state,
      sufficiency: abstained.dataset.sufficiency,
      tier: abstained.dataset.tier,
      tierText: screen.getByTestId("tier1-priority-tier").textContent,
    }).toStrictEqual({
      low: false,
      state: "not-estimable",
      sufficiency: "NOT_ESTIMABLE",
      tier: undefined,
      tierText: "Not returned",
    });
    abstainedView.unmount();
    renderPanel(incoherent);
    const rejected = screen.getByTestId("tier1-surveillance-priority");
    expect({
      low: /\bLOW\b/.test(rejected.textContent ?? ""),
      state: rejected.dataset.state,
    }).toStrictEqual({
      low: false,
      state: "failed",
    });
  });

  it("labels the loaded result from the API response for the requested county", async () => {
    tier1Get.mockResolvedValue({
      data: tier1PriorityForCounty(tier1HighSufficientFixture, "36001"),
      headers: new Headers(),
      status: 200,
    });
    renderConnected("36001");
    await waitFor(() =>
      expect(screen.getByTestId("tier1-priority-tier").textContent).toBe("HIGH")
    );
    expect(
      screen.getByRole("region", { name: TIER1_REGION_LABEL }).dataset
        .sufficiency
    ).toBe("SUFFICIENT");
    expect(screen.getByTestId("tier1-limitation").textContent).toBe(
      TIER1_LIMITATION
    );
  });

  it("loads a 404 as unavailable rather than LOW", async () => {
    tier1Get.mockRejectedValue(
      new AtlasApiError(
        "No current Tier 1 county result",
        "/v1/counties/99999/tier1-surveillance-priority",
        404,
        null
      )
    );
    renderConnected("99999");
    await waitFor(() =>
      expect(
        screen.getByTestId("tier1-surveillance-priority").dataset.state
      ).toBe("unavailable")
    );
    expect(
      screen.getByTestId("tier1-surveillance-priority").textContent
    ).not.toMatch(/\bLOW\b/);
  });
});
