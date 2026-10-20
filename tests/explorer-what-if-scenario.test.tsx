import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCENARIO_SCORE_DEFAULTS,
  adjustCountyScenarios,
} from "../src/features/ux-reset/review/explorer-scenario-score";
import {
  EXPLORER_SCENARIO_EXAMPLE,
  EXPLORER_SCENARIO_HEADING,
  EXPLORER_SCENARIO_INTRO,
  EXPLORER_SCENARIO_MISSING_TOOLTIP,
  EXPLORER_SCENARIO_RATE_TOOLTIP,
  EXPLORER_SCENARIO_RECALCULATION,
  ExplorerWhatIfScenario,
  applyGapScoreScenarioColors,
  explorerScenarioScopeSupported,
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
    const summary =
      screen.getByTestId("explorer-what-if-summary").textContent ?? "";
    expect({
      adjust: summary.includes("Adjust assumptions"),
      heading: summary.includes(EXPLORER_SCENARIO_HEADING),
      open: (panel as HTMLDetailsElement).open,
      parameters: summary.includes("65%"),
      scoring: summary.includes("Scoring calculation"),
      tag: panel.tagName,
    }).toStrictEqual({
      adjust: true,
      heading: true,
      open: false,
      parameters: false,
      scoring: false,
      tag: "DETAILS",
    });
  });

  it("shows the rate reference point and missing-record value after expanding", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const panel = screen.getByTestId("explorer-what-if-scenario");

    const text = panel.textContent ?? "";
    expect({
      missing: text.includes("75"),
      rate: text.includes("50 per 100,000"),
      scoring: text.includes("Scoring calculation"),
      twenty: text.includes("20 per 100,000"),
    }).toStrictEqual({
      missing: true,
      rate: true,
      scoring: false,
      twenty: false,
    });
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
      "Weight given to tick and pathogen data",
      "Smooth incidence attenuation (k)",
      "Assumption for missing county case data",
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
    const text =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    expect({
      caveat: text.includes("do not measure individual Lyme disease risk"),
      reset: onChange.mock.lastCall?.[0],
      risk: /personal disease risk/i.test(text),
      safety: /not a safety finding/i.test(text),
    }).toStrictEqual({
      caveat: false,
      reset: SCENARIO_SCORE_DEFAULTS,
      risk: false,
      safety: false,
    });
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
    ).toBe(
      "Select a county to compare its published Atlas score with the score using your changes."
    );
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain(
      "Select a county to compare its published Atlas score with the score using your changes."
    );
    const text =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    expect({
      caveat: screen.queryByTestId("explorer-scenario-caveat"),
      example: text.includes(EXPLORER_SCENARIO_EXAMPLE),
      intro: text.includes(EXPLORER_SCENARIO_INTRO),
      live: screen
        .getByTestId("explorer-what-if-scenario")
        .querySelector("[aria-live]"),
      sliders: screen.getAllByRole("slider").length,
    }).toStrictEqual({
      caveat: null,
      example: true,
      intro: true,
      live: null,
      sliders: 3,
    });
  });

  it("shows the published score at defaults without a scenario delta", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      assumptionsChanged: false,
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      scenario: null,
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toBe(
      "Published Atlas score 22.9 · No adjustments"
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      county: impact?.includes("How the changes affect Conejos County"),
      delta: impact?.includes("points") || impact?.includes("→"),
      priority: impact?.includes("Lower Atlas priority") ?? false,
      published:
        impact?.includes("Published Atlas score") && impact.includes("22.9"),
      unchangedClaim: impact?.includes("Follow-up category unchanged"),
    }).toStrictEqual({
      county: true,
      delta: false,
      priority: true,
      published: true,
      unchangedClaim: false,
    });
  });

  it("keeps an unsupported legacy H zero limited and clears that on reset", () => {
    const zeroHuman = county({
      county: "Baldwin County",
      fips: "01003",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      incidence_floor_2023: undefined,
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
    const moved = { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 };
    const onChange = vi.fn<(next: ScoreSettings) => void>();
    const view = renderScenario(
      moved,
      resolveExplorerWhatIfImpact({
        collectionSettings: SCENARIO_SCORE_DEFAULTS,
        counties: [zeroHuman],
        countyFips: "01003",
        scopeCode: "AL",
        scoresStatus: "ready",
        settings: moved,
      }),
      onChange
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      baseline: impact.includes("No adjustments"),
      priority: impact.includes("Follow-up category unchanged"),
      share: screen
        .getByRole("slider", { name: "Weight given to tick and pathogen data" })
        .getAttribute("value"),
      summary: screen.getByTestId("explorer-scenario-impact-summary")
        .textContent,
    }).toStrictEqual({
      baseline: false,
      priority: false,
      share: "85",
      summary:
        "Published Atlas score 0.0 · Score with your changes unavailable",
    });

    fireEvent.click(screen.getByTestId("explorer-scenario-reset"));
    expect(onChange).toHaveBeenLastCalledWith(SCENARIO_SCORE_DEFAULTS);
    view.rerender(
      <ExplorerWhatIfScenario
        impact={resolveExplorerWhatIfImpact({
          collectionSettings: SCENARIO_SCORE_DEFAULTS,
          counties: [zeroHuman],
          countyFips: "01003",
          scopeCode: "AL",
          scoresStatus: "ready",
          settings: SCENARIO_SCORE_DEFAULTS,
        })}
        onChange={onChange}
        settings={SCENARIO_SCORE_DEFAULTS}
      />
    );
    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toBe("Published Atlas score 0.0 · No adjustments");
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
      assumptionsChanged: true,
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toContain(
      "Published Atlas score to the score with your changes."
    );
    expect(summary.textContent).toContain("62.4 → 74.1 · +11.7 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      adjusted:
        impact?.includes("Score with your changes") && impact.includes("74.1"),
      priority: impact?.includes(
        `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`
      ),
      published: impact?.includes("Published Atlas score"),
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
      assumptionsChanged: true,
      status: "ready",
    });

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("22.9 → 12.2 · \u221210.7 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain("Follow-up category unchanged");
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
      assumptionsChanged: true,
      status: "ready",
    });

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("0.0 → 0.0 · 0.0 points");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact");
    expect(impact.dataset.impact).toBe("unchanged");
    expect(impact.textContent).toContain("Follow-up category unchanged");
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
      assumptionsChanged: true,
      status: "ready",
    });

    const summary = screen.getByTestId("explorer-scenario-impact-summary");
    expect(summary.textContent).toBe(
      "Published Atlas score 0.0 · Score with your changes unavailable"
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      arrow: impact.includes("→"),
      points: impact.includes("points"),
      priorityCount: impact.match(/Lower Atlas priority/g)?.length ?? 0,
      published:
        impact.includes("Published Atlas score") && impact.includes("0.0"),
      rank: impact.includes("rank"),
      reason: impact.includes("no published rate on this collection"),
      safety: impact.includes("Not a safety finding"),
      unavailable: impact.includes("Unavailable"),
    }).toStrictEqual({
      arrow: false,
      points: false,
      priorityCount: 1,
      published: true,
      rank: false,
      reason: true,
      safety: false,
      unavailable: true,
    });
  });

  it("replaces both comparison lines when the selected county changes", () => {
    const view = renderScenario(SCENARIO_SCORE_DEFAULTS, {
      assumptionsChanged: false,
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
          assumptionsChanged: true,
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
      heading: impact.includes("How the changes affect Autauga County"),
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
    expect(screen.queryByTestId("explorer-scenario-scores-retry")).toBeNull();
  });

  it("shows a retryable request failure instead of an unavailable comparison", () => {
    const onRetryScores = vi.fn<() => void>();
    const view = render(
      <ExplorerWhatIfScenario
        impact={{ status: "error" }}
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
        onRetryScores={onRetryScores}
      />
    );
    const alert = screen.getByRole("alert");
    const message = alert.textContent ?? "";
    expect({
      comparison: screen.queryByTestId("explorer-scenario-impact-summary"),
      requestFailure: message.includes("request failure, not missing data."),
      retry: screen.getByTestId("explorer-scenario-scores-retry").textContent,
      unavailable: message.includes("Score comparison unavailable"),
    }).toStrictEqual({
      comparison: null,
      requestFailure: true,
      retry: "Retry published scores",
      unavailable: false,
    });
    fireEvent.click(screen.getByTestId("explorer-scenario-scores-retry"));
    expect(onRetryScores).toHaveBeenCalledOnce();

    view.rerender(
      <ExplorerWhatIfScenario
        impact={{ status: "error" }}
        scoresRetrying
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
        onRetryScores={onRetryScores}
      />
    );
    const retry = screen.getByTestId("explorer-scenario-scores-retry");
    const alertText = screen.getByRole("alert").textContent ?? "";
    expect({
      data: alertText.includes("not missing data"),
      disabled: retry.hasAttribute("disabled") || retry.matches(":disabled"),
      evidence: alertText.includes("evidence"),
      label: retry.textContent,
    }).toStrictEqual({
      data: true,
      disabled: true,
      evidence: false,
      label: "Retrying published scores…",
    });
  });

  it("shows a default county without a changed category or safety-finding wording", () => {
    renderScenario(SCENARIO_SCORE_DEFAULTS, {
      assumptionsChanged: false,
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      scenario: null,
      status: "ready",
    });
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const text =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    expect({
      browser: text.includes("browser-only"),
      category: text.includes("Lower Atlas priority"),
      governed: text.includes("governed"),
      official: text.includes("official"),
      resetDisabled: screen
        .getByTestId("explorer-scenario-reset")
        .hasAttribute("disabled"),
      safety: text.includes("Not a safety finding"),
      unchanged: text.includes("No adjustments"),
      weights:
        text.includes("65% tick and pathogen data") &&
        text.includes("35% community context"),
    }).toStrictEqual({
      browser: false,
      category: true,
      governed: false,
      official: false,
      resetDisabled: true,
      safety: false,
      unchanged: true,
      weights: true,
    });
  });

  it("shows an unchanged category when the score falls and a changed category when it rises", () => {
    const onChange = vi.fn<(next: ScoreSettings) => void>();
    const view = renderScenario(
      { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 },
      {
        assumptionsChanged: true,
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
      },
      onChange
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const fallen =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      category: screen.getByTestId("explorer-scenario-category").textContent,
      lower: screen.queryByTestId("explorer-scenario-lower-score"),
      points: fallen.includes("−10.7 points"),
    }).toStrictEqual({
      category: "Follow-up category unchanged",
      lower: null,
      points: true,
    });
    expect(fallen).not.toContain("does not mean Lyme disease is absent");

    view.rerender(
      <ExplorerWhatIfScenario
        impact={{
          assumptionsChanged: true,
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
        }}
        onChange={onChange}
        settings={{ ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 }}
      />
    );
    expect({
      category: screen.getByTestId("explorer-scenario-category").textContent,
      lower: screen.queryByTestId("explorer-scenario-lower-score"),
      weights: Boolean(
        screen
          .getByTestId("explorer-what-if-scenario")
          .textContent?.includes("85% tick and pathogen data") &&
        screen
          .getByTestId("explorer-what-if-scenario")
          .textContent?.includes("15% community context")
      ),
    }).toStrictEqual({
      category: `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`,
      lower: null,
      weights: true,
    });
  });

  it("keeps a limited result free of an invented delta and resets to the published defaults", () => {
    const onChange = vi.fn<(next: ScoreSettings) => void>();
    renderScenario(
      { ...SCENARIO_SCORE_DEFAULTS, smooth_k: 20 },
      {
        assumptionsChanged: true,
        countyName: "Adams County",
        governedPriority: LOWER,
        governedScore: 0,
        scenario: {
          governedPriority: LOWER,
          governedScore: 0,
          kind: "limited",
        },
        status: "ready",
      },
      onChange
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const limited =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    fireEvent.click(screen.getByTestId("explorer-scenario-reset"));
    expect({
      category: limited.includes("Follow-up category changed"),
      points: limited.includes("points"),
      rate: screen
        .getByTestId("explorer-what-if-scenario")
        .textContent?.includes("20 per 100,000"),
      reset: onChange.mock.lastCall?.[0],
      unavailable: limited.includes("Unavailable"),
    }).toStrictEqual({
      category: false,
      points: false,
      rate: true,
      reset: SCENARIO_SCORE_DEFAULTS,
      unavailable: true,
    });
  });

  it("exposes technical notes and the scenario disclosure without safety-finding copy", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const methods = screen.getByTestId("explorer-scenario-methods");
    fireEvent.click(methods.querySelector("summary") as HTMLElement);
    const methodText = methods.textContent ?? "";
    expect({
      missingTooltip: /uncertainty|penalty|out of 100/i.test(
        EXPLORER_SCENARIO_MISSING_TOOLTIP
      ),
      notes: screen.getAllByRole("button", { name: /Technical note for/ })
        .length,
      open: (methods as HTMLDetailsElement).open,
      rateDefault: EXPLORER_SCENARIO_RATE_TOOLTIP.includes("k=50"),
      rateTwenty: EXPLORER_SCENARIO_RATE_TOOLTIP.includes("20 per 100,000"),
      recalculation: screen.getByTestId("explorer-scenario-recalculation")
        .textContent,
      safety: methodText.includes("Not a safety finding"),
      tier: methodText.includes("Tier 1 ML"),
    }).toStrictEqual({
      missingTooltip: false,
      notes: 3,
      open: true,
      rateDefault: true,
      rateTwenty: false,
      recalculation: EXPLORER_SCENARIO_RECALCULATION,
      safety: false,
      tier: true,
    });
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "no_county_linked_record",
    svi_percentile: 0.838,
    uninsured_percentile: 0.848,
    rucc_2023: 9,
    incidence_floor_2023: null,
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
    scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
    human_status: "published_count_floor",
    incidence_floor_2023: 0,
    svi_percentile: 0,
    uninsured_percentile: 0,
    rucc_2023: 1,
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

  it("keeps a failed scores request distinct from a county the response omitted", () => {
    const failedWithRows = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published],
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "error",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    const failedWithoutRows = resolveExplorerWhatIfImpact({
      collectionSettings: undefined,
      counties: undefined,
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "error",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    const omitted = resolveExplorerWhatIfImpact({
      collectionSettings: undefined,
      counties: [published],
      countyFips: "01003",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    const emptySuccess = resolveExplorerWhatIfImpact({
      collectionSettings: undefined,
      counties: undefined,
      countyFips: "01001",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    expect({
      emptySuccess: emptySuccess.status,
      failedView: presentExplorerScenarioImpact(failedWithRows).kind,
      failedWithRows: failedWithRows.status,
      failedWithoutRows: failedWithoutRows.status,
      omitted: presentExplorerScenarioImpact(omitted),
    }).toStrictEqual({
      emptySuccess: "unavailable",
      failedView: "error",
      failedWithRows: "error",
      failedWithoutRows: "error",
      omitted: {
        collapsed: "Score comparison unavailable",
        expanded: "Score comparison is unavailable for this county.",
        kind: "placeholder",
        placeholder: "unavailable",
      },
    });
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
        assumptionsChanged: false,
        governedScore: 65,
        scenario: null,
        status: "ready",
      },
      view: {
        collapsed: "Published Atlas score 65.0 · No adjustments",
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
        priorityText: `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`,
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
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      incidence_floor_2023: undefined,
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
    expect({
      assumptionsChanged:
        unchanged.status === "ready" ? unchanged.assumptionsChanged : false,
      scenario: unchanged.status === "ready" ? unchanged.scenario : "present",
      view: presentExplorerScenarioImpact(unchanged),
    }).toMatchObject({
      assumptionsChanged: true,
      scenario: { kind: "limited" },
      view: {
        collapsed:
          "Published Atlas score 0.0 · Score with your changes unavailable",
        kind: "limited",
      },
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
      collapsed:
        "Published Atlas score 0.0 · Score with your changes unavailable",
      kind: "limited",
    });

    const limited = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [zeroHuman],
      countyFips: "01003",
      scopeCode: "AL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, smooth_k: 20 },
    });
    const limitedView = presentExplorerScenarioImpact(limited);
    expect({
      collapsed: limitedView.kind === "limited" ? limitedView.collapsed : "",
      kind: limitedView.kind,
      rank: JSON.stringify(limitedView).includes("rank"),
    }).toStrictEqual({
      collapsed:
        "Published Atlas score 0.0 · Score with your changes unavailable",
      kind: "limited",
      rank: false,
    });
  });

  it("keeps the scenario on national and lower-48 scope", () => {
    expect({
      ak: explorerScenarioScopeSupported("AK", true),
      akUngated: explorerScenarioScopeSupported("AK", false),
      all: explorerScenarioScopeSupported("ALL", false),
      co: explorerScenarioScopeSupported("CO", false),
      dc: explorerScenarioScopeSupported("DC", false),
      hi: explorerScenarioScopeSupported("HI", true),
    }).toStrictEqual({
      ak: false,
      akUngated: false,
      all: true,
      co: true,
      dc: true,
      hi: false,
    });
  });

  it("compares one lower-48 county at national scope and refuses Alaska", () => {
    const alaska = county({
      county: "Anchorage Municipality",
      fips: "02020",
      priority: INVESTIGATE,
      score: {
        access_signal: 0,
        community: 0,
        ecological: 100,
        human_weakness: 100,
        pathogen_signal: 100,
        rural_signal: 0,
        score: 99,
        svi_signal: 0,
        tick_signal: 100,
      },
      state: "AK",
      state_name: "Alaska",
    });
    const none = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published, conejos, alaska],
      countyFips: null,
      scopeCode: "ALL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 },
    });
    const national = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published, conejos, alaska],
      countyFips: "01001",
      scopeCode: "ALL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 85 },
    });
    const nationalView = presentExplorerScenarioImpact(national);
    const alaskaSelection = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [published, alaska],
      countyFips: "02020",
      scopeCode: "ALL",
      scoresStatus: "ready",
      settings: SCENARIO_SCORE_DEFAULTS,
    });
    const serialized = JSON.stringify(national);
    expect({
      alaska: alaskaSelection.status,
      anchorage: serialized.includes("Anchorage"),
      national: nationalView,
      none: presentExplorerScenarioImpact(none),
      score99: serialized.includes("99"),
    }).toMatchObject({
      alaska: "unavailable",
      anchorage: false,
      national: {
        collapsed: "65.0 → 85.0 · +20.0 points",
        countyName: "Autauga County",
        kind: "definite",
        priorityText: `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`,
      },
      none: {
        collapsed:
          "Select a county to compare its published Atlas score with the score using your changes.",
        kind: "placeholder",
        placeholder: "none",
      },
      score99: false,
    });
  });

  it("compares the District of Columbia and keeps a limited national county honest", () => {
    const alaska = county({
      county: "Anchorage Municipality",
      fips: "02020",
      score: published.score,
      state: "AK",
      state_name: "Alaska",
    });
    const district = county({
      county: "District of Columbia",
      fips: "11001",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      incidence_floor_2023: undefined,
      priority: REVIEW,
      score: published.score,
      state: "DC",
      state_name: "District of Columbia",
    });
    const dc = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [district, alaska],
      countyFips: "11001",
      scopeCode: "ALL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, ecological_share: 40 },
    });
    const zeroHuman = county({
      county: "Baldwin County",
      fips: "01003",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      incidence_floor_2023: undefined,
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
    const limited = resolveExplorerWhatIfImpact({
      collectionSettings: SCENARIO_SCORE_DEFAULTS,
      counties: [zeroHuman, published],
      countyFips: "01003",
      scopeCode: "ALL",
      scoresStatus: "ready",
      settings: { ...SCENARIO_SCORE_DEFAULTS, smooth_k: 20 },
    });
    const limitedView = presentExplorerScenarioImpact(limited);
    const limitedText = JSON.stringify(limitedView);
    expect({
      dc: presentExplorerScenarioImpact(dc),
      kind: limitedView.kind,
      points: limitedText.includes("points"),
      rank: limitedText.includes("rank"),
    }).toMatchObject({
      dc: {
        collapsed:
          "Published Atlas score 65.0 · Score with your changes unavailable",
        countyName: "District of Columbia",
      },
      kind: "limited",
      points: false,
      rank: false,
    });
  });
});

