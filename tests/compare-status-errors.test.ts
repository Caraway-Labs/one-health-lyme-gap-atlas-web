import { describe, expect, it } from "vitest";

import { compareReaderState } from "@/features/ux-reset/compare/compare-compact-evidence";
import type { CompareProfileAlignment } from "@/features/ux-reset/compare/compare-county-profile";
import { compareStatusErrors } from "@/features/ux-reset/compare/compare-status-errors";

function profile(
  overrides: Partial<CompareProfileAlignment> = {}
): CompareProfileAlignment {
  return {
    leftFips: "08001",
    recordsReady: true,
    releaseMismatch: false,
    retryable: false,
    rightFips: "08013",
    rows: [],
    ...overrides,
  };
}

describe(compareStatusErrors, () => {
  it("keeps whole-page failures and does not list individual measures", () => {
    const errors = compareStatusErrors({
      alignment: null,
      catalogError: null,
      directoryError: null,
      evidenceError: "Aligned evidence did not load for these two counties.",
      metadataError: null,
      profile: profile(),
      profileError: null,
    });
    expect({
      ids: errors.map((error) => error.id),
      mentionsMeasures: errors.some((error) =>
        error.message.includes("Some measures could not be loaded")
      ),
    }).toStrictEqual({
      ids: ["evidence"],
      mentionsMeasures: false,
    });
  });

  it("still explains a county record that did not load", () => {
    const errors = compareStatusErrors({
      alignment: null,
      catalogError: null,
      directoryError: null,
      evidenceError: null,
      metadataError: null,
      profile: profile({ retryable: true }),
      profileError: null,
    });
    expect(errors.map((error) => error.id)).toStrictEqual(["profile-partial"]);
  });
});

describe(compareReaderState, () => {
  it("uses the approved missing and failure wording", () => {
    expect({
      failed: compareReaderState("failed", "This measure could not be loaded."),
      missing: compareReaderState(
        "missing",
        "No observation. This absence is not zero."
      ),
      period: compareReaderState("unsupported_period", "Comparison withheld."),
    }).toStrictEqual({
      failed: "Couldn\u2019t load this evidence.",
      missing: "No published value. This absence is not zero.",
      period: "No published value. This absence is not zero.",
    });
  });
});
