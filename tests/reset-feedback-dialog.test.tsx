import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { AtlasApiError } from "@/lib/api-mutator";

const {
  getSession,
  pathname,
  searchParams,
  submitFeedback,
  trackOpened,
  trackOutcome,
  trackSubmitted,
} = vi.hoisted(() => ({
  getSession: vi.fn<() => Promise<{ data: { session: unknown } }>>(),
  pathname: { current: "/app/review" },
  searchParams: {
    current: new URLSearchParams(
      "scope=CO&county=08031&q=secret-search&period=2024-01-01"
    ),
  },
  submitFeedback: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  trackOpened: vi.fn<(topic: string) => void>(),
  trackOutcome: vi.fn<(outcome: string) => void>(),
  trackSubmitted: vi.fn<(topic: string, outcome: string) => void>(),
}));

vi.mock(import("next/navigation"), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => pathname.current,
  useSearchParams: () =>
    searchParams.current as unknown as ReadonlyURLSearchParams,
}));

vi.mock(import("@/lib/supabase/client"), () => ({
  createClient: () => ({
    auth: { getSession },
  }),
}));

vi.mock(import("@/generated/atlas"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitFeedbackV1FeedbackPost: submitFeedback as never,
  };
});

vi.mock(import("@/lib/atlas-analytics"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    trackFeedbackOpened: trackOpened,
    trackFeedbackOutcomeViewed: trackOutcome,
    trackFeedbackSubmitted: trackSubmitted,
  };
});

import {
  ResetFeedbackProvider,
  ResetFeedbackTrigger,
} from "@/features/ux-reset/feedback/reset-feedback-dialog";

const SERVER_ID = "11111111-1111-4111-8111-111111111111";

