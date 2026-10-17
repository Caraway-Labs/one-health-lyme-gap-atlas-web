import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCENARIO_SCORE_DEFAULTS } from "../src/features/ux-reset/review/explorer-scenario-score";
import {
  EXPLORER_SCENARIO_IMPACT_MICROCOPY,
  ExplorerWhatIfScenario,
  formatExplorerScenarioDelta,
  presentExplorerScenarioImpact,
  resolveExplorerWhatIfImpact,
  type ExplorerWhatIfImpactState,
} from "../src/features/ux-reset/review/explorer-what-if-scenario";
import type { CountyScoreSummary } from "../src/generated/models";
import type { ScoreSettings } from "../src/lib/atlas-ui";

const NO_COUNTY: ExplorerWhatIfImpactState = { status: "none" };
const LOWER = "Lower Atlas priority — Not a safety finding";
const REVIEW = "Priority 2 — Review";
const INVESTIGATE = "Priority 1 — Investigate";

function renderScenario(
  settings: ScoreSettings = SCENARIO_SCORE_DEFAULTS,
  impact: ExplorerWhatIfImpactState = NO_COUNTY,
  onChange: (next: ScoreSettings) => void = vi.fn<() => void>()
) {
  return render(
    <ExplorerWhatIfScenario
      impact={impact}
      settings={settings}
      onChange={onChange}
    />
  );
}

