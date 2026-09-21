import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScoringAssumptions } from "../src/components/experiment-atlas";
import type { CountyDetail } from "../src/generated/models";
import type { ScoreSettings } from "../src/lib/atlas-ui";

// `experiment-atlas` renders `AtlasMap`, which loads maplibre-gl. maplibre-gl
// touches browser APIs jsdom does not implement, so it is stubbed the same
// way `tests/atlas-map.test.tsx` stubs it. `vi.mock` calls are hoisted above
// imports by Vitest, so this still applies before `experiment-atlas` loads.
vi.mock(import("maplibre-gl"), () => ({
  default: {
    Map: function Map() {
      return {
        addControl() {
          return this;
        },
        on() {
          return this;
        },
        remove() {
          // no-op
        },
      };
    },
    NavigationControl: function NavigationControl() {
      return {};
    },
  } as unknown as typeof import("maplibre-gl"),
}));

const detail: CountyDetail = {
  burgdorferi_status: "No records",
  case_count_floor_2023: null,
  color: "#efc64a",
  county: "Adams County",
  evidence_completeness: 50,
  fips: "08001",
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  incidence_floor_2023: null,
  pacificus_status: "No records",
  population: 520_149,
  priority: "Lower Atlas priority — Not a safety finding",
  release: {
    bundle_sha256: "a".repeat(64),
    generated_at: "2026-08-06T05:37:16Z",
    limitations:
      "Population-level hypothesis generator; not diagnosis, exposure location, true incidence, or individual risk.",
    loaded_at: "2026-08-15T15:58:20.809-06:00",
    methodology_version: "alpha-0.2.0",
    release_id: "alpha-2026-08-06",
    schema_version: "0.2.0",
    scope: "United States counties",
    score_defaults: {} as never,
    sources: [
      {
        key: "human",
        label: "CDC Lyme disease public-use surveillance",
        note: "Published floor.",
        url: "https://data.cdc.gov/d/x5j9-wybp",
        vintage: "2023",
      },
    ],
    states: [],
  },
  rucc_2023: 1,
  scapularis_status: "No records",
  score: {
    access_signal: 67.4,
    community: 56.5,
    ecological: 0,
    human_weakness: 75,
    pathogen_signal: 0,
    rural_signal: 0,
    score: 14.8,
    svi_signal: 72.6,
    tick_signal: 0,
  },
  state: "CO",
  state_name: "Colorado",
  state_unallocated_records_2023: 29,
  svi_percentile: 0.7264,
  tick_status: "No records",
  uninsured_percent: 10.8,
  uninsured_percentile: 0.6742,
};

const defaultSettings: ScoreSettings = {
  ecological_share: 65,
  low_incidence_breakpoint: 10,
  missing_human_weakness: 75,
};

function noopOnChange() {
  return vi.fn<(settings: ScoreSettings) => void>();
}

function getScoringDetails(container: HTMLElement) {
  const details = container.querySelector("details#scoring");
  if (!details) {
    throw new Error("Expected #scoring details element to be rendered");
  }
  return details as HTMLDetailsElement;
}

describe("Collapsible scoring accordion disclosure", () => {
  afterEach(cleanup);

  it("stays collapsed by default", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    expect(getScoringDetails(container).hasAttribute("open")).toBeFalsy();
  });

  it("shows the three active scoring assumptions in the collapsed summary", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    const summary = within(container.querySelector("summary") as HTMLElement);
    expect(summary.getByText("Tick/pathogen share")).toBeTruthy();
    expect(summary.getByText("65%", { exact: true })).toBeTruthy();
    expect(summary.getByText("Published-record threshold")).toBeTruthy();
    expect(summary.getByText("10 per 100,000")).toBeTruthy();
    expect(summary.getByText("Missing county-record value")).toBeTruthy();
  });

  it("labels the collapsed disclosure with an explicit expand affordance", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    const summary = within(container.querySelector("summary") as HTMLElement);
    expect(summary.getByText("View & adjust assumptions")).toBeTruthy();
    expect(summary.getByText("Hide assumptions")).toBeTruthy();
  });

  it("opens the native details element when the summary is clicked", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    fireEvent.click(screen.getByText("Scoring calculation"));

    expect(getScoringDetails(container).hasAttribute("open")).toBeTruthy();
    expect(screen.getByLabelText("Tick and pathogen share")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open the full scoring lab" })
    ).toBeTruthy();
  });

  it("closes again on a second toggle", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    const summaryText = screen.getByText("Scoring calculation");
    fireEvent.click(summaryText);
    fireEvent.click(summaryText);

    expect(getScoringDetails(container).hasAttribute("open")).toBeFalsy();
  });

  it("reflects an updated settings value in the collapsed summary after rerender", () => {
    const { container, rerender } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    rerender(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={{ ...defaultSettings, ecological_share: 70 }}
      />
    );

    const summary = within(container.querySelector("summary") as HTMLElement);
    expect(summary.getByText("70%", { exact: true })).toBeTruthy();
    expect(summary.queryByText("65%", { exact: true })).toBeNull();
  });

  it("does not nest an interactive button inside the disclosure summary", () => {
    const { container } = render(
      <ScoringAssumptions
        collapsible
        detail={detail}
        onChange={noopOnChange()}
        settings={defaultSettings}
      />
    );

    const summary = container.querySelector("summary");
    expect(summary?.querySelector("button")).toBeNull();
  });
});