describe(applyGapScoreScenarioColors, () => {
  it("recolors adjusted county fills and leaves limited counties on the governed color", () => {
    const governed = county({
      color: "#55a8a3",
      fips: "08021",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "no_county_linked_record",
      svi_percentile: 0.838,
      uninsured_percentile: 0.848,
      rucc_2023: 9,
      incidence_floor_2023: null,
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
      state: "CO",
    });
    const limitedCounty = county({
      color: "#a9d2db",
      county: "Adams County",
      fips: "08001",
      scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
      human_status: "published_count_floor",
      incidence_floor_2023: undefined,
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
      state: "CO",
    });
    const moved = applyGapScoreScenarioColors([governed, limitedCounty], null);
    expect(moved.counties.map((entry) => entry.color)).toStrictEqual([
      "#55a8a3",
      "#a9d2db",
    ]);

    const scenarios = adjustCountyScenarios(
      [governed, limitedCounty],
      { ...SCENARIO_SCORE_DEFAULTS, missing_human_weakness: 40 },
      SCENARIO_SCORE_DEFAULTS
    );
    const colored = applyGapScoreScenarioColors(
      [governed, limitedCounty],
      scenarios
    );
    expect({
      adjusted: colored.counties[0]?.color.startsWith("var(--map-ramp-"),
      governedScore: colored.counties[1]?.score.score,
      limitedColor: colored.counties[1]?.color,
      limitedPriority: colored.counties[1]?.priority,
    }).toStrictEqual({
      adjusted: true,
      governedScore: 0,
      limitedColor: "#a9d2db",
      limitedPriority: LOWER,
    });
    expect(JSON.stringify(colored)).not.toContain("national");
  });
});
