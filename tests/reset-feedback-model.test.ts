import { describe, expect, it } from "vitest";

import {
  buildResetFeedbackContext,
  buildResetFeedbackSubmission,
  classifyFeedbackHttpStatus,
  shouldKeepRetrySnapshot,
  createEmptyResetFeedbackDrafts,
  RESET_FEEDBACK_CATEGORIES,
  resetFeedbackDraftHasContent,
  resetFeedbackPage,
  serverFeedbackId,
  type ResetFeedbackDrafts,
} from "@/features/ux-reset/feedback/reset-feedback-model";
import { FeedbackSubmissionRequestCategory } from "@/generated/models";

const TOKEN = "11111111-1111-4111-8111-111111111111";

function drafts(
  patch: Partial<{
    dataset: Partial<ResetFeedbackDrafts["dataset"]>;
    expand: Partial<ResetFeedbackDrafts["expand"]>;
    idea: Partial<ResetFeedbackDrafts["idea"]>;
    problem: Partial<ResetFeedbackDrafts["problem"]>;
  }> = {}
): ResetFeedbackDrafts {
  const empty = createEmptyResetFeedbackDrafts();
  return {
    dataset: { ...empty.dataset, ...patch.dataset },
    expand: { ...empty.expand, ...patch.expand },
    idea: { ...empty.idea, ...patch.idea },
    problem: { ...empty.problem, ...patch.problem },
  };
}

function acceptedSubmission(
  result: ReturnType<typeof buildResetFeedbackSubmission>
): {
  category: string | null;
  contact: string | null;
  context: unknown;
  message: string;
  ok: boolean;
  routeId: string | null;
} {
  if (!result.ok) {
    return {
      category: null,
      contact: null,
      context: null,
      message: "",
      ok: false,
      routeId: null,
    };
  }
  return {
    category: result.request.category,
    contact: result.request.contact_email ?? null,
    context: result.request.context,
    message: result.request.message,
    ok: true,
    routeId: result.request.route_id,
  };
}