describe(ExplorerWhatIfScenario, () => {
  afterEach(() => {
    cleanup();
  });

  it("starts collapsed with the governed assumption values", () => {
    renderScenario();

    const panel = screen.getByTestId("explorer-what-if-scenario");
    const summary = screen.getByTestId("explorer-what-if-summary");
    expect(panel.tagName).toBe("DETAILS");
    expect((panel as HTMLDetailsElement).open).toBeFalsy();
    expect(summary.textContent).toContain("What-if scenario");
    expect(summary.textContent).toContain("65%");
    expect(summary.textContent).toContain("View & adjust assumptions");
  });

  it("shows the published-record threshold and missing-record value while collapsed", () => {
    renderScenario();
    const summary = screen.getByTestId("explorer-what-if-summary");

    expect(summary.textContent).toContain("10 per 100,000");
    expect(summary.textContent).toContain("75");
    expect(summary.textContent).toContain("Scoring calculation");
  });

  it("exposes three keyboard sliders and resets them to the governed defaults", () => {
    let settings: ScoreSettings = { ...SCENARIO_SCORE_DEFAULTS };
    const onChange = vi.fn<(next: ScoreSettings) => void>((next) => {
      settings = next;
    });
    const view = renderScenario(settings, NO_COUNTY, onChange);
    const summary = screen.getByTestId("explorer-what-if-summary");
    summary.focus();
    fireEvent.click(summary);

    const sliders = screen.getAllByRole("slider");
    expect(
      sliders.map((slider) => slider.getAttribute("aria-label"))
    ).toStrictEqual([
      "Tick and pathogen share",
      "Published-record threshold",
      "Missing county-record value",
    ]);
    fireEvent.change(sliders[2], { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith({
      ...SCENARIO_SCORE_DEFAULTS,
      missing_human_weakness: 40,
    });

    view.rerender(
      <ExplorerWhatIfScenario
        impact={NO_COUNTY}
        settings={settings}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId("explorer-scenario-reset"));
    expect(onChange).toHaveBeenLastCalledWith(SCENARIO_SCORE_DEFAULTS);
    expect(screen.getByText(/not a diagnosis/i)).toBeTruthy();
    expect(screen.queryByText(/personal disease risk/i)).toBeNull();
  });

  it("renders the shared slider primitive", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const [slider] = screen.getAllByRole("slider");
    expect(slider?.dataset.slot).toBe("slider");
    expect(slider?.tagName).toBe("INPUT");
  });

  it("asks for a county and keeps the sliders when nothing is selected", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toBe("Select a county");
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain("Select a county to see its published score");
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(
      screen.getByTestId("explorer-scenario-impact-microcopy").textContent
    ).toBe(EXPLORER_SCENARIO_IMPACT_MICROCOPY);
    expect(
      screen
        .getByTestId("explorer-what-if-scenario")
        .querySelector("[aria-live]")
    ).toBeNull();
  });

  it("shows the published score at defaults without a scenario delta", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      scenario: null,
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toBe("Published score 22.9 · No adjustments");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      county: impact?.includes("Scenario impact — Conejos County"),
      delta: impact?.includes("points") || impact?.includes("→"),
      priority: impact?.includes(LOWER),
      published: impact?.includes("Published score") && impact.includes("22.9"),
      unchangedClaim: impact?.includes("Priority unchanged"),
    }).toStrictEqual({
      county: true,
      delta: false,
      priority: true,
      published: true,
      unchangedClaim: false,
    });
  });

  it("shows a signed point change and a priority change for an adjusted county", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Autauga County",
      governedPriority: REVIEW,
      governedScore: 62.4,
      scenario: {
        colorToken: "var(--map-ramp-5)",
        governedPriority: REVIEW,
        governedScore: 62.4,
        humanWeakness: 80,
        kind: "adjusted",
        priority: INVESTIGATE,
        rank: 3,
        score: 74.1,
      },
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toContain("Published to adjusted.");
    expect(summary.textContent).toContain("62.4 → 74.1 · +11.7 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      adjusted:
        impact?.includes("Adjusted scenario") && impact.includes("74.1"),
      priority: impact?.includes(
        `Priority changed: ${REVIEW} → ${INVESTIGATE}`
      ),
      published: impact?.includes("Published score"),
      rank: impact?.includes("Scenario rank") || impact?.includes("rank 3"),
    }).toStrictEqual({
      adjusted: true,
      priority: true,
      published: true,
      rank: false,
    });
  });

  it("shows a negative delta and an unchanged priority", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      scenario: {
        colorToken: "var(--map-ramp-1)",
        governedPriority: LOWER,
        governedScore: 22.9,
        humanWeakness: 40,
        kind: "adjusted",
        priority: LOWER,
        rank: 2,
        score: 12.2,
      },
      status: "ready",
    });

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("22.9 → 12.2 · \u221210.7 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain("Priority unchanged");
  });

  it("shows a zero point change when the scenario score stays the same", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Clamped County",
      governedPriority: LOWER,
      governedScore: 0,
      scenario: {
        governedPriority: LOWER,
        governedScore: 0,
        kind: "unchanged",
        priority: LOWER,
        rank: 1,
        score: 0,
      },
      status: "ready",
    });

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("0.0 → 0.0 · 0.0 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact");
    expect(impact.dataset.impact).toBe("unchanged");
    expect(impact.textContent).toContain("Priority unchanged");
    expect(impact.textContent).not.toContain("Scenario rank");
  });

  it("keeps the published score and hides numbers when the scenario is limited", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Twelve County",
      governedPriority: LOWER,
      governedScore: 0,
      scenario: {
        governedPriority: LOWER,
        governedScore: 0,
        kind: "limited",
      },
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toBe(
      "Published score 0.0 · Adjusted scenario unavailable"
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      arrow: impact.includes("→"),
      points: impact.includes("points"),
      priorityCount: impact.match(new RegExp(LOWER, "g"))?.length ?? 0,
      published: impact.includes("Published score") && impact.includes("0.0"),
      rank: impact.includes("rank"),
      reason: impact.includes("Published incidence is not on this collection"),
      unavailable: impact.includes("Adjusted scenario unavailable"),
    }).toStrictEqual({
      arrow: false,
      points: false,
      priorityCount: 1,
      published: true,
      rank: false,
      reason: true,
      unavailable: true,
    });
  });

  it("replaces both comparison lines when the selected county changes", () => {
    const view = renderScenario(SCENARIO_SCORE_DEFAULTS, {
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      scenario: null,
      status: "ready",
    });
    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("22.9");

    view.rerender(
      <ExplorerWhatIfScenario
        impact={{
          countyName: "Autauga County",
          governedPriority: REVIEW,
          governedScore: 62.4,
          scenario: {
            colorToken: "var(--map-ramp-5)",
            governedPriority: REVIEW,
            governedScore: 62.4,
            humanWeakness: 80,
            kind: "adjusted",
            priority: INVESTIGATE,
            rank: 1,
            score: 74.1,
          },
          status: "ready",
        }}
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );

    const summary =
      screen.getByTestId("explorer-scenario-impact-summary").textContent ?? "";
    expect({
      next: summary.includes("62.4 → 74.1 · +11.7 points"),
      previousCounty: summary.includes("Conejos"),
      previousScore: summary.includes("22.9"),
    }).toStrictEqual({
      next: true,
      previousCounty: false,
      previousScore: false,
    });
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      heading: impact.includes("Scenario impact — Autauga County"),
      previous: impact.includes("Conejos") || impact.includes("22.9"),
    }).toStrictEqual({
      heading: true,
      previous: false,
    });
  });

  it("omits numbers while the published score is loading and when it is unavailable", () => {
    const view = renderScenario(SCENARIO_SCORE_DEFAULTS, { status: "pending" });
    expect(screen.queryByTestId("explorer-scenario-impact-summary")).toBeNull();
    expect(screen.queryByTestId("explorer-scenario-impact")).toBeNull();

    view.rerender(
      <ExplorerWhatIfScenario
        impact={{ status: "unavailable" }}
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );
    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toBe("Score comparison unavailable");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    expect(screen.getByTestId("explorer-scenario-impact").textContent).toBe(
      "Score comparison is unavailable for this county."
    );
  });
});

function county(
  overrides: Partial<CountyScoreSummary> &
    Pick<CountyScoreSummary, "fips" | "score">
): CountyScoreSummary {
  return {
    burgdorferi_status: "No records",
    color: "#55a8a3",
    county: "Sample County",
    evidence_completeness: 50,
    human_status: "no_county_linked_record",
    in_contiguous_tick_scope: true,
    priority: LOWER,
    state: "AL",
    state_name: "Alabama",
    tick_status: "No records",
    ...overrides,
  };
}

