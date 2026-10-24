import { describe, expect, it } from "vitest";

import {
  formatClassMembership,
  formatFullProbability,
  formatPercentileOneDecimal,
  formatPlainMembershipPercent,
} from "@/features/ux-reset/surveillance-intelligence/format-surveillance-intelligence";
import {
  GAP_SCORE_DESCRIPTOR,
  situationGroupCopy,
  SURVEILLANCE_INTELLIGENCE_GUIDE,
  SURVEILLANCE_INTELLIGENCE_LABELS,
  SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-copy";
import {
  classMembershipProbability,
  mapCountySurveillanceIntelligence,
  type GapScoreQueryState,
  type IntelligencePerspectiveView,
  type PublishedGapScoreSource,
  type SituationsQueryState,
  type Tier1QueryState,
} from "@/features/ux-reset/surveillance-intelligence/surveillance-intelligence-model";
import type { CountySurveillanceSituations } from "@/generated/models/countySurveillanceSituations";
import type { SituationClassification } from "@/generated/models/situationClassification";
import type { SituationVariant } from "@/generated/models/situationVariant";
import type { Tier1CountyPriority } from "@/generated/models/tier1CountyPriority";

import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
  tier1PriorityForCounty,
} from "./fixtures/tier1-surveillance-priority";

const PAGE_RELEASE = "governed-2026-10-15-january-climate-prod";
const TIER1_RELEASE = "governed-2026-09-18-unknown-coverage";
const SHA = "a".repeat(64);

function classification(input: {
  classId: string;
  className: string;
  modelId?: string;
  modelVersion: string;
  probabilities: SituationClassification["probabilities"];
}): SituationClassification {
  return {
    activated_at: "2026-10-15T00:00:00Z",
    batch_id: "batch",
    batch_version: "batch-v1",
    class_description: `${input.className} is a descriptive surveillance grouping.`,
    class_id: input.classId,
    class_name: input.className,
    county_sha256: SHA,
    data_authorization_id: "auth",
    data_publication_authorization: {},
    dictionary_sha256: SHA,
    feature_contract: {},
    fit_git_sha: "abc",
    handoff_approval: {},
    input_bundle_sha256: SHA,
    input_release_id: PAGE_RELEASE,
    limitations: ["Not disease risk.", "No records is not absence."],
    model_id: input.modelId ?? "model",
    model_provenance: {},
    model_version: input.modelVersion,
    probabilities: input.probabilities,
    source_provenance: {},
    staging_attempt: "1",
  };
}

function variant(
  availability: SituationVariant["availability"],
  data: SituationClassification | null,
  reason: SituationVariant["unavailable_reason"] = null,
  compatibility: SituationVariant["compatibility"] = "EXACT_INPUT"
): SituationVariant {
  return {
    availability,
    batch_id: data ? "batch" : null,
    batch_version: data ? "batch-v1" : null,
    compatibility,
    data,
    input_release_id: data ? PAGE_RELEASE : null,
    model_id: data?.model_id ?? "model",
    unavailable_reason: reason,
  };
}

function situations(
  four: SituationVariant,
  tick: SituationVariant
): CountySurveillanceSituations {
  return {
    bundle_sha256: SHA,
    county_fips: "01001",
    four_state: four,
    release_id: PAGE_RELEASE,
    tick_pathogen: tick,
  };
}

function scores(
  counties: PublishedGapScoreSource["counties"]
): PublishedGapScoreSource {
  return {
    counties,
    methodology_version: "semantic-2.0.0",
    release_id: PAGE_RELEASE,
  };
}

function readyGap(result: PublishedGapScoreSource | null): GapScoreQueryState {
  return {
    phase: "success",
    release: { releaseId: PAGE_RELEASE, status: "ready" },
    result,
  };
}

function readyTier(result: Tier1CountyPriority | null): Tier1QueryState {
  return {
    errorStatus: null,
    phase: "success",
    result,
  };
}

function readySituations(
  result: CountySurveillanceSituations | null
): SituationsQueryState {
  return {
    errorStatus: null,
    phase: "success",
    result,
  };
}

function mapped(input?: {
  gap?: GapScoreQueryState;
  situations?: SituationsQueryState;
  tier1?: Tier1QueryState;
}): IntelligencePerspectiveView[] {
  return mapCountySurveillanceIntelligence({
    fips: "01001",
    gapScore: input?.gap ?? readyGap(scores([])),
    situations: input?.situations ?? readySituations(null),
    tier1: input?.tier1 ?? readyTier(null),
  });
}

