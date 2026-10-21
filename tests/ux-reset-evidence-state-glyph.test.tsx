import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EvidenceObject,
  EvidenceStateGlyph,
  evidenceAvailabilityValues,
  evidenceObjectFromObservation,
  evidenceStateClassName,
} from "@/features/ux-reset/evidence";
import type { EvidenceAvailability } from "@/features/ux-reset/evidence";

import {
  missingNumericObservation,
  noaaDailyPrecipitationObservation,
  publishedZeroObservation,
  suppressedNumericObservation,
} from "./fixtures/ux-reset-evidence-observations";

const STATES: readonly {
  availability: EvidenceAvailability;
  className: string;
  icon: string;
  word: string;
}[] = [
  {
    availability: evidenceAvailabilityValues.available,
    className: "atlas-state-available",
    icon: "lucide-circle-check",
    word: "Available",
  },
  {
    availability: evidenceAvailabilityValues.limited,
    className: "atlas-state-limited",
    icon: "lucide-circle-dashed",
    word: "Limited",
  },
  {
    availability: evidenceAvailabilityValues.unavailable,
    className: "atlas-state-unavailable",
    icon: "lucide-circle-off",
    word: "Unavailable",
  },
];

describe(EvidenceStateGlyph, () => {
  afterEach(cleanup);

  it.each(STATES)(
    "renders a decorative $icon icon beside the visible word $word",
    ({ availability, icon, word }) => {
      render(<EvidenceStateGlyph availability={availability} />);
      const glyph = screen.getByTestId("evidence-state-glyph");
      expect(glyph).toHaveAttribute("data-availability", availability);
      expect(glyph).toHaveTextContent(word);
      const svg = glyph.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveClass(icon);
      expect(within(glyph).getByText(word)).toBeVisible();
    }
  );

  it("lets the displayed value act as the one visible word", () => {
    render(
      <EvidenceStateGlyph availability="unavailable" label="Unavailable" />
    );
    expect(screen.getAllByText("Unavailable")).toHaveLength(1);
  });

  it.each(STATES)(
    "maps $availability to the $className treatment class",
    ({ availability, className }) => {
      expect(evidenceStateClassName(availability)).toBe(className);
    }
  );
});

describe("compact EvidenceObject", () => {
  afterEach(cleanup);

  function renderCompact(
    observation: Parameters<
      typeof evidenceObjectFromObservation
    >[0]["observation"],
    props: { showGovernedLimitations?: boolean } = {}
  ) {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      measureType: "measurement",
      observation,
    });
    render(<EvidenceObject model={model} presentation="compact" {...props} />);
    return screen.getByTestId("ux-reset-evidence-object");
  }

  it("shows Unavailable once, as the value, with no labelled Unavailable fields", () => {
    const card = renderCompact(missingNumericObservation);
    expect({
      compact: card.dataset.presentation,
      hatched: card.classList.contains("atlas-state-unavailable"),
      inspectActions: within(card).getAllByTestId("evidence-provenance-inspect")
        .length,
      labelledStrip: card.querySelector("dl.ux-reset-evidence-strip-meta"),
      unavailableWords: within(card).getAllByText("Unavailable", {
        exact: true,
      }).length,
      value: within(card).getByTestId("evidence-display-value").textContent,
    }).toStrictEqual({
      compact: "compact",
      hatched: true,
      inspectActions: 1,
      labelledStrip: null,
      unavailableWords: 1,
      value: "Unavailable",
    });
    expect(
      within(card).getByTestId("evidence-provenance-chips")
    ).not.toHaveTextContent("Unavailable");
  });

  it("keeps an Available value, glyph word, chips, and one inspect action", () => {
    const card = renderCompact(publishedZeroObservation);
    const chips = within(card).getByTestId("evidence-provenance-chips");
    expect({
      glyph: within(card).getByTestId("evidence-state-glyph").textContent,
      inspectActions: within(card).getAllByTestId("evidence-provenance-inspect")
        .length,
      solid: card.classList.contains("atlas-state-available"),
      value: within(card).getByTestId("evidence-display-value").textContent,
    }).toStrictEqual({
      glyph: "Available",
      inspectActions: 1,
      solid: true,
      value: "0 mm",
    });
    expect(chips).toHaveTextContent("Source family: ");
    expect(chips).toHaveTextContent("Observation period: ");
    expect(chips).toHaveTextContent("Evidence type: ");
  });

  it("marks governed limitations as Limited with an outline ring class, not a warning color", () => {
    const card = renderCompact(noaaDailyPrecipitationObservation);
    expect({
      glyph: within(card).getByTestId("evidence-state-glyph").textContent,
      ring: card.classList.contains("atlas-state-limited"),
      warningClass: /destructive|red|warning/.test(card.className),
    }).toStrictEqual({ glyph: "Limited", ring: true, warningClass: false });
    // The limitation text still lives behind the inspect action.
    expect(
      within(card).getByTestId("evidence-provenance-limitations")
    ).toHaveTextContent("Historical availability varies");
  });

  it("shows Suppressed as Limited, never as a numeric value", () => {
    const card = renderCompact(suppressedNumericObservation);
    expect({
      limited: card.classList.contains("atlas-state-limited"),
      value: within(card).getByTestId("evidence-display-value").textContent,
    }).toStrictEqual({ limited: true, value: "Suppressed" });
  });

  it("keeps the standard presentation unchanged by default", () => {
    const model = evidenceObjectFromObservation({
      claimLabel: "Daily precipitation",
      observation: publishedZeroObservation,
    });
    render(<EvidenceObject model={model} />);
    const card = screen.getByTestId("ux-reset-evidence-object");
    expect({
      presentation: card.dataset.presentation,
      standard: card.classList.contains("ux-reset-evidence-object"),
      strip: screen.queryByText("Source family") !== null,
    }).toStrictEqual({ presentation: undefined, standard: true, strip: true });
  });
});
