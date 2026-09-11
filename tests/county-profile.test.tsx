import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountyProfile } from "../src/components/county-profile";

const settings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

const detail = {
  burgdorferi_status: "Present",
  color: "#efc64a",
  county: "Adams",
  evidence_completeness: 6,
  fips: "08001",
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  population: 500_000,
  priority: "Priority 2 — Review",
  score: {
    access_signal: 50,
    community: 50,
    ecological: 100,
    human_weakness: 75,
    pathogen_signal: 100,
    rural_signal: 12.5,
    score: 61.9,
    svi_signal: 50,
    tick_signal: 100,
  },
  state: "CO",
  state_name: "Colorado",
  tick_status: "Established",
} as never;

describe("County profile presentation", () => {
  afterEach(cleanup);

  it("renders priority, score, and ranking reasons", () => {
    render(
      <CountyProfile
        copied={false}
        datasetVersion="alpha-2026-08-06"
        detail={detail}
        onCopy={vi.fn<() => void>()}
        settings={settings}
      />
    );

    expect(screen.getByText("Moderate review priority").textContent).toBe(
      "Moderate review priority"
    );
    expect(screen.getByText("61.9").textContent).toBe("61.9");
    expect(screen.getByText("/ 100").textContent).toBe("/ 100");
    expect(
      screen.getByRole("heading", { name: "Published Lyme case data" })
        .textContent
    ).toBe("Published Lyme case data");
    expect(
      screen.getByRole("heading", { name: "Tick presence" }).textContent
    ).toBe("Tick presence");
  });

  it("exposes signal values through an accessible progressbar", () => {
    render(
      <CountyProfile
        copied={false}
        datasetVersion="alpha-2026-08-06"
        detail={detail}
        onCopy={vi.fn<() => void>()}
        settings={settings}
      />
    );

    expect(
      screen
        .getByRole("progressbar", {
          name: "Low or missing published case data",
        })
        .getAttribute("aria-valuenow")
    ).toBe("75");
  });

  it("invokes the copy action and shows the copied label", () => {
    const onCopy = vi.fn<() => void>();
    const { rerender } = render(
      <CountyProfile
        copied={false}
        datasetVersion="alpha-2026-08-06"
        detail={detail}
        onCopy={onCopy}
        settings={settings}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copy county summary" })
    );
    expect(onCopy).toHaveBeenCalledOnce();

    rerender(
      <CountyProfile
        copied
        datasetVersion="alpha-2026-08-06"
        detail={detail}
        onCopy={onCopy}
        settings={settings}
      />
    );
    expect(
      screen.getByRole("button", { name: "Summary copied" }).textContent
    ).toBe("Summary copied");
    expect(
      screen.getByRole("region", { name: "Conduct targeted follow-up" })
        .textContent
    ).toContain("review recommendation");
  });
});
