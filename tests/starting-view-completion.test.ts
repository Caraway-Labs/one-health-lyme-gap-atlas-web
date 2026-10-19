import { describe, expect, it } from "vitest";

import {
  buildStartingViewCompletionWrite,
  destinationAfterStartingView,
  explicitInternalDestination,
  isStartingViewComplete,
  startingViewCompletionConfirmed,
  startingViewStateOptions,
} from "@/features/ux-reset/onboarding/starting-view-completion";
import { savedProfileFromUserProfile } from "@/features/ux-reset/profile/default-jurisdiction-contract";

const states = [
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
];

describe("starting view completion", () => {
  it("does not treat a null state or a missing profile as completion", () => {
    expect(
      isStartingViewComplete(savedProfileFromUserProfile(null))
    ).toBeFalsy();
    expect(
      isStartingViewComplete(
        savedProfileFromUserProfile({
          state_code: null,
          starting_view_version: null,
        })
      )
    ).toBeFalsy();
    expect(
      isStartingViewComplete(savedProfileFromUserProfile({ state_code: "CO" }))
    ).toBeFalsy();
  });

  it("confirms United States only when version 1 echoes a null state", () => {
    const saved = savedProfileFromUserProfile({
      job_title: "Analyst",
      organization: "State lab",
      role: null,
      state_code: null,
      starting_view_version: 1,
    });
    expect(startingViewCompletionConfirmed(saved, null)).toBeTruthy();
    expect(startingViewCompletionConfirmed(saved, "CO")).toBeFalsy();
  });

  it("confirms one state only when version 1 echoes that code", () => {
    const saved = savedProfileFromUserProfile({
      state_code: "CO",
      starting_view_version: 1,
    });
    expect(startingViewCompletionConfirmed(saved, "CO")).toBeTruthy();
    expect(startingViewCompletionConfirmed(saved, null)).toBeFalsy();
  });

  it("sends completion with the existing optional fields and boolean true", () => {
    const existing = savedProfileFromUserProfile({
      job_title: "Analyst",
      organization: "State lab",
      role: "state_level_epidemiologist",
      state_code: null,
    });
    const built = buildStartingViewCompletionWrite(
      existing,
      { stateCode: "co" },
      states
    );
    if (!built.ok) {
      throw new Error("Expected a completion write.");
    }
    expect(built.body).toStrictEqual({
      complete_starting_view: true,
      job_title: "Analyst",
      organization: "State lab",
      role: "state_level_epidemiologist",
      state_code: "CO",
    });
  });

  it("keeps an explicit destination for a completed account and drops an unsafe one", () => {
    const completed = savedProfileFromUserProfile({
      state_code: "CO",
      starting_view_version: 1,
    });
    expect(
      destinationAfterStartingView(completed, "/app/review?scope=NY")
    ).toBe("/app/review?scope=NY");
    expect(
      destinationAfterStartingView(completed, "/app/investigate?county=08001")
    ).toBe("/app/investigate?county=08001");
    expect(destinationAfterStartingView(completed, null)).toBe("/explore");
    expect(explicitInternalDestination("//evil.example")).toBeNull();
    expect(
      destinationAfterStartingView(completed, "https://evil.example")
    ).toBe("/explore");
  });

  it("sends an incomplete account to Atlas Explorer, not the requested path", () => {
    const incomplete = savedProfileFromUserProfile({ state_code: "CO" });
    expect(
      destinationAfterStartingView(incomplete, "/app/investigate?county=08001")
    ).toBe("/explore");
  });

  it("offers only the lower 48 and the District of Columbia", () => {
    expect(
      startingViewStateOptions([
        { code: "AK", name: "Alaska" },
        { code: "CO", name: "Colorado" },
        { code: "DC", name: "District of Columbia" },
        { code: "HI", name: "Hawaii" },
        { code: "PR", name: "Puerto Rico" },
      ])
    ).toStrictEqual([
      { code: "CO", name: "Colorado" },
      { code: "DC", name: "District of Columbia" },
    ]);
    const rejected = buildStartingViewCompletionWrite(
      null,
      { stateCode: "AK" },
      startingViewStateOptions([
        { code: "AK", name: "Alaska" },
        { code: "CO", name: "Colorado" },
      ])
    );
    expect(rejected.ok).toBeFalsy();
  });
});
