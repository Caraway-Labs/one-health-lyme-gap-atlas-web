import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AtlasApiError } from "../src/lib/api-mutator";

const {
  submitFeedback,
  getSession,
  trackOpened,
  trackSubmitted,
  trackOutcome,
} = vi.hoisted(() => ({
  submitFeedback: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getSession: vi.fn<() => Promise<{ data: { session: unknown } }>>(),
  trackOpened: vi.fn<(topic: string) => void>(),
  trackSubmitted: vi.fn<(topic: string, outcome: string) => void>(),
  trackOutcome: vi.fn<(outcome: string) => void>(),
}));

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => "/geographic_explorer",
}));

vi.mock(import("../src/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: { getSession },
  }),
}));

vi.mock(import("../src/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitFeedbackV1FeedbackPost: submitFeedback as never,
  };
});

vi.mock(import("../src/lib/atlas-analytics"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    trackFeedbackOpened: trackOpened,
    trackFeedbackSubmitted: trackSubmitted,
    trackFeedbackOutcomeViewed: trackOutcome,
  };
});

import {
  FeedbackProvider,
  FeedbackTrigger,
} from "../src/components/feedback-dialog";
import { buildFeedbackContext } from "../src/lib/feedback-context";

function renderFeedback() {
  return render(
    <NuqsTestingAdapter searchParams="?state=CO&county=08001&q=secret-search&view=maps&metric=score">
      <FeedbackProvider>
        <FeedbackTrigger label="Feedback" />
        <FeedbackTrigger
          category="data_issue"
          controlId="feedback_report_data_issue"
          label="Report a data issue"
        />
      </FeedbackProvider>
    </NuqsTestingAdapter>
  );
}

describe("feedback dialog", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
    submitFeedback.mockReset();
    trackOpened.mockReset();
    trackSubmitted.mockReset();
    trackOutcome.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("builds context from nuqs state and omits q", () => {
    const context = buildFeedbackContext({
      pathname: "/geographic_explorer",
      state: "CO",
      county: "08001",
      dataset: "alpha-2026-08-06",
      evidence: "all",
      view: "maps",
      metric: "score",
      eco: 65,
      breakpoint: 10,
      missing: 75,
      selected: ["08001", "06037"],
    });

    expect(context).toMatchObject({
      state: "CO",
      county_fips: "08001",
      dataset: "alpha-2026-08-06",
      evidence_view: "all",
      explorer_view: "maps",
      explorer_metric: "score",
      selected_county_fips: ["08001", "06037"],
    });
    expect(JSON.stringify(context)).not.toContain("secret");
    expect(context).not.toHaveProperty("q");
  });

  it("omits geography context on privacy routes", () => {
    expect(
      buildFeedbackContext({
        pathname: "/privacy",
        state: "CO",
        county: "08001",
      })
    ).toBeNull();
  });

  it("shows signed-in disclosure without prefilling email", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
    renderFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));

    await waitFor(() =>
      expect(screen.getByText(/linked to your Atlas account/i)).toBeTruthy()
    );
    expect(
      (screen.getByLabelText(/Contact email/i) as HTMLInputElement).value
    ).toBe("");
    expect(trackOpened).toHaveBeenCalledWith("general");
  });

  it("presets data_issue from the explorer entry point", () => {
    renderFeedback();
    fireEvent.click(
      screen.getByRole("button", { name: "Report a data issue" })
    );
    expect(trackOpened).toHaveBeenCalledWith("data_issue");
  });

  it("keeps typed text on validation errors and does not call the API", async () => {
    renderFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    fireEvent.change(screen.getByLabelText(/^Message/), {
      target: { value: "too short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    const validationAlert = await screen.findByRole("alert");
    expect(validationAlert.textContent).toContain("at least 10 characters");
    expect(
      (screen.getByLabelText(/^Message/) as HTMLTextAreaElement).value
    ).toBe("too short");
    expect(submitFeedback).not.toHaveBeenCalled();
    expect(trackOutcome).toHaveBeenCalledWith("validation_error");
  });

  it("submits once on duplicate click and shows a copyable feedback id", async () => {
    const deferred = Promise.withResolvers<unknown>();
    submitFeedback.mockReturnValue(deferred.promise);
    renderFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    fireEvent.change(screen.getByLabelText(/^Message/), {
      target: { value: "County completeness looks wrong for Adams." },
    });

    const send = screen.getByRole("button", { name: "Send feedback" });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(submitFeedback).toHaveBeenCalledOnce();

    deferred.resolve({
      status: 200,
      data: {
        feedback_id: "11111111-1111-4111-8111-111111111111",
        received_at: "2026-09-26T18:00:00Z",
        replayed: false,
      },
      headers: new Headers(),
    });

    const successStatus = await screen.findByRole("status");
    expect(successStatus.textContent).toContain("Thanks");
    expect(
      (screen.getByLabelText("Feedback reference id") as HTMLInputElement).value
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(trackSubmitted).toHaveBeenCalledWith("general", "success");
    expect(trackOutcome).toHaveBeenCalledWith("success");
  });

  it("keeps the draft on a 409 conflict", async () => {
    submitFeedback.mockRejectedValueOnce(
      new AtlasApiError("conflict", "/v1/feedback", 409, "req-1")
    );
    renderFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    fireEvent.change(screen.getByLabelText(/^Message/), {
      target: { value: "County completeness looks wrong for Adams." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await expect(
      screen.findByRole("button", { name: "Submit as a new report" })
    ).resolves.toBeTruthy();
    expect(
      (screen.getByLabelText(/^Message/) as HTMLTextAreaElement).value
    ).toBe("County completeness looks wrong for Adams.");
  });

  it("resubmits a 409 as a new report and shows the new reference id", async () => {
    submitFeedback
      .mockRejectedValueOnce(
        new AtlasApiError("conflict", "/v1/feedback", 409, "req-1")
      )
      .mockResolvedValueOnce({
        status: 200,
        data: {
          feedback_id: "22222222-2222-4222-8222-222222222222",
          received_at: "2026-09-26T18:01:00Z",
          replayed: false,
        },
        headers: new Headers(),
      });
    renderFeedback();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    fireEvent.change(screen.getByLabelText(/^Message/), {
      target: { value: "County completeness looks wrong for Adams." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit as a new report" })
    );

    const successStatus = await screen.findByRole("status");
    expect(successStatus.textContent).toContain("Thanks");
    expect(
      (screen.getByLabelText("Feedback reference id") as HTMLInputElement).value
    ).toBe("22222222-2222-4222-8222-222222222222");
    expect(submitFeedback).toHaveBeenCalledTimes(2);
    const firstBody = submitFeedback.mock.calls[0]?.[0] as unknown as {
      submission_token: string;
      message: string;
    };
    const secondBody = submitFeedback.mock.calls[1]?.[0] as unknown as {
      submission_token: string;
      message: string;
    };
    expect(secondBody.submission_token).not.toBe(firstBody.submission_token);
    expect(secondBody.message).toBe(firstBody.message);
  });
});
