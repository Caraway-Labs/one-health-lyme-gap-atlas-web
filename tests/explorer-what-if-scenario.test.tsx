import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCENARIO_SCORE_DEFAULTS } from "../src/features/ux-reset/review/explorer-scenario-score";
import { ExplorerWhatIfScenario } from "../src/features/ux-reset/review/explorer-what-if-scenario";
import type { ScoreSettings } from "../src/lib/atlas-ui";

describe(ExplorerWhatIfScenario, () => {
  afterEach(() => {
    cleanup();
  });

  it("starts collapsed with the governed assumption values", () => {
    render(
      <ExplorerWhatIfScenario
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );

    const panel = screen.getByTestId("explorer-what-if-scenario");
    const summary = screen.getByTestId("explorer-what-if-summary");
    expect(panel.tagName).toBe("DETAILS");
    expect((panel as HTMLDetailsElement).open).toBeFalsy();
    expect(summary.textContent).toContain("What-if scenario");
    expect(summary.textContent).toContain("65%");
    expect(summary.textContent).toContain("View & adjust assumptions");
  });

  it("shows the published-record threshold and missing-record value while collapsed", () => {
    render(
      <ExplorerWhatIfScenario
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );
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
    const view = render(
      <ExplorerWhatIfScenario settings={settings} onChange={onChange} />
    );
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
      <ExplorerWhatIfScenario settings={settings} onChange={onChange} />
    );
    fireEvent.click(screen.getByTestId("explorer-scenario-reset"));
    expect(onChange).toHaveBeenLastCalledWith(SCENARIO_SCORE_DEFAULTS);
    expect(screen.getByText(/not a diagnosis/i)).toBeTruthy();
    expect(screen.queryByText(/personal disease risk/i)).toBeNull();
  });

  it("renders the shared slider primitive", () => {
    render(
      <ExplorerWhatIfScenario
        settings={SCENARIO_SCORE_DEFAULTS}
        onChange={vi.fn<() => void>()}
      />
    );
    fireEvent.click(screen.getByTestId("explorer-what-if-summary"));
    const [slider] = screen.getAllByRole("slider");
    expect(slider?.dataset.slot).toBe("slider");
    expect(slider?.tagName).toBe("INPUT");
  });
});
