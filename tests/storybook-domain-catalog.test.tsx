import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  districtCounty,
  missingCounty,
  publishedZeroCounty,
  storyChartCounties,
  storyRankedCounties,
  wakeCounty,
} from "../stories/fixtures/story-counties";
import { ScatterStory } from "../stories/geographic-scatter.stories";
import { ViewStory } from "../stories/geographic-view-selector.stories";
import { RankedStory } from "../stories/ranked-counties.stories";

describe("story county fixtures", () => {
  it("keeps ranked and chart counties in the lower 48 and DC", () => {
    const counties = [
      ...storyRankedCounties(41),
      ...storyChartCounties,
      districtCounty,
      wakeCounty,
    ];
    expect(storyRankedCounties(41)).toHaveLength(41);
    expect(
      counties.every(
        (county) =>
          county.fips.slice(0, 2) !== "02" && county.fips.slice(0, 2) !== "15"
      )
    ).toBeTruthy();
    expect(districtCounty.fips).toBe("11001");
    expect(publishedZeroCounty.case_count_floor_2023).toBe(0);
    expect(missingCounty.case_count_floor_2023).toBeNull();
  });

  it("resets ranked selection and the view when the preset changes", () => {
    const ranked = render(<RankedStory preset="selected" />);
    expect(screen.getByText("Selected Boulder County (08013)")).toBeTruthy();
    ranked.rerender(<RankedStory preset="empty" />);
    expect(screen.getByText("Selected none")).toBeTruthy();
    ranked.unmount();

    const view = render(<ViewStory preset="tiles" />);
    expect(screen.getByText("Active view Geographic tiles")).toBeTruthy();
    view.rerender(<ViewStory preset="trends" />);
    expect(screen.getByText("Active view Release trends")).toBeTruthy();
  });

  it("resets the scatter selection when the preset changes", () => {
    const scatter = render(<ScatterStory preset="adams" />);
    expect(screen.getByText("Selected Adams County (08001)")).toBeTruthy();
    scatter.rerender(<ScatterStory preset="none" />);
    expect(screen.getByText("Selected none")).toBeTruthy();
  });
});