function renderFeedback() {
  return render(
    <TooltipProvider>
      <ResetFeedbackProvider>
        <ResetFeedbackTrigger />
      </ResetFeedbackProvider>
    </TooltipProvider>
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Give feedback" }));
}

function choose(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function fillDataset(reference = "CDC tick file") {
  choose(/Suggest a dataset/);
  fireEvent.change(screen.getByLabelText("Dataset name or URL"), {
    target: { value: reference },
  });
  fireEvent.change(screen.getByLabelText("Why would this be useful?"), {
    target: { value: "It fills a county gap for this release." },
  });
}

describe("reset feedback dialog", () => {
  beforeEach(() => {
    pathname.current = "/app/review";
    searchParams.current = new URLSearchParams(
      "scope=CO&county=08031&q=secret-search&period=2024-01-01"
    );
    getSession.mockResolvedValue({ data: { session: null } });
    submitFeedback.mockReset();
    trackOpened.mockReset();
    trackSubmitted.mockReset();
    trackOutcome.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens the positive-first chooser without leaving the page", async () => {
    renderFeedback();
    openDialog();

    expect(
      screen.getByRole("heading", { name: "Help shape One Health Atlas" })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Have an idea, a useful dataset, or something we could improve? We'd love to hear it."
      )
    ).toBeTruthy();
    const labels = within(screen.getByRole("dialog"))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(labels).toStrictEqual([
      expect.stringContaining("Suggest a dataset"),
      expect.stringContaining("Share an idea"),
      expect.stringContaining("Expand Atlas"),
      expect.stringContaining("Report a problem"),
    ]);
    await waitFor(() => {
      expect(screen.getByText(/without signing in/i)).toBeTruthy();
    });
    expect(trackOpened).not.toHaveBeenCalled();
  });

  it("preserves a dataset draft when going back and asks before discarding", () => {
    renderFeedback();
    openDialog();
    fillDataset();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    choose(/Suggest a dataset/);
    expect(
      (screen.getByLabelText("Dataset name or URL") as HTMLInputElement).value
    ).toBe("CDC tick file");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Discard this feedback?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(
      (screen.getByLabelText("Dataset name or URL") as HTMLInputElement).value
    ).toBe("CDC tick file");
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it("submits a named dataset once and shows only the server id", async () => {
    const fetchSpy = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
    vi.stubGlobal("fetch", fetchSpy);
    const deferred = Promise.withResolvers<unknown>();
    submitFeedback.mockReturnValue(deferred.promise);
    renderFeedback();
    openDialog();
    fillDataset("https://example.com/ticks.csv");
    fireEvent.change(screen.getByLabelText("Source or publisher"), {
      target: { value: "CDC" },
    });
    fireEvent.change(screen.getByLabelText("Geographic coverage"), {
      target: { value: "Colorado" },
    });

    const send = screen.getByRole("button", { name: "Send feedback" });
    fireEvent.click(send);
    fireEvent.click(send);
    const body = submitFeedback.mock.calls[0]?.[0] as {
      category: string;
      contact_email?: string;
      context: { county_fips?: string; state?: string };
      message: string;
    };
    expect({
      calls: submitFeedback.mock.calls.length,
      category: body.category,
      contact: body.contact_email ?? null,
      context: body.context,
      fetched: fetchSpy.mock.calls.length,
      message: body.message,
      secret: JSON.stringify(body).includes("secret-search"),
    }).toStrictEqual({
      calls: 1,
      category: "general",
      contact: null,
      context: { county_fips: "08031", state: "CO" },
      fetched: 0,
      message: expect.stringMatching(
        /Dataset: https:\/\/example.com\/ticks.csv[\s\S]*Source or publisher: CDC/
      ),
      secret: false,
    });

    deferred.resolve({
      data: {
        feedback_id: SERVER_ID,
        received_at: "2026-10-12T00:00:00Z",
        replayed: false,
      },
      headers: new Headers(),
      status: 200,
    });

    const status = await screen.findByRole("status");
    expect({
      local: JSON.stringify(localStorage).includes("example.com"),
      reference: (
        screen.getByLabelText("Feedback reference id") as HTMLInputElement
      ).value,
      secretVisible: screen.queryByText("secret-search") !== null,
      session: JSON.stringify(sessionStorage).includes("example.com"),
      status: status.textContent,
      topic: trackSubmitted.mock.calls[0],
    }).toStrictEqual({
      local: false,
      reference: SERVER_ID,
      secretVisible: false,
      session: false,
      status: expect.stringMatching(/Thank you[\s\S]*person will review/),
      topic: ["general", "success"],
    });
  });

  it("does not invent a reference id when the server omits one", async () => {
    submitFeedback.mockResolvedValue({
      data: { feedback_id: "pending", received_at: "", replayed: false },
      headers: new Headers(),
      status: 200,
    });
    renderFeedback();
    openDialog();
    fillDataset();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not save");
    expect(screen.queryByLabelText("Feedback reference id")).toBeNull();
    expect(
      (screen.getByLabelText("Dataset name or URL") as HTMLInputElement).value
    ).toBe("CDC tick file");
  });

  it("keeps a signed-in account email out of the contact field", async () => {
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token",
          user: { email: "account@example.com" },
        },
      },
    });
    renderFeedback();
    openDialog();
    await waitFor(() => {
      expect(screen.getByText(/linked to your Atlas account/i)).toBeTruthy();
    });
    choose(/Report a problem/);
    expect(
      (screen.getByLabelText("Contact (optional)") as HTMLInputElement).value
    ).toBe("");
    expect(screen.queryByDisplayValue("account@example.com")).toBeNull();
  });

  it("blocks a free-form contact value and sends a plain email", async () => {
    submitFeedback.mockResolvedValue({
      data: {
        feedback_id: SERVER_ID,
        received_at: "2026-10-12T00:00:00Z",
        replayed: false,
      },
      headers: new Headers(),
      status: 200,
    });
    renderFeedback();
    openDialog();
    choose(/Share an idea/);
    fireEvent.change(screen.getByLabelText("What should we improve?"), {
      target: { value: "Let me save a county comparison." },
    });
    fireEvent.change(
      screen.getByLabelText("What problem or outcome would that address?"),
      { target: { value: "I could return to the same pair later." } }
    );
    fireEvent.change(screen.getByLabelText("Contact (optional)"), {
      target: { value: "Ada Lovelace, CDC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("email address");
    expect(submitFeedback).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("Contact (optional)") as HTMLInputElement).value
    ).toBe("Ada Lovelace, CDC");

    fireEvent.change(screen.getByLabelText("Contact (optional)"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("status");
    const body = submitFeedback.mock.calls[0]?.[0] as {
      contact_email?: string;
      message: string;
    };
    expect(body.contact_email).toBe("ada@example.com");
    expect(body.message).not.toContain("ada@example.com");
  });

  it("maps a problem report and reuses the token after an outage", async () => {
    submitFeedback
      .mockRejectedValueOnce(
        new AtlasApiError("down", "/v1/feedback", 503, null, null, null)
      )
      .mockResolvedValueOnce({
        data: {
          feedback_id: SERVER_ID,
          received_at: "2026-10-12T00:00:00Z",
          replayed: true,
        },
        headers: new Headers(),
        status: 200,
      });
    renderFeedback();
    openDialog();
    choose(/Report a problem/);
    fireEvent.click(screen.getByRole("radio", { name: "Something broke" }));
    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "The send control did nothing." },
    });
    fireEvent.change(screen.getByLabelText("What did you expect?"), {
      target: { value: "The note should reach review." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("draft is kept");
    expect(
      (screen.getByLabelText("What happened?") as HTMLTextAreaElement).value
    ).toBe("The send control did nothing.");

    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("status");
    const first = submitFeedback.mock.calls[0]?.[0] as {
      category: string;
      submission_token: string;
    };
    const second = submitFeedback.mock.calls[1]?.[0] as {
      submission_token: string;
    };
    expect(first.category).toBe("bug");
    expect(second.submission_token).toBe(first.submission_token);
    expect(trackSubmitted).toHaveBeenCalledWith("bug", "success");
  });

  it("keeps the draft and disables another send after a retry delay", async () => {
    submitFeedback.mockRejectedValue(
      new AtlasApiError("slow", "/v1/feedback", 429, null, 120, null)
    );
    renderFeedback();
    openDialog();
    fillDataset();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    const alert = await screen.findByRole("alert");
    const send = screen.getByRole("button", {
      name: "Send feedback",
    }) as HTMLButtonElement;
    fireEvent.click(send);
    expect({
      calls: submitFeedback.mock.calls.length,
      dataset: (
        screen.getByLabelText("Dataset name or URL") as HTMLInputElement
      ).value,
      disabled: send.disabled,
      message: alert.textContent,
      outcome: trackOutcome.mock.calls[0]?.[0],
    }).toStrictEqual({
      calls: 1,
      dataset: "CDC tick file",
      disabled: true,
      message: expect.stringContaining("120 seconds"),
      outcome: "throttled",
    });
  });

  it("keeps an unsent category draft after another category is submitted", async () => {
    submitFeedback.mockResolvedValue({
      data: {
        feedback_id: SERVER_ID,
        received_at: "2026-10-12T00:00:00Z",
        replayed: false,
      },
      headers: new Headers(),
      status: 200,
    });
    renderFeedback();
    openDialog();
    fillDataset();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    choose(/Share an idea/);
    fireEvent.change(screen.getByLabelText("What should we improve?"), {
      target: { value: "Let me save a county comparison." },
    });
    fireEvent.change(
      screen.getByLabelText("What problem or outcome would that address?"),
      { target: { value: "I could return to the same pair later." } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("status");
    const first = submitFeedback.mock.calls[0]?.[0] as {
      category: string;
      message: string;
      submission_token: string;
    };
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    openDialog();
    choose(/Suggest a dataset/);
    const preserved = (
      screen.getByLabelText("Dataset name or URL") as HTMLInputElement
    ).value;
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("status");
    const second = submitFeedback.mock.calls[1]?.[0] as {
      category: string;
      message: string;
      submission_token: string;
    };

    expect({
      calls: submitFeedback.mock.calls.length,
      firstCategory: first.category,
      firstHasDataset: first.message.includes("CDC tick file"),
      preserved,
      secondCategory: second.category,
      secondHasDataset: second.message.includes("CDC tick file"),
      tokensDiffer: second.submission_token !== first.submission_token,
    }).toStrictEqual({
      calls: 2,
      firstCategory: "feature_idea",
      firstHasDataset: false,
      preserved: "CDC tick file",
      secondCategory: "general",
      secondHasDataset: true,
      tokensDiffer: true,
    });
  });

  it("keeps the 429 cooldown across Back and retries the same report", async () => {
    vi.useFakeTimers();
    submitFeedback
      .mockRejectedValueOnce(
        new AtlasApiError("slow", "/v1/feedback", 429, null, 120, null)
      )
      .mockResolvedValueOnce({
        data: {
          feedback_id: SERVER_ID,
          received_at: "2026-10-12T00:00:00Z",
          replayed: true,
        },
        headers: new Headers(),
        status: 200,
      });
    renderFeedback();
    openDialog();
    fillDataset();
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    choose(/Suggest a dataset/);
    const sameCategorySend = screen.getByRole("button", {
      name: "Send feedback",
    }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    choose(/Share an idea/);
    const otherCategorySend = screen.getByRole("button", {
      name: "Send feedback",
    }) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    choose(/Suggest a dataset/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(119_000);
    });
    const beforeExpiry = (
      screen.getByRole("button", { name: "Send feedback" }) as HTMLButtonElement
    ).disabled;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const send = screen.getByRole("button", {
      name: "Send feedback",
    }) as HTMLButtonElement;
    const enabledBeforeRetry = send.disabled;
    fireEvent.click(send);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const first = submitFeedback.mock.calls[0]?.[0];
    const second = submitFeedback.mock.calls[1]?.[0];
    expect({
      beforeExpiry,
      calls: submitFeedback.mock.calls.length,
      enabledBeforeRetry,
      otherDisabled: otherCategorySend.disabled,
      replay: second,
      sameDisabled: sameCategorySend.disabled,
    }).toStrictEqual({
      beforeExpiry: true,
      calls: 2,
      enabledBeforeRetry: false,
      otherDisabled: true,
      replay: first,
      sameDisabled: true,
    });
  });

  it("retries a lost response with the original payload", async () => {
    const accepted = {
      data: {
        feedback_id: SERVER_ID,
        received_at: "2026-10-12T00:00:00Z",
        replayed: false,
      },
      headers: new Headers(),
      status: 200,
    };
    submitFeedback
      .mockRejectedValueOnce(
        new AtlasApiError("down", "/v1/feedback", 503, null, null, null)
      )
      .mockRejectedValueOnce(
        new AtlasApiError("down", "/v1/feedback", 503, null, null, null)
      )
      .mockResolvedValueOnce(accepted);
    renderFeedback();
    openDialog();
    choose(/Report a problem/);
    fireEvent.click(screen.getByRole("radio", { name: "Something broke" }));
    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "The send control did nothing." },
    });
    fireEvent.change(screen.getByLabelText("What did you expect?"), {
      target: { value: "The note should reach review." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("What happened?"), {
      target: { value: "The count changed after the first send." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByRole("button", { name: "Submit as a new report" });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit as a new report" })
    );
    await screen.findByRole("status");

    const first = submitFeedback.mock.calls[0]?.[0] as {
      message: string;
      submission_token: string;
    };
    const retry = submitFeedback.mock.calls[1]?.[0] as {
      message: string;
      submission_token: string;
    };
    const revised = submitFeedback.mock.calls[2]?.[0] as {
      message: string;
      submission_token: string;
    };
    expect({
      calls: submitFeedback.mock.calls.length,
      retryMessage: retry.message,
      retryToken: retry.submission_token,
      revisedMessage: revised.message.includes("changed after"),
      revisedToken: revised.submission_token === first.submission_token,
    }).toStrictEqual({
      calls: 3,
      retryMessage: first.message,
      retryToken: first.submission_token,
      revisedMessage: true,
      revisedToken: false,
    });
  });
});
