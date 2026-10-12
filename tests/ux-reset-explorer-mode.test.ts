import { describe, expect, it } from "vitest";

import {
  explorerFollowUpSelection,
  explorerFollowUpState,
} from "@/features/ux-reset/review/explorer-follow-up";
import {
  compareReturnHrefWithExplorerMode,
  EXPLORER_EVIDENCE_MODE as evidenceMode,
  EXPLORER_FOLLOW_UP_MODE as followUpMode,
  EXPLORER_MODE_PARAM as modeParam,
  hrefWithExplorerMode,
  resolveExplorerModeQuery,
} from "@/features/ux-reset/review/explorer-mode";
import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_FOLLOW_UP_MODE,
  EXPLORER_MODE_PARAM,
} from "@/features/ux-reset/workspace-route-migration";
import type { Candidate } from "@/generated/models";

import {
  buildStateReview,
  reviewCandidate,
} from "./fixtures/review-operating-picture-fixtures";

describe("explorer county mode", () => {
  it("uses the same mode tokens as the recorded route map", () => {
    expect(modeParam).toBe(EXPLORER_MODE_PARAM);
    expect(evidenceMode).toBe(EXPLORER_EVIDENCE_MODE);
    expect(followUpMode).toBe(EXPLORER_FOLLOW_UP_MODE);
  });

  it("accepts one exact evidence or follow-up token", () => {
    expect(resolveExplorerModeQuery([])).toStrictEqual({
      invalid: false,
      mode: null,
    });
    expect(resolveExplorerModeQuery(["evidence"])).toStrictEqual({
      invalid: false,
      mode: "evidence",
    });
    expect(resolveExplorerModeQuery(["follow-up"])).toStrictEqual({
      invalid: false,
      mode: "follow-up",
    });
  });

  it("rejects blank, unknown, cased, and repeated mode tokens", () => {
    expect(resolveExplorerModeQuery([""])).toStrictEqual({
      invalid: true,
      mode: null,
    });
    expect(resolveExplorerModeQuery(["Evidence"])).toStrictEqual({
      invalid: true,
      mode: null,
    });
    expect(resolveExplorerModeQuery(["tiles"])).toStrictEqual({
      invalid: true,
      mode: null,
    });
    expect(resolveExplorerModeQuery(["evidence", "follow-up"])).toStrictEqual({
      invalid: true,
      mode: null,
    });
    expect(resolveExplorerModeQuery(["evidence", "evidence"])).toStrictEqual({
      invalid: true,
      mode: null,
    });
  });

  it("appends mode without dropping the compare return target", () => {
    expect(
      hrefWithExplorerMode(
        "/app/compare?compare=08001&return=review&scope=CO",
        "follow-up"
      )
    ).toBe("/app/compare?compare=08001&return=review&scope=CO&mode=follow-up");
  });

  it("restores expanded review only for one exact mode on a review return", () => {
    const href = "/app/review?county=08001&scope=CO&dataset=alpha-2026";
    expect(
      compareReturnHrefWithExplorerMode({
        href,
        modeValues: ["evidence"],
        returnTarget: "review",
      })
    ).toBe(`${href}&mode=evidence`);
    expect(
      compareReturnHrefWithExplorerMode({
        href,
        modeValues: ["follow-up"],
        returnTarget: "investigate",
      })
    ).toBe(href);
    expect(
      compareReturnHrefWithExplorerMode({
        href,
        modeValues: ["score"],
        returnTarget: "review",
      })
    ).toBe(href);
    expect(
      compareReturnHrefWithExplorerMode({
        href: null,
        modeValues: ["evidence"],
        returnTarget: "review",
      })
    ).toBeNull();
  });
});

describe("explorer suggested follow-up", () => {
  const denver = reviewCandidate({
    caveat: "Collection dates are unavailable for this status.",
    countyName: "Denver",
    fips: "08001",
    nextCheck: "Review the cited source records.",
    reasonText: "Denver is included because the review method returned it.",
  });

  it("keeps the selected candidate's step, reason, and limitation", () => {
    expect(
      explorerFollowUpState({
        candidates: [denver],
        county: "08001",
        metadataFailed: false,
        review: "ready",
        withheld: false,
      })
    ).toStrictEqual({
      category: "PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW",
      firstStep: "Review the cited source records.",
      limitations: ["Collection dates are unavailable for this status."],
      rationale: "Denver is included because the review method returned it.",
      status: "candidate",
    });
  });

  it("does not invent a step for a factual county or a blank next check", () => {
    expect(
      explorerFollowUpState({
        candidates: [denver],
        county: "08013",
        metadataFailed: false,
        review: "ready",
        withheld: false,
      })
    ).toStrictEqual({ status: "factual" });
    const blank: Candidate = {
      ...denver,
      reason_text: "  ",
      suggested_next_check: " ",
    };
    expect(
      explorerFollowUpState({
        candidates: [blank],
        county: "08001",
        metadataFailed: false,
        review: "ready",
        withheld: false,
      })
    ).toMatchObject({
      firstStep: null,
      rationale: null,
      status: "candidate",
    });
  });

  it("keeps loading, failure, and out-of-scope distinct", () => {
    expect(
      explorerFollowUpState({
        candidates: null,
        county: "08001",
        metadataFailed: false,
        review: "loading",
        withheld: false,
      }).status
    ).toBe("loading");
    expect(
      explorerFollowUpState({
        candidates: [denver],
        county: "08001",
        metadataFailed: true,
        review: "loading",
        withheld: true,
      }).status
    ).toBe("request-failed");
    expect(
      explorerFollowUpState({
        candidates: null,
        county: "08001",
        metadataFailed: false,
        review: "unavailable",
        withheld: false,
      }).status
    ).toBe("not-in-scope");
    expect(
      explorerFollowUpState({
        candidates: [],
        county: "08001",
        metadataFailed: false,
        review: "error",
        withheld: false,
      }).status
    ).toBe("request-failed");
  });

  it("drops a withheld candidate instead of publishing its step", () => {
    expect(
      explorerFollowUpState({
        candidates: [denver],
        county: "08001",
        metadataFailed: false,
        review: "ready",
        withheld: true,
      })
    ).toStrictEqual({ status: "withheld" });
  });

  it("publishes a consistent candidate and withholds a contradictory payload", () => {
    const selection = (
      resultState:
        | "candidates_found"
        | "insufficient_evidence"
        | "none_stand_out"
        | "unsupported"
    ) =>
      explorerFollowUpSelection({
        review: buildStateReview({
          candidates: [denver],
          resultState,
          state: "CO",
        }),
        scopeCode: "CO",
      });
    expect(selection("candidates_found").withheld).toBeFalsy();
    expect(
      selection("candidates_found").candidates?.[0]?.suggested_next_check
    ).toBe("Review the cited source records.");
    expect(selection("unsupported")).toStrictEqual({
      candidates: [],
      withheld: true,
    });
    expect(selection("none_stand_out")).toStrictEqual({
      candidates: [],
      withheld: true,
    });
    expect(selection("insufficient_evidence")).toStrictEqual({
      candidates: [],
      withheld: true,
    });
  });
});
