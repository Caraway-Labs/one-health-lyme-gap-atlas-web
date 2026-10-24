import { describe, expect, it } from "vitest";

import {
  comparePublicStatus,
  uninsuredAxisMax,
} from "@/features/ux-reset/compare/compare-public-status";
import {
  membershipPercentText,
  situationDisplay,
} from "@/features/ux-reset/compare/compare-situation-display";
import type { CompareSideValue } from "@/features/ux-reset/compare/compare-visual-model";
import type { IntelligencePerspectiveView } from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import { ValueState } from "@/generated/models";

function missing(
  reason: "failed" | "suppressed" | "unavailable",
  text: string
): CompareSideValue {
  return { kind: "missing", reason, text };
}

describe("compare public status", () => {
  it("keeps a published zero distinct from a missing value", () => {
    const status = comparePublicStatus(
      {
        evidence: {
          availability: "available",
          claimLabel: "Cases",
          displayValue: "0",
          provenance: {
            datasetVintage: null,
            evidenceType: "Unavailable",
            inspectSummary: "",
            limitations: [],
            materialCaveat: null,
            methodVersion: null,
            observationPeriod: "2023",
            sourceFamily: "CDC",
            sourceUrl: null,
            technical: {},
          },
          reasonCode: ValueState.ZERO,
          valueNote: null,
        },
        isZero: true,
        kind: "value",
        limited: false,
        number: 0,
        text: "0",
      },
      false
    );
    expect(status.label).toBe("0");
    expect(status.detail).toContain("Published zero");
  });

  it("names a request failure without calling it unpublished", () => {
    expect(
      comparePublicStatus(missing("failed", "Couldn’t load"), false)
    ).toStrictEqual(expect.objectContaining({ label: "Could not load" }));
    expect(
      comparePublicStatus(missing("suppressed", "Suppressed"), false).label
    ).toBe("Suppressed");
    expect(
      comparePublicStatus(missing("unavailable", "Unavailable"), false).label
    ).toBe("Unavailable");
  });

  it("uses a 0–10 uninsured axis for the preview values and does not clip a larger value", () => {
    expect(uninsuredAxisMax([4.4, 5.5])).toBe(10);
    expect(uninsuredAxisMax([4.4, 4.4])).toBe(10);
    expect(uninsuredAxisMax([12, null])).toBe(20);
    expect(uninsuredAxisMax([100])).toBe(100);
    expect(uninsuredAxisMax([null, null])).toBe(10);
  });
});

describe("situation display mapping", () => {
  it("maps a current v1 class and leaves an unrecognized label unchanged", () => {
    const known = situationDisplay(
      perspective("class-0", "Established blacklegged tick", "situation-v1")
    );
    const unknown = situationDisplay(
      perspective("class-9", "Future group", "situation-v2")
    );
    expect({
      known: { label: known.label, mapped: known.mapped },
      unknown: { label: unknown.label, mapped: unknown.mapped },
      percents: [87.34, 12, 0.04, 0].map((value) =>
        membershipPercentText(value)
      ),
    }).toStrictEqual({
      known: {
        label: "Blacklegged tick records predominate",
        mapped: true,
      },
      unknown: { label: "Future group", mapped: false },
      percents: ["87.3%", "12%", "Less than 0.1%", "0%"],
    });
  });
});

function perspective(
  classId: string,
  className: string,
  version: string
): IntelligencePerspectiveView {
  return {
    description: className,
    disclosure: [{ label: "Model version", value: version }],
    fields: [
      { label: "Class", value: className },
      { label: "Class id", value: classId },
    ],
    fullValue: "0.873",
    id: "ecological-situation",
    kind: "ready",
    label: "Ecological Situation",
    limitations: [],
    memberships: [{ classId, percent: 87.3, selected: true, text: "87.3%" }],
    overview: "",
    primary: className,
    qualifier: null,
    reasons: [],
    reviewCategory: null,
    retryable: false,
    sufficiency: null,
    supporting: "",
    tier: null,
    track: null,
  };
}