const fourClass = classification({
  classId: "surveillance-situation-four-state.v1.class-3",
  className: "Pathogen not recorded",
  modelId: "surveillance-situation-four-state",
  modelVersion: "v1",
  probabilities: [
    {
      class_id: "surveillance-situation-four-state.v1.class-0",
      probability: 0.12654161205345155,
    },
    {
      class_id: "surveillance-situation-four-state.v1.class-1",
      probability: 0,
    },
    {
      class_id: "surveillance-situation-four-state.v1.class-2",
      probability: 5.481617999014906e-238,
    },
    {
      class_id: "surveillance-situation-four-state.v1.class-3",
      probability: 0.8734583879465485,
    },
  ],
});

const tickClass = classification({
  classId: "surveillance-situation-tick-pathogen.v1.class-0",
  className: "Established blacklegged tick",
  modelId: "surveillance-situation-tick-pathogen",
  modelVersion: "v1",
  probabilities: [
    {
      class_id: "surveillance-situation-tick-pathogen.v1.class-0",
      probability: 0.9991722300466057,
    },
    {
      class_id: "surveillance-situation-tick-pathogen.v1.class-1",
      probability: 0.0008277699533944034,
    },
    {
      class_id: "surveillance-situation-tick-pathogen.v1.class-2",
      probability: 0,
    },
    {
      class_id: "surveillance-situation-tick-pathogen.v1.class-3",
      probability: 0,
    },
  ],
});

