import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SCENARIO_SCORE_DEFAULTS,
  adjustCountyScenarios,
} from "../src/features/ux-reset/review/explorer-scenario-score";
import {
  EXPLORER_SCENARIO_DEFAULT_STATUS,
  EXPLORER_SCENARIO_FOOTER,
  EXPLORER_SCENARIO_FORMULA,
  EXPLORER_SCENARIO_HEADING,
  EXPLORER_SCENARIO_INTRO,
  EXPLORER_SCENARIO_MISSING_INACTIVE,
  EXPLORER_SCENARIO_NO_COUNTY,
  explorerIncidenceHalfReductionNote,
  explorerIncidenceSettingLabel,
  EXPLORER_SCENARIO_UNCHANGED_STATUS,
  ExplorerWhatIfScenario,
  applyGapScoreScenarioColors,
  explorerScenarioScopeSupported,
  formatExplorerScenarioDelta,
  presentExplorerScenarioImpact,
  resolveExplorerWhatIfImpact,
  surveillanceGapScoreVersionLabel,
  type ExplorerWhatIfImpactState,
} from "../src/features/ux-reset/review/explorer-what-if-scenario";
import type { CountyScoreSummary } from "../src/generated/models";
import { countyScoreSummaryScoringMethodologyVersionDefault } from "../src/generated/zod/countyScoreSummary.zod";
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
      adjust: summary.includes("Show assumptions"),
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

  it("uses a compact sans-serif assumptions header row", () => {
    renderScenario();
    expect(
      screen.getByRole("heading", { name: EXPLORER_SCENARIO_HEADING }).className
    ).toContain("ux-reset-explorer-scenario-heading");
    const css = readFileSync("src/features/ux-reset/ux-reset.css", "utf-8")
      .replaceAll(/\s+/g, " ")
      .trim();
    const required = [
      ".ux-reset-explorer-scenario > summary { display: flex; flex-wrap: nowrap;",
      "min-height: 2.5rem;",
      "max-height: 2.75rem;",
      "padding: 0.5rem 1rem;",
      ".ux-reset-explorer-scenario-heading { margin: 0; color: var(--navy); font-family: var(--font-sans); font-size: 0.9375rem; font-weight: 600;",
      "background: var(--white);",
    ];
    expect(required.filter((snippet) => !css.includes(snippet))).toStrictEqual(
      []
    );
  });

  it("shows the rate reference point and missing-record value after expanding", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const panel = screen.getByTestId("explorer-what-if-scenario");

    const text = panel.textContent ?? "";
    expect({
      missing: text.includes("75 / 100"),
      rate: text.includes(explorerIncidenceSettingLabel(50)),
      scoring: text.includes("Scoring calculation"),
      twenty: text.includes(explorerIncidenceSettingLabel(20)),
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
      "Tick / pathogen weight",
      "Effect of reported incidence",
      "Missing county case data",
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
      caveat: text.includes(EXPLORER_SCENARIO_FOOTER),
      reset: onChange.mock.lastCall?.[0],
      risk: /personal disease risk/i.test(text),
      safety: /not a safety finding/i.test(text),
    }).toStrictEqual({
      caveat: true,
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
    ).toBe(EXPLORER_SCENARIO_NO_COUNTY);
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain(EXPLORER_SCENARIO_NO_COUNTY);
    const text =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    expect({
      caveat: screen.queryByTestId("explorer-scenario-caveat"),
      example: text.includes("Try exploring"),
      intro: text.includes(EXPLORER_SCENARIO_INTRO),
      live: screen
        .getByTestId("explorer-what-if-scenario")
        .querySelector("[aria-live]"),
      sliders: screen.getAllByRole("slider").length,
    }).toStrictEqual({
      caveat: null,
      example: false,
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
    expect(summary.textContent).toBe(EXPLORER_SCENARIO_DEFAULT_STATUS);
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      county: impact?.includes("Conejos County"),
      delta: impact?.includes("points") || impact?.includes("→"),
      priority: impact?.includes("Lower Atlas priority") ?? false,
      published:
        impact?.includes("Published score") &&
        impact.includes("Score with your changes") &&
        (impact.match(/22\.9/g)?.length ?? 0) === 2,
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
        .getByRole("slider", { name: "Tick / pathogen weight" })
        .getAttribute("value"),
      summary: screen.getByTestId("explorer-scenario-impact-summary")
        .textContent,
    }).toStrictEqual({
      baseline: false,
      priority: false,
      share: "85",
      summary: "Score with your changes unavailable",
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
    ).toBe(EXPLORER_SCENARIO_DEFAULT_STATUS);
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
      "Published score to the score with your changes."
    );
    expect(summary.textContent).toContain(
      "+11.7 points from published score · Scenario settings"
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact = screen.getByTestId("explorer-scenario-impact").textContent;
    expect({
      adjusted:
        impact?.includes("Score with your changes") && impact.includes("74.1"),
      priority: impact?.includes(
        `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`
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
      assumptionsChanged: true,
      status: "ready",
    });

    expect(
      screen.getByTestId("explorer-scenario-impact-summary").textContent
    ).toContain("\u221210.7 points from published score · Scenario settings");
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
    ).toContain(EXPLORER_SCENARIO_UNCHANGED_STATUS);
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
    expect(summary.textContent).toBe("Score with your changes unavailable");
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const impact =
      screen.getByTestId("explorer-scenario-impact").textContent ?? "";
    expect({
      arrow: impact.includes("→"),
      points: impact.includes("points"),
      priorityCount: impact.match(/Lower Atlas priority/g)?.length ?? 0,
      published: impact.includes("Published score") && impact.includes("0.0"),
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
      screen.getByTestId("explorer-scenario-impact").textContent
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
      next: summary.includes("+11.7 points from published score"),
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
      heading: impact.includes("Autauga County"),
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
    expect(
      screen.getByTestId("explorer-scenario-impact").textContent
    ).toContain("Score comparison is unavailable for this county.");
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
      unchanged: text.includes(EXPLORER_SCENARIO_DEFAULT_STATUS),
      weights:
        text.includes("65% tick / pathogen") && text.includes("35% community"),
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
          .textContent?.includes("85% tick / pathogen") &&
        screen
          .getByTestId("explorer-what-if-scenario")
          .textContent?.includes("15% community")
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
        .textContent?.includes(explorerIncidenceSettingLabel(20)),
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

  it("opens the plain-language explanation and keeps the equation collapsed", () => {
    const onChange = vi.fn<(next: ScoreSettings) => void>();
    renderScenario(SCENARIO_SCORE_DEFAULTS, NO_COUNTY, onChange);
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const methods = screen.getByTestId("explorer-scenario-methods");
    const equation = screen.getByTestId("explorer-scenario-equation");
    const methodText = methods.textContent ?? "";
    const equationText = equation.textContent ?? "";
    const panel =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    expect({
      cutoff: panel.includes("reference point"),
      equationOpen: (equation as HTMLDetailsElement).open,
      footer: screen.getByTestId("explorer-scenario-footer").textContent,
      formula: equationText.includes(EXPLORER_SCENARIO_FORMULA),
      legacyCategory: panel.includes("Priority 1 — Investigate at 70"),
      methodsOpen: (methods as HTMLDetailsElement).open,
      notes: screen.queryAllByRole("button", { name: /Technical note for/ })
        .length,
      safety: methodText.includes("Not a safety finding"),
      sharing: methodText.includes("Select Reset defaults"),
      version: equationText.includes(
        surveillanceGapScoreVersionLabel(
          countyScoreSummaryScoringMethodologyVersionDefault
        )
      ),
    }).toStrictEqual({
      cutoff: false,
      equationOpen: false,
      footer: EXPLORER_SCENARIO_FOOTER,
      formula: true,
      legacyCategory: false,
      methodsOpen: false,
      notes: 0,
      safety: false,
      sharing: true,
      version: true,
    });

    fireEvent.click(equation.querySelector("summary") as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
    expect((equation as HTMLDetailsElement).open).toBeTruthy();
    expect((methods as HTMLDetailsElement).open).toBeFalsy();
  });

  it("shows the missing-data note only when the selected county has published incidence", () => {
    const view = renderScenario(SCENARIO_SCORE_DEFAULTS, {
      assumptionsChanged: false,
      countyName: "Conejos County",
      governedPriority: LOWER,
      governedScore: 22.9,
      publishedIncidence: false,
      scenario: null,
      status: "ready",
    });
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    expect({
      note: screen.queryByTestId("explorer-scenario-missing-applicability"),
      support: screen
        .getByTestId("explorer-what-if-scenario")
        .textContent?.includes("This is not a case estimate."),
    }).toStrictEqual({
      note: null,
      support: true,
    });

    view.rerender(
      <ExplorerWhatIfScenario
        impact={{
          assumptionsChanged: false,
          countyName: "Boulder County",
          countyState: "CO",
          governedPriority: REVIEW,
          governedScore: 65,
          publishedIncidence: true,
          scenario: null,
          status: "ready",
        }}
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );
    const rows = document.querySelectorAll(
      ".ux-reset-explorer-scenario-control"
    );
    expect({
      county: screen
        .getByTestId("explorer-scenario-impact")
        .textContent?.includes("Boulder County, CO"),
      note: screen.getByTestId("explorer-scenario-missing-applicability")
        .textContent,
      rows: rows.length,
      sameClass: [...rows].every(
        (row) =>
          row.getAttribute("class") === "ux-reset-explorer-scenario-control"
      ),
    }).toStrictEqual({
      county: true,
      note: EXPLORER_SCENARIO_MISSING_INACTIVE,
      rows: 3,
      sameClass: true,
    });
  });

  it("keeps stronger incidence reduction on the left of the slider", () => {
    renderScenario();
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const incidence = screen.getByRole("slider", {
      name: "Effect of reported incidence",
    });
    const row = incidence.closest(".ux-reset-explorer-scenario-control");
    const ends = row?.querySelector(
      ".ux-reset-explorer-scenario-ends"
    )?.textContent;
    expect({
      ends,
      max: incidence.getAttribute("max"),
      min: incidence.getAttribute("min"),
    }).toStrictEqual({
      ends: "Lowers it fasterLowers it more gradually",
      max: "200",
      min: "5",
    });
  });

  it("uses the compact approved copy and a dynamic incidence half-reduction note", () => {
    const onChange = vi.fn<(next: ScoreSettings) => void>();
    const view = renderScenario(SCENARIO_SCORE_DEFAULTS, NO_COUNTY, onChange);
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const text =
      screen.getByTestId("explorer-what-if-scenario").textContent ?? "";
    const css = readFileSync("src/features/ux-reset/ux-reset.css", "utf-8")
      .replaceAll(/\s+/g, " ")
      .trim();
    expect({
      community: text.includes("35% community"),
      defaultMissing: text.includes("Default: 75"),
      ends: text.includes("More community") && text.includes("Lower component"),
      half: text.includes(explorerIncidenceHalfReductionNote(50)),
      intro: text.includes(EXPLORER_SCENARIO_INTRO),
      missing: text.includes("This is not a case estimate."),
      navy: css.includes(
        ".ux-reset-explorer-scenario-impact { display: grid; gap: 0.35rem; padding: 0.75rem 0; border: 0; border-top: 1px solid var(--line);"
      ),
      summary: screen.queryByTestId("explorer-scenario-settings"),
      weight: text.includes(
        "Balance tick and pathogen data against community context."
      ),
    }).toStrictEqual({
      community: true,
      defaultMissing: true,
      ends: true,
      half: true,
      intro: true,
      missing: true,
      navy: true,
      summary: null,
      weight: true,
    });

    fireEvent.change(
      screen.getByRole("slider", { name: "Effect of reported incidence" }),
      { target: { value: "20" } }
    );
    view.rerender(
      <ExplorerWhatIfScenario
        impact={NO_COUNTY}
        settings={{ ...SCENARIO_SCORE_DEFAULTS, smooth_k: 20 }}
        onChange={onChange}
      />
    );
    expect(
      screen.getByTestId("explorer-what-if-scenario").textContent
    ).toContain(explorerIncidenceHalfReductionNote(20));
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
        collapsed: EXPLORER_SCENARIO_DEFAULT_STATUS,
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
        collapsed: "+20.0 points from published score · Scenario settings",
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
      collapsed: "\u221225.0 points from published score · Scenario settings",
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
        collapsed: "Score with your changes unavailable",
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
      collapsed: "Score with your changes unavailable",
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
      collapsed: "Score with your changes unavailable",
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
        collapsed: "+20.0 points from published score · Scenario settings",
        countyName: "Autauga County",
        kind: "definite",
        priorityText: `Follow-up category changed: ${REVIEW} → ${INVESTIGATE}`,
      },
      none: {
        collapsed: EXPLORER_SCENARIO_NO_COUNTY,
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
        collapsed: "Score with your changes unavailable",
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
