import { describe, expect, it } from "vitest";

import {
  assessSavedProfile,
  buildProfileWrite,
  completionForSelection,
  mapDefaultJurisdiction,
  profileEchoMatchesWrite,
  reviewStartForSelection,
  savedProfileFromUserProfile,
} from "@/features/ux-reset/profile/default-jurisdiction-contract";
import { resolveStartingReviewScope } from "@/features/ux-reset/review/resolve-review-scope";

const stateOptions = [
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
];
const readyStates = { options: stateOptions, status: "ready" as const };

describe("default jurisdiction contract", () => {
  it("maps a null profile to an unselected incomplete default", () => {
    const selection = mapDefaultJurisdiction(null);
    expect(selection).toStrictEqual({ kind: "unselected" });
    expect(completionForSelection(selection, readyStates)).toStrictEqual({
      reason: "unselected",
      status: "incomplete",
    });
    expect(reviewStartForSelection(selection, readyStates)).toStrictEqual({
      scope: "ALL",
      source: "national-fallback",
    });
  });

  it("maps a profile object with null state_code to explicit national", () => {
    const saved = savedProfileFromUserProfile({
      job_title: null,
      organization: null,
      role: null,
      state_code: null,
    });
    expect(saved.selection).toStrictEqual({ kind: "national" });
    expect(saved.completion.status).toBe("complete");
    expect(reviewStartForSelection(saved.selection, readyStates)).toStrictEqual(
      {
        scope: "ALL",
        source: "confirmed-default",
      }
    );
  });

  it("maps an omitted state_code on a saved profile to explicit national", () => {
    expect(
      mapDefaultJurisdiction({ role: "state_level_epidemiologist" })
    ).toStrictEqual({ kind: "national" });
  });

  it("maps a governed state code without treating optional text as completion", () => {
    const saved = savedProfileFromUserProfile({ state_code: "co" });
    const assessed = assessSavedProfile(saved, readyStates);
    expect(assessed.selection).toStrictEqual({
      kind: "state",
      stateCode: "CO",
    });
    expect(assessed.completion).toBe("complete");
    expect(assessed.reviewStart).toStrictEqual({
      scope: "CO",
      source: "confirmed-default",
    });
    expect(saved.organization).toBeNull();
    expect(saved.jobTitle).toBeNull();
  });

  it("uses one governed result for an unsupported saved state", () => {
    const saved = savedProfileFromUserProfile({ state_code: "MA" });
    const assessed = assessSavedProfile(saved, readyStates);
    expect(assessed).toMatchObject({
      completion: "incomplete",
      dataAttribute: "unrecognized",
      reviewStart: { scope: "ALL", source: "national-fallback" },
      summary: "unsupported",
    });
    expect(resolveStartingReviewScope(false, "ALL", "MA", stateOptions)).toBe(
      "ALL"
    );
  });

  it("keeps loading and empty metadata distinct from confirmed coverage", () => {
    const saved = savedProfileFromUserProfile({ state_code: "CO" });
    const loading = assessSavedProfile(saved, { status: "loading" });
    const empty = assessSavedProfile(saved, { options: [], status: "ready" });
    const unavailable = assessSavedProfile(saved, { status: "unavailable" });
    expect(loading.completion).toBe("unavailable");
    expect(loading.summary).toBe("loading");
    expect(loading.reviewStart.source).toBe("pending");
    expect({
      empty: empty.summary,
      emptyStart: empty.reviewStart.source,
      unavailable: unavailable.summary,
      unavailableStart: unavailable.reviewStart.source,
    }).toStrictEqual({
      empty: "unsupported",
      emptyStart: "national-fallback",
      unavailable: "metadata-unavailable",
      unavailableStart: "national-fallback",
    });
  });

  it("does not treat an unrecognized code as national", () => {
    const selection = mapDefaultJurisdiction({ state_code: "12" });
    expect(selection).toStrictEqual({ kind: "unrecognized", stateCode: "12" });
    expect(reviewStartForSelection(selection, readyStates).source).toBe(
      "national-fallback"
    );
  });

  it("keeps an explicit Review scope ahead of the saved default", () => {
    const saved = savedProfileFromUserProfile({ state_code: "CO" });
    const start = reviewStartForSelection(saved.selection, readyStates);
    expect(
      resolveStartingReviewScope(true, "NY", start.scope, stateOptions)
    ).toBe("NY");
    expect(
      resolveStartingReviewScope(false, "ALL", start.scope, stateOptions)
    ).toBe("CO");
  });

  it("refuses to build a write when no jurisdiction is chosen", () => {
    const built = buildProfileWrite(
      {
        jobTitle: "",
        jurisdiction: "unset",
        organization: "",
        role: null,
      },
      stateOptions
    );
    expect(built.ok).toBeFalsy();
  });

  it("builds a national write with empty optional fields", () => {
    const built = buildProfileWrite(
      {
        jobTitle: "   ",
        jurisdiction: "national",
        organization: "",
        role: null,
      },
      stateOptions
    );
    if (!built.ok) {
      throw new Error("Expected a national profile write.");
    }
    expect(built.body).toStrictEqual({
      job_title: null,
      organization: null,
      role: null,
      state_code: null,
    });
    const saved = savedProfileFromUserProfile({
      job_title: null,
      organization: null,
      role: null,
      state_code: null,
    });
    expect(profileEchoMatchesWrite(built.body, saved)).toBeTruthy();
  });

  it("builds a state write only for a governed code", () => {
    const built = buildProfileWrite(
      {
        jobTitle: "",
        jurisdiction: { stateCode: "co" },
        organization: "",
        role: null,
      },
      stateOptions
    );
    if (!built.ok) {
      throw new Error("Expected a state profile write.");
    }
    expect(built.body.state_code).toBe("CO");
    expect(
      buildProfileWrite(
        {
          jobTitle: "",
          jurisdiction: { stateCode: "ZZ" },
          organization: "",
          role: null,
        },
        stateOptions
      ).ok
    ).toBeFalsy();
  });
});