describe("County Surveillance Intelligence mapping", () => {
  it("orders the four labels and keeps the fixed guide", () => {
    const views = mapped({
      gap: readyGap(
        scores([
          {
            fips: "01001",
            in_contiguous_tick_scope: true,
            score: { score: 36.6 },
          },
        ])
      ),
      situations: readySituations(
        situations(
          variant("AVAILABLE", fourClass),
          variant("AVAILABLE", tickClass)
        )
      ),
      tier1: readyTier(
        tier1PriorityForCounty(tier1LowInsufficientFixture, "01001")
      ),
    });

    expect(views.map((view) => view.id)).toStrictEqual([
      ...SURVEILLANCE_INTELLIGENCE_PERSPECTIVE_ORDER,
    ]);
    expect(views.map((view) => view.label)).toStrictEqual([
      SURVEILLANCE_INTELLIGENCE_LABELS["gap-score"],
      SURVEILLANCE_INTELLIGENCE_LABELS["ml-review-priority"],
      SURVEILLANCE_INTELLIGENCE_LABELS["surveillance-situation"],
      SURVEILLANCE_INTELLIGENCE_LABELS["ecological-situation"],
    ]);
    expect(views[0]).toMatchObject({
      fullValue: "36.6",
      kind: "ready",
      primary: "36.6",
      supporting: GAP_SCORE_DESCRIPTOR,
    });
    expect(views[1]).toMatchObject({
      kind: "ready",
      primary: "LOW",
      supporting: "Percentile 30.7 · Evidence sufficiency Insufficient",
    });
    expect(views[1]?.disclosure.map((field) => field.value)).toContain(
      TIER1_RELEASE
    );
  });

  it("keeps score, percentile, and class membership on separate tracks", () => {
    const views = mapped({
      gap: readyGap(
        scores([
          {
            fips: "01001",
            in_contiguous_tick_scope: true,
            score: { score: 36.6 },
          },
        ])
      ),
      situations: readySituations(
        situations(
          variant("AVAILABLE", fourClass),
          variant("AVAILABLE", tickClass)
        )
      ),
      tier1: readyTier(
        tier1PriorityForCounty(tier1LowInsufficientFixture, "01001")
      ),
    });
    const selected = views[2]?.memberships.find(
      (membership) => membership.selected
    );
    const tiny = views[2]?.memberships.find(
      (membership) =>
        membership.classId === "surveillance-situation-four-state.v1.class-2"
    );
    expect({
      gapLabel: views[0]?.track?.label,
      gapValue: views[0]?.track?.value,
      percentile: views[1]?.track?.valueText,
      percentileLabel: views[1]?.track?.label,
      rawScoreLabel: views[1]?.disclosure.map((field) => field.label).join(" "),
      selectedClass: selected?.classId,
      sufficiency: views[1]?.sufficiency,
      tier: views[1]?.tier,
      tinyPercent: tiny?.percent,
    }).toStrictEqual({
      gapLabel: "Published Surveillance Gap Score 36.6 out of 100",
      gapValue: 36.6,
      percentile: "30.7",
      percentileLabel:
        "Within-batch percentile 30.7 out of 100. Not a disease risk probability.",
      rawScoreLabel: expect.stringContaining("not a probability"),
      selectedClass: "surveillance-situation-four-state.v1.class-3",
      sufficiency: "INSUFFICIENT",
      tier: "LOW",
      tinyPercent: null,
    });
  });

  it("formats situation membership and refuses a composite score", () => {
    const views = mapped({
      gap: readyGap(
        scores([
          {
            fips: "01001",
            in_contiguous_tick_scope: true,
            score: { score: 36.6 },
          },
        ])
      ),
      situations: readySituations(
        situations(
          variant("AVAILABLE", fourClass),
          variant("AVAILABLE", tickClass)
        )
      ),
      tier1: readyTier(
        tier1PriorityForCounty(tier1LowInsufficientFixture, "01001")
      ),
    });
    expect(views[2]).toMatchObject({
      kind: "ready",
      primary: "Pathogen not recorded",
      supporting: "Class membership 87.3%",
    });
    expect(views[2]?.fullValue).toBe("0.8734583879465485");
    expect(views[3]).toMatchObject({
      kind: "ready",
      primary: "Blacklegged tick records predominate",
      supporting: "Class membership 99.9%",
    });
    expect(SURVEILLANCE_INTELLIGENCE_GUIDE).toContain(
      "These results answer different questions and may differ."
    );
    expect(JSON.stringify(views)).not.toMatch(
      /composite|overall score|models agree/i
    );
  });

  it("keeps a published zero distinct from an unavailable score", () => {
    const zero = mapped({
      gap: readyGap(
        scores([
          {
            fips: "01001",
            in_contiguous_tick_scope: true,
            score: { score: 0 },
          },
        ])
      ),
    })[0];
    const missing = mapped({
      gap: readyGap(scores([])),
    })[0];
    const outsideScope = mapped({
      gap: readyGap(
        scores([
          {
            fips: "01001",
            in_contiguous_tick_scope: false,
            score: { score: 23.3 },
          },
        ])
      ),
    })[0];

    expect(zero).toMatchObject({ kind: "ready", primary: "0.0" });
    expect(missing).toMatchObject({
      kind: "unavailable",
      primary: "Unavailable",
    });
    expect(outsideScope?.primary).toBe("Unavailable");
    expect(JSON.stringify(outsideScope)).not.toContain("23.3");
    expect(outsideScope?.overview).toContain("not a score of zero");
  });

  it("shows LOW and INSUFFICIENT independently", () => {
    const priority = mapped({
      tier1: readyTier(
        tier1PriorityForCounty(tier1LowInsufficientFixture, "01001")
      ),
    })[1];
    expect(priority?.primary).toBe("LOW");
    expect(priority?.supporting).toContain("Evidence sufficiency Insufficient");
    expect(priority?.supporting).not.toContain("Sufficient confidence");
    expect(priority?.qualifier).toContain("not a disease risk probability");
    expect(
      priority?.fields.map((field) => field.value).join(" ")
    ).not.toContain(String(tier1LowInsufficientFixture.raw_model_score));
  });

  it("keeps one latent-class model available when the other is not", () => {
    const unpublished = variant(
      "UNAVAILABLE",
      null,
      "NOT_PUBLISHED",
      "UNAVAILABLE"
    );
    const incompatible = variant(
      "UNAVAILABLE",
      null,
      "INCOMPATIBLE_RELEASE",
      "UNAVAILABLE"
    );
    const fourMissing = mapped({
      situations: readySituations(
        situations(unpublished, variant("AVAILABLE", tickClass))
      ),
    });
    const tickMissing = mapped({
      situations: readySituations(
        situations(variant("AVAILABLE", fourClass), incompatible)
      ),
    });

    expect(fourMissing[2]).toMatchObject({
      kind: "unavailable",
      supporting: "Not published",
    });
    expect(fourMissing[3]?.kind).toBe("ready");
    expect(tickMissing[2]?.kind).toBe("ready");
    expect(tickMissing[3]).toMatchObject({
      kind: "incompatible",
      primary: "Incompatible",
    });
    expect(tickMissing[3]?.primary).not.toBe(tickMissing[2]?.primary);
  });

  it("reads class membership from the matching class id", () => {
    const membership = classMembershipProbability(
      fourClass.probabilities,
      fourClass.class_id
    );
    expect(membership).toBe(0.8734583879465485);
    expect(
      classMembershipProbability(fourClass.probabilities, "missing")
    ).toBeNull();
    expect(formatClassMembership(0.8734583879465485)).toBe("87.3%");
  });

  it("rounds percentile to one decimal and keeps a real zero probability", () => {
    expect(formatFullProbability(5.481617999014906e-238)).toContain("e");
    expect(formatClassMembership(5.481617999014906e-238)).toContain(
      "0–1 scale"
    );
    expect(formatClassMembership(0)).toBe("0.0%");
    expect(formatPercentileOneDecimal(30.734966592427615)).toBe("30.7");
    expect(formatPercentileOneDecimal(0)).toBe("0.0");
  });

  it("shows situation classes when the response release differs from the page release", () => {
    const responseRelease = "governed-2026-10-16-next";
    const body = situations(
      variant("AVAILABLE", fourClass),
      variant("AVAILABLE", tickClass)
    );
    body.release_id = responseRelease;
    const views = mapped({
      situations: readySituations(body),
    });

    expect(views[2]).toMatchObject({
      disclosure: expect.arrayContaining([
        { label: "Presentation release", value: responseRelease },
      ]),
      kind: "ready",
      primary: "Pathogen not recorded",
    });
    expect(views[3]).toMatchObject({
      kind: "ready",
      primary: "Blacklegged tick records predominate",
    });
    expect(JSON.stringify([views[2], views[3]])).not.toContain(
      "Not shown for this page release"
    );
  });

  it("keeps presentation release, admitted input release, and source provenance distinct", () => {
    const inputRelease = "governed-2026-09-18-unknown-coverage";
    const classified = {
      ...fourClass,
      input_release_id: inputRelease,
      source_provenance: {
        human: {
          dataset_id: "x5j9-wybp",
          source_id: "cdc_lyme",
          vintage: "2023",
        },
        tick: {
          source_id: "cdc_arbonet_tick_module",
          vintage: "through 2025-12-31",
        },
      },
    };
    const admitted = variant(
      "AVAILABLE",
      classified,
      null,
      "ADMITTED_CARRY_FORWARD"
    );
    admitted.input_release_id = inputRelease;
    const views = mapped({
      situations: readySituations(
        situations(admitted, variant("AVAILABLE", tickClass))
      ),
    });
    const disclosure = views[2]?.disclosure ?? [];

    expect(views[2]).toMatchObject({
      kind: "ready",
      primary: "Pathogen not recorded",
    });
    expect(disclosure).toStrictEqual(
      expect.arrayContaining([
        { label: "Presentation release", value: PAGE_RELEASE },
        {
          label: "Compatibility with presentation release",
          value: "Admitted carry forward",
        },
        { label: "Input release", value: inputRelease },
        {
          label: "Source human",
          value: "cdc_lyme · x5j9-wybp · vintage 2023",
        },
        {
          label: "Source tick",
          value: "cdc_arbonet_tick_module · vintage through 2025-12-31",
        },
      ])
    );
    expect(
      disclosure.find((field) => field.label === "Presentation release")?.value
    ).not.toBe(inputRelease);
    expect(views[2]?.overview).not.toContain("did not match this page release");
  });

  it("shows a matched county tier when its release differs from the page", () => {
    const priority = mapped({
      tier1: readyTier(
        tier1PriorityForCounty(tier1HighSufficientFixture, "01001")
      ),
    })[1];

    expect(priority).toMatchObject({
      disclosure: expect.arrayContaining([
        {
          label: "Model input release",
          value: tier1HighSufficientFixture.release_id,
        },
      ]),
      kind: "ready",
      primary: "HIGH",
      sufficiency: "SUFFICIENT",
      supporting: "Percentile 98.6 · Evidence sufficiency Sufficient",
    });
    expect(JSON.stringify(priority)).not.toContain(
      "Not shown for this page release"
    );
    expect(priority?.tier).toBe("HIGH");
  });

  it("shows a returned tier when the page release is not part of the query state", () => {
    const priority = mapped({
      tier1: readyTier(
        tier1PriorityForCounty(tier1HighSufficientFixture, "01001")
      ),
    })[1];

    expect(priority?.kind).toBe("ready");
    expect(priority?.primary).toBe("HIGH");
    expect(priority?.overview).not.toContain(
      "governed release for this page is not known"
    );
  });

  it("does not invent a score when a model request fails", () => {
    const views = mapped({
      gap: {
        phase: "error",
        release: { releaseId: PAGE_RELEASE, status: "ready" },
        result: null,
      },
      situations: {
        errorStatus: 503,
        phase: "error",
        result: null,
      },
      tier1: {
        errorStatus: 404,
        phase: "error",
        result: null,
      },
    });
    expect({
      gap: views[0],
      priority: views[1],
      surveillance: views[2],
      tick: views[3],
    }).toMatchObject({
      gap: {
        kind: "error",
        primary: expect.not.stringMatching(/^0\.0$/),
        retryable: true,
      },
      priority: { kind: "unavailable", retryable: false },
      surveillance: {
        kind: "error",
        overview: "The model result could not be loaded.",
        primary: "Could not be loaded",
        retryable: true,
      },
      tick: { kind: "error", retryable: true },
    });
  });

  it("keeps an unrecognized model version on its reviewed label", () => {
    const future = classification({
      classId: "surveillance-situation-four-state.v2.class-0",
      className: "Established blacklegged tick",
      modelId: "surveillance-situation-four-state",
      modelVersion: "v2",
      probabilities: fourClass.probabilities.map((entry) => ({
        ...entry,
        class_id: entry.class_id.replace(".v1.", ".v2."),
      })),
    });
    const view = mapped({
      situations: readySituations(
        situations(
          variant("AVAILABLE", future),
          variant("AVAILABLE", tickClass)
        )
      ),
    })[2];
    expect({
      meaning: view?.situationPlain?.groupMeaning,
      memberships: view?.situationPlain?.memberships,
      overview: view?.overview,
      primary: view?.primary,
      reviewed: view?.fields.map((field) => field.value).join(" "),
    }).toStrictEqual({
      meaning: future.class_description,
      memberships: null,
      overview:
        "This page does not have a plain-language description for this model version. The reviewed group label is shown unchanged.",
      primary: "Established blacklegged tick",
      reviewed: expect.stringContaining("Established blacklegged tick"),
    });
  });

  it("uses the reviewed v1 explanation for every current group", () => {
    const cases = [
      [
        "surveillance-situation-four-state",
        "class-0",
        "Blacklegged tick records predominate",
      ],
      [
        "surveillance-situation-four-state",
        "class-1",
        "Tick and pathogen status unknown",
      ],
      [
        "surveillance-situation-four-state",
        "class-2",
        "Western blacklegged tick records predominate",
      ],
      ["surveillance-situation-four-state", "class-3", "Pathogen not recorded"],
      [
        "surveillance-situation-tick-pathogen",
        "class-0",
        "Blacklegged tick records predominate",
      ],
      [
        "surveillance-situation-tick-pathogen",
        "class-1",
        "Limited tick and pathogen records",
      ],
      [
        "surveillance-situation-tick-pathogen",
        "class-2",
        "Established western blacklegged tick pattern",
      ],
      [
        "surveillance-situation-tick-pathogen",
        "class-3",
        "Tick and pathogen status unknown",
      ],
    ] as const;
    expect({
      copied: cases.map(([modelId, classSuffix, label]) => {
        const copy = situationGroupCopy(
          modelId,
          "v1",
          `${modelId}.v1.${classSuffix}`
        );
        return {
          label: copy?.label,
          meaning: (copy?.meaning.length ?? 0) > 0,
          requested: label,
        };
      }),
      crossed: situationGroupCopy(
        "surveillance-situation-four-state",
        "v1",
        "surveillance-situation-tick-pathogen.v1.class-0"
      ),
      distinct:
        situationGroupCopy(
          "surveillance-situation-four-state",
          "v1",
          "surveillance-situation-four-state.v1.class-0"
        )?.meaning ===
        situationGroupCopy(
          "surveillance-situation-tick-pathogen",
          "v1",
          "surveillance-situation-tick-pathogen.v1.class-0"
        )?.meaning,
    }).toStrictEqual({
      copied: cases.map((entry) => ({
        label: entry[2],
        meaning: true,
        requested: entry[2],
      })),
      crossed: null,
      distinct: false,
    });
  });

  it("names the screenshot county groups without changing the probabilities", () => {
    const view = mapped({
      situations: readySituations(
        situations(
          variant("AVAILABLE", fourClass),
          variant("AVAILABLE", tickClass)
        )
      ),
    })[2];
    expect({
      fullValue: view?.fullValue,
      methods: view?.situationPlain?.methods,
      rows: view?.situationPlain?.memberships?.map((row) => ({
        assigned: row.assigned,
        label: row.label,
        text: row.text,
      })),
      technical: JSON.stringify(view?.fields),
    }).toStrictEqual({
      fullValue: "0.8734583879465485",
      methods: [
        "Model results use the same data release as this page.",
        "Data release used: October 15, 2026.",
      ],
      rows: [
        { assigned: true, label: "Pathogen not recorded", text: "87.3%" },
        {
          assigned: false,
          label: "Blacklegged tick records predominate",
          text: "12.7%",
        },
        {
          assigned: false,
          label: "Western blacklegged tick records predominate",
          text: "Less than 0.1%",
        },
        {
          assigned: false,
          label: "Tick and pathogen status unknown",
          text: "0%",
        },
      ],
      technical: expect.stringContaining("5.481617999014906e-238"),
    });
  });

  it("formats plain membership without scientific notation", () => {
    expect({
      exact: formatPlainMembershipPercent(1),
      nearOne: formatPlainMembershipPercent(0.999961073640964),
      ordinary: formatPlainMembershipPercent(0.8734583879465485),
      tiny: formatPlainMembershipPercent(5.481617999014906e-238),
      whole: formatPlainMembershipPercent(0.2),
      zero: formatPlainMembershipPercent(0),
    }).toStrictEqual({
      exact: "100%",
      nearOne: "Less than 100%",
      ordinary: "87.3%",
      tiny: "Less than 0.1%",
      whole: "20%",
      zero: "0%",
    });
  });

  it("states unavailable, incompatible, and carry-forward results in plain language", () => {
    const unpublished = variant(
      "UNAVAILABLE",
      null,
      "NOT_PUBLISHED",
      "UNAVAILABLE"
    );
    const withdrawn = variant(
      "UNAVAILABLE",
      null,
      "DEACTIVATED",
      "UNAVAILABLE"
    );
    const unapproved = variant(
      "UNAVAILABLE",
      null,
      "UNAPPROVED_BATCH",
      "UNAVAILABLE"
    );
    const missing = variant(
      "UNAVAILABLE",
      null,
      "MISSING_ASSIGNMENT",
      "UNAVAILABLE"
    );
    const incompatible = variant(
      "UNAVAILABLE",
      null,
      "INCOMPATIBLE_RELEASE",
      "UNAVAILABLE"
    );
    const admitted = variant(
      "AVAILABLE",
      {
        ...fourClass,
        input_release_id: "governed-2026-09-18-unknown-coverage",
      },
      null,
      "ADMITTED_CARRY_FORWARD"
    );
    admitted.input_release_id = "governed-2026-09-18-unknown-coverage";
    const views = mapped({
      situations: readySituations(situations(unpublished, withdrawn)),
    });
    const other = mapped({
      situations: readySituations(situations(unapproved, missing)),
    });
    const blocked = mapped({
      situations: readySituations(
        situations(variant("AVAILABLE", fourClass), incompatible)
      ),
    })[3];
    expect({
      blocked: {
        kind: blocked?.kind,
        overview: blocked?.overview,
        primary: blocked?.primary,
      },
      carryForward: mapped({
        situations: readySituations(
          situations(admitted, variant("AVAILABLE", tickClass))
        ),
      })[2]?.situationPlain?.methods,
      loading: mapped({
        situations: { errorStatus: null, phase: "loading", result: null },
      })[2]?.overview,
      missing: other[3]?.overview,
      unapproved: other[2]?.overview,
      unpublished: {
        kind: views[2]?.kind,
        overview: views[2]?.overview,
        primary: views[2]?.primary,
      },
      unverified: mapped({
        situations: {
          errorStatus: null,
          phase: "error",
          result: null,
          unverified: true,
        },
      })[3]?.overview,
      withdrawn: views[3]?.overview,
    }).toStrictEqual({
      blocked: {
        kind: "incompatible",
        overview:
          "This model result cannot be shown with the data release used by this page.",
        primary: "Incompatible",
      },
      carryForward: [
        "These model results were produced using an earlier data release and approved for use with this page’s release.",
        "Data release used by the model: September 18, 2026.",
      ],
      loading: "Loading model result…",
      missing: "No group assignment is available.",
      unapproved: "Publication of this result is not approved.",
      unpublished: {
        kind: "unavailable",
        overview: "This result is not published.",
        primary: "Unavailable",
      },
      unverified: "The model response could not be verified.",
      withdrawn: "This result was withdrawn.",
    });
  });
});
