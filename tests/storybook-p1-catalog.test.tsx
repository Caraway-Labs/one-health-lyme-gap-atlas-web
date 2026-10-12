import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { reviewStateNavigationEntries } from "@/features/ux-reset/review/review-state-navigation";

import { headerModel } from "../stories/county-intelligence-header.stories";
import { storyReleaseStates } from "../stories/fixtures/story-states";
import {
  isLower48OrDcFips,
  syntheticCounty,
  syntheticReleaseId,
} from "../stories/fixtures/synthetic-county";
import { StateOrientationStory } from "../stories/review-state-orientation.stories";
import {
  fetchCountyDisplayGeometry,
  setStoryGeometryMode,
} from "../stories/support/county-geography-substitute";

describe("Storybook P1 catalog fixtures", () => {
  afterEach(() => {
    cleanup();
    setStoryGeometryMode("ready");
  });

  it("keeps story states in the lower 48 and DC", () => {
    const codes = storyReleaseStates.map((state) => state.code);
    const entries = reviewStateNavigationEntries(storyReleaseStates);
    expect(codes).toStrictEqual(["CO", "DC", "NC", "NY"]);
    expect(
      entries.some((entry) => entry.code === "AK" || entry.code === "HI")
    ).toBeFalsy();
    expect(isLower48OrDcFips(syntheticCounty.fips)).toBeTruthy();
    expect(entries.find((entry) => entry.code === "CO")?.availability).toBe(
      "supported"
    );
    expect(entries.find((entry) => entry.code === "AL")?.availability).toBe(
      "unavailable"
    );
  });

  it("opens Colorado from the non-map list", () => {
    render(<StateOrientationStory phase="boundary-failed" />);
    fireEvent.click(screen.getByRole("button", { name: "CO, Colorado" }));
    expect(screen.getByTestId("orientation-opened").textContent).toBe(
      "Opened state CO"
    );
    expect(
      screen.getByRole("button", { name: "AL, not in this release" })
    ).toHaveProperty("disabled", true);
  });

  it("falls back to FIPS when the county name is absent", () => {
    expect(headerModel("fips-fallback")).toMatchObject({
      countyLabel: null,
      fips: "08001",
      releaseId: syntheticReleaseId,
    });
    expect(headerModel("no-county").countyLabel).toBeNull();
    expect(headerModel("resolved").countyLabel).toBe("Adams County");
  });

  it("returns synthetic Adams County geometry without a service call", async () => {
    setStoryGeometryMode("ready");
    const ready = await fetchCountyDisplayGeometry();
    setStoryGeometryMode("error");
    const failed = fetchCountyDisplayGeometry();
    expect(ready.features[0]?.properties.fips).toBe("08001");
    await expect(failed).rejects.toThrow(/unavailable/);
  });
});
