import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewStateNavigationEntries } from "@/features/ux-reset/review/review-state-navigation";

import { headerModel } from "../stories/county-intelligence-header.stories";
import { storyReleaseStates } from "../stories/fixtures/story-states";
import {
  isLower48OrDcFips,
  syntheticCounty,
  syntheticReleaseId,
} from "../stories/fixtures/synthetic-county";
import { OperatingPictureStory } from "../stories/review-operating-picture.stories";
import { ScopeStory } from "../stories/review-scope-selector.stories";
import { StateOrientationStory } from "../stories/review-state-orientation.stories";
import { SelectStory } from "../stories/select.stories";
import {
  fetchCountyDisplayGeometry,
  setStoryGeometryMode,
} from "../stories/support/county-geography-substitute";

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/app/review",
  useSearchParams: (): ReadonlyURLSearchParams =>
    new URLSearchParams() as unknown as ReadonlyURLSearchParams,
}));

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

  it("resets review scope when the preset control changes", () => {
    const view = render(<ScopeStory preset="national" />);
    expect(screen.getByTestId("review-scope-selected").textContent).toBe(
      "Selected scope ALL"
    );
    view.rerender(<ScopeStory preset="colorado" />);
    expect(screen.getByTestId("review-scope-selected").textContent).toBe(
      "Selected scope CO"
    );
    view.rerender(<ScopeStory preset="unlisted" />);
    expect(screen.getByTestId("review-scope-selected").textContent).toBe(
      "Selected scope WY"
    );
    view.rerender(<ScopeStory preset="long-label" />);
    expect(screen.getByText("District of Columbia (DC)")).toBeTruthy();
    expect(screen.getByTestId("review-scope-selected").textContent).toBe(
      "Selected scope DC"
    );
  });

  it("resets the select value when the preset control changes", () => {
    const view = render(<SelectStory preset="placeholder" size="default" />);
    expect(screen.getByTestId("select-current").textContent).toBe(
      "Selected none"
    );
    view.rerender(<SelectStory preset="selected" size="default" />);
    expect(screen.getByTestId("select-current").textContent).toBe(
      "Selected 08013"
    );
    expect(screen.getByText("Boulder County, Colorado")).toBeTruthy();
    view.rerender(<SelectStory preset="disabled" size="default" />);
    expect(screen.getByTestId("select-current").textContent).toBe(
      "Selected none"
    );
    expect(screen.getByRole("combobox", { name: "County" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("resets the selected county when the operating-picture preset changes", () => {
    const view = render(
      <OperatingPictureStory geometry="ready" preset="selected" />
    );
    expect(screen.getByTestId("operating-selected").textContent).toBe(
      "Selected county 08001"
    );
    view.rerender(<OperatingPictureStory geometry="ready" preset="none" />);
    expect(screen.getByTestId("operating-selected").textContent).toBe(
      "Selected county none"
    );
  });

  it("follows the orientation phase control", () => {
    const view = render(<StateOrientationStory phase="boundary-failed" />);
    expect(
      screen.getByTestId("review-state-navigation-map").dataset.mapPhase
    ).toBe("boundary-failed");
    view.rerender(<StateOrientationStory phase="ready" />);
    expect(
      screen.getByTestId("review-state-navigation-map").dataset.mapPhase
    ).toBe("ready");
  });

  it("resets orientation interaction when the phase changes", () => {
    const view = render(<StateOrientationStory phase="boundary-failed" />);
    fireEvent.change(screen.getByTestId("review-state-search"), {
      target: { value: "Colorado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "CO, Colorado" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    expect(screen.getByTestId("orientation-opened").textContent).toBe(
      "Opened state CO"
    );
    expect(screen.getByTestId("orientation-retries").textContent).toBe(
      "Map retries 1"
    );
    view.rerender(<StateOrientationStory phase="ready" />);
    expect(screen.getByTestId("orientation-opened").textContent).toBe(
      "Opened state none"
    );
    expect(screen.getByTestId("orientation-retries").textContent).toBe(
      "Map retries 0"
    );
    const search = screen.getByTestId("review-state-search");
    expect(search instanceof HTMLInputElement && search.value).toBe("");
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
