import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScoringCalculationPreview } from "../src/components/scoring-calculation-preview";
import type { ScoreSettings } from "../src/lib/atlas-ui";

const defaultSettings: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

describe("Collapsed scoring assumptions preview", () => {
  afterEach(cleanup);

  it("renders the current tick/pathogen share and published-record threshold", () => {
    render(<ScoringCalculationPreview settings={defaultSettings} />);

    expect(screen.getByText("Tick/pathogen share")).toBeTruthy();
    expect(screen.getByText("65%")).toBeTruthy();
    expect(screen.getByText("Published-record threshold")).toBeTruthy();
    expect(screen.getByText("10 per 100,000")).toBeTruthy();
  });

  it("renders the current missing county-record value", () => {
    render(<ScoringCalculationPreview settings={defaultSettings} />);

    expect(screen.getByText("Missing county-record value")).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
  });

  it("reflects a changed settings triple with no extra state", () => {
    const changedSettings: ScoreSettings = {
      ecological_share: 70,
      low_incidence_breakpoint: 15,
      missing_human_weakness: 80,
    };

    render(<ScoringCalculationPreview settings={changedSettings} />);

    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("15 per 100,000")).toBeTruthy();
    expect(screen.getByText("80")).toBeTruthy();
  });
});