describe(resolveExplorerWhatIfImpact, () => {
  const conejos = county({
    county: "Conejos County",
    fips: "08021",
    state: "CO",
    state_name: "Colorado",
    score: {
      access_signal: 84.8,
      community: 87.3,
      ecological: 0,
      human_weakness: 75,
      pathogen_signal: 0,
      rural_signal: 100,
      score: 22.9,
      svi_signal: 83.8,
      tick_signal: 0,
    },
  });
  const published = county({
    county: "Autauga County",
    fips: "01001",
    human_status: "published_count_floor",
    priority: REVIEW,
    score: {
      access_signal: 0,
      community: 0,
      ecological: 100,
      human_weakness: 100,
      pathogen_signal: 100,
      rural_signal: 0,
      score: 65,
      svi_signal: 0,
      tick_signal: 100,
    },
    state: "AL",
    state_name: "Alabama",
  });

  it("formats signed point changes, including zero", () => {
    expect(formatExplorerScenarioDelta(11.7)).toBe("+11.7 points");
    expect(formatExplorerScenarioDelta(-3.2)).toBe("\u22123.2 points");
    expect(formatExplorerScenarioDelta(0)).toBe("0.0 points");
    expect(formatExplorerScenarioDelta(12.2 - 22.9)).toBe("\u221210.7 points");
  });

  it("returns no county, a loading gap, or an unavailable county without numbers", () => {
    expect(
      resolveExplorerWhatIfImpact({
        collectionSettings: undefined,
        counties: [published],
        countyFips: null,
        scopeCode: "AL",
        scoresStatus: "ready",
        settings: SCENARIO_SCORE_DEFAULTS,
      }).status
    ).toBe("none");
    expect(
      resolveExplorerWhatIfImpact({
        collectionSettings: undefined,
        counties: undefined,
        countyFips: "01001",
        scopeCode: "AL",
        scoresStatus: "loading",
        settings: SCENARIO_SCORE_DEFAULTS,
      }).status
    ).toBe("pending");
    expect(
      resolveExplorerWhatIfImpact({
        collectionSettings: undefined,
        counties: [published],
        countyFips: "01003",
        scopeCode: "AL",
        scoresStatus: "ready",
        settings: SCENARIO_SCORE_DEFAULTS,
      }).status
    ).toBe("unavailable");
  });

  it("uses the governed score at defaults and a definite scenario after a slider change", () => {
    const baseline = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published],
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    expect({
      baseline,
      view: presentExplorerScenarioImpact(baseline),
    }).toMatchObject({
      baseline: {
        countyName: "Autauga County",
        governedPriority: REVIEW,
        governedScore: 65,
        scenario: null,
        status: "ready",
      },
      view: {
        collapsed: "Published score 65.0 · No adjustments",
        kind: "baseline",
      },
    });

    const raised = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published],
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 },
    });
    if (raised.status !== "ready" || raised.scenario?.kind !== "adjusted") {
      throw new Error("Expected an adjusted Autauga scenario.");
    }
    expect({
      priority: raised.scenario.priority,
      score: raised.scenario.score,
      view: presentExplorerScenarioImpact(raised),
    }).toMatchObject({
      priority: INVESTIGATE,
      score: 85,
      view: {
        collapsed: "65.0 → 85.0 · +20.0 points",
        kind: "definite",
        priorityText: `Priority changed: ${REVIEW} → ${INVESTIGATE}`,
      },
    });

    const lowered = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published],
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 40 },
    });
    expect(
      presentExplorerScenarioImpact(lowered).kind === "definite"
        ? presentExplorerScenarioImpact(lowered)
        : null
    ).toMatchObject({
      collapsed: "65.0 → 40.0 · \u221225.0 points",
    });
  });

  it("represents an unchanged county as zero points and a limited county without a delta", () => {
    const zeroHuman = county({
      county: "Baldwin County",
      fips: "01003",
      human_status: "published_count_floor",
      score: {
        access_signal: 0,
        community: 0,
        ecological: 100,
        human_weakness: 0,
        pathogen_signal: 100,
        rural_signal: 0,
        score: 0,
        svi_signal: 0,
        tick_signal: 100,
      },
    });
    const unchanged = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [zeroHuman, conejos],
      countyFips: "01003",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 },
    });
    expect(unchanged).toMatchObject({
      scenario: null,
      status: "ready",
    });

    const shifted = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [zeroHuman, { ...conejos, state: "AL" }],
      countyFips: "01003",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 },
    });
    expect(presentExplorerScenarioImpact(shifted)).toMatchObject({
      collapsed: "0.0 → 0.0 · 0.0 points",
      kind: "definite",
      priorityText: "Priority unchanged",
      resultKind: "unchanged",
    });

    const limited = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [zeroHuman],
      countyFips: "01003",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, low_incidence_breakpoint: 20 },
    });
    const limitedView = presentExplorerScenarioImpact(limited);
    expect({
      collapsed: limitedView.kind === "limited" ? limitedView.collapsed : "",
      kind: limitedView.kind,
      rank: JSON.stringify(limitedView).includes("rank"),
    }).toStrictEqual({
      collapsed: "Published score 0.0 · Adjusted scenario unavailable",
      kind: "limited",
      rank: false,
    });
  });
});