describe("reset feedback model", () => {
  it("lists the four categories in positive-first order", () => {
    expect(
      RESET_FEEDBACK_CATEGORIES.map((category) => category.label)
    ).toStrictEqual([
      "Suggest a dataset",
      "Share an idea",
      "Expand One Health Atlas",
      "Report a problem",
    ]);
  });

  it("maps reset pages onto the closed route enum and an allowlisted label", () => {
    expect(resetFeedbackPage("/explore")).toMatchObject({
      includeGeography: true,
      pageLabel: "Atlas Explorer",
      routeId: "overview",
    });
    expect(resetFeedbackPage("/app/explore")).toMatchObject({
      pageLabel: "Explore",
      routeId: "geographic_explorer",
    });
    expect(resetFeedbackPage("/askatlas")).toMatchObject({
      pageLabel: "Ask Atlas",
      routeId: "assistant",
    });
    expect(resetFeedbackPage("/app/settings?county=08031")).toMatchObject({
      includeGeography: false,
      pageLabel: "Settings",
      routeId: "account",
    });
  });

  it("keeps allowlisted geography and drops search text, period, Alaska, and Hawaii", () => {
    const context = buildResetFeedbackContext(
      "/explore",
      new URLSearchParams(
        "scope=CO&county=08031&compare=08031,08001&dataset=rel-2026&period=2024-01-01&q=secret-search&conversation=private"
      )
    );
    const serialized = JSON.stringify(context);

    expect({
      alaska: buildResetFeedbackContext(
        "/app/investigate",
        new URLSearchParams("scope=AK&county=02020&compare=15003")
      ),
      dc: buildResetFeedbackContext(
        "/explore",
        new URLSearchParams("scope=DC&county=11001")
      ),
      review: context,
      secrets: ["secret-search", "2024-01-01", "private"].filter((token) =>
        serialized.includes(token)
      ),
      settings: buildResetFeedbackContext(
        "/app/settings",
        new URLSearchParams("county=08031")
      ),
    }).toStrictEqual({
      alaska: null,
      dc: { county_fips: "11001", state: "DC" },
      review: {
        compare_county_fips: "08001",
        county_fips: "08031",
        dataset: "rel-2026",
        selected_county_fips: ["08031", "08001"],
        state: "CO",
      },
      secrets: [],
      settings: null,
    });
  });

  it("accepts a dataset name without a URL and keeps optional coverage in the message", () => {
    const result = buildResetFeedbackSubmission({
      category: "dataset",
      drafts: drafts({
        dataset: {
          frequency: "Yearly",
          geography: "Colorado",
          notes: "Public CSV",
          reference: "CDC tick file",
          source: "CDC",
          usefulness: "It fills a county gap for this release.",
        },
      }),
      pathname: "/explore",
      searchParams: new URLSearchParams("scope=CO&county=08031"),
      submissionToken: TOKEN,
    });

    expect(acceptedSubmission(result)).toMatchObject({
      category: FeedbackSubmissionRequestCategory.general,
      contact: null,
      context: { county_fips: "08031" },
      message: expect.stringMatching(
        /Product category: Suggest a dataset[\s\S]*Page: Atlas Explorer[\s\S]*Dataset: CDC tick file[\s\S]*Source or publisher: CDC[\s\S]*Geographic coverage: Colorado/
      ),
      ok: true,
    });
  });

  it("rejects unsafe dataset URLs and Alaska or Hawaii coverage", () => {
    const scriptUrl = ["java", "script", ":alert(1)"].join("");
    const rejected = (reference: string, geography = "") =>
      buildResetFeedbackSubmission({
        category: "dataset",
        drafts: drafts({
          dataset: {
            geography,
            reference,
            usefulness: "It fills a county gap for this release.",
          },
        }),
        pathname: "/explore",
        searchParams: new URLSearchParams(),
        submissionToken: TOKEN,
      }).ok;
    const plains = buildResetFeedbackSubmission({
      category: "dataset",
      drafts: drafts({
        dataset: {
          geography: "High plains of Colorado",
          reference: "www.example.com/ticks.csv",
          usefulness: "It fills a county gap for this release.",
        },
      }),
      pathname: "/explore",
      searchParams: new URLSearchParams(),
      submissionToken: TOKEN,
    });

    expect({
      alaska: rejected("https://example.com/ticks.csv", "Alaska and Hawaii"),
      credentials: rejected("https://user:pass@example.com/ticks.csv"),
      plains: acceptedSubmission(plains).message,
      script: rejected(scriptUrl),
    }).toStrictEqual({
      alaska: false,
      credentials: false,
      plains: expect.stringMatching(
        /Dataset: www\.example\.com\/ticks\.csv[\s\S]*High plains of Colorado/
      ),
      script: false,
    });
  });

  it("stores an email and refuses a name or organization", () => {
    const named = buildResetFeedbackSubmission({
      category: "dataset",
      drafts: drafts({
        dataset: {
          contact: "Ada Lovelace, CDC",
          reference: "CDC tick file",
          usefulness: "It fills a county gap for this release.",
        },
      }),
      pathname: "/explore",
      searchParams: new URLSearchParams(),
      submissionToken: TOKEN,
    });
    const emailed = buildResetFeedbackSubmission({
      category: "idea",
      drafts: drafts({
        idea: {
          contact: "ada@example.com",
          improvement: "Let me save a county comparison.",
          outcome: "I could return to the same pair later.",
        },
      }),
      pathname: "/compare",
      searchParams: new URLSearchParams(),
      submissionToken: TOKEN,
    });
    const accepted = acceptedSubmission(emailed);

    expect({
      category: accepted.category,
      contact: accepted.contact,
      emailInMessage: accepted.message.includes("ada@example.com"),
      named: named.ok,
      product: accepted.message,
    }).toMatchObject({
      category: "feature_idea",
      contact: "ada@example.com",
      emailInMessage: false,
      named: false,
      product: expect.stringContaining("Product category: Share an idea"),
    });
  });

  it("maps expansion and problem reports without implying support", () => {
    const expansion = acceptedSubmission(
      buildResetFeedbackSubmission({
        category: "expand",
        drafts: drafts({
          expand: {
            outcome: "County follow-up needs a wider pathogen view.",
            sourceUrl: "https://example.com/anaplasmosis",
            topic: "Anaplasmosis in the same counties",
          },
        }),
        pathname: "/app/investigate",
        searchParams: new URLSearchParams("q=secret-question"),
        submissionToken: TOKEN,
      })
    );
    const problem = acceptedSubmission(
      buildResetFeedbackSubmission({
        category: "problem",
        drafts: drafts({
          problem: {
            expected: "The county total should match the table.",
            happened: "The map count disagrees with the table.",
            kind: "data_issue",
          },
        }),
        pathname: "/app/explore",
        searchParams: new URLSearchParams(),
        submissionToken: TOKEN,
      })
    );

    expect({
      expansionCategory: expansion.category,
      expansionMessage: expansion.message,
      problemCategory: problem.category,
      problemRoute: problem.routeId,
      secret: JSON.stringify({
        context: expansion.context,
        message: expansion.message,
      }).includes("secret-question"),
      supported: expansion.message.toLowerCase().includes("already includes"),
    }).toMatchObject({
      expansionCategory: "feature_idea",
      expansionMessage: expect.stringMatching(
        /Product category: Expand One Health Atlas[\s\S]*Public source: https:\/\/example.com\/anaplasmosis/
      ),
      problemCategory: "data_issue",
      problemRoute: "geographic_explorer",
      secret: false,
      supported: false,
    });
  });

  it("treats typed fields as a draft and only accepts a server uuid", () => {
    expect({
      empty: resetFeedbackDraftHasContent(createEmptyResetFeedbackDrafts()),
      kind: resetFeedbackDraftHasContent(drafts({ problem: { kind: "bug" } })),
      malformed: serverFeedbackId("not-a-real-id"),
      uuid: serverFeedbackId(` ${TOKEN} `),
    }).toStrictEqual({
      empty: false,
      kind: true,
      malformed: null,
      uuid: TOKEN,
    });
  });

  it("classifies retry, auth, conflict, and outage responses", () => {
    expect({
      conflict: classifyFeedbackHttpStatus(409, null).kind,
      fallback: classifyFeedbackHttpStatus(429, null).retryAfterSeconds,
      lostResponse: shouldKeepRetrySnapshot(0),
      offline: classifyFeedbackHttpStatus(0, null).message,
      outage: classifyFeedbackHttpStatus(503, null).kind,
      rejected: shouldKeepRetrySnapshot(422),
      serverOutage: shouldKeepRetrySnapshot(503),
      throttledSnapshot: shouldKeepRetrySnapshot(429),
      throttled: classifyFeedbackHttpStatus(429, 30),
      unauthorized: classifyFeedbackHttpStatus(401, null).kind,
    }).toMatchObject({
      conflict: "conflict",
      fallback: 60,
      lostResponse: true,
      offline: expect.stringContaining("draft is kept"),
      outage: "unavailable",
      rejected: false,
      serverOutage: true,
      throttledSnapshot: true,
      throttled: { kind: "throttled", retryAfterSeconds: 30 },
      unauthorized: "unauthorized",
    });
  });
});
