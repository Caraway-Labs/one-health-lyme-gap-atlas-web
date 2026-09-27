"use client";

import { MessageSquare } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedbackV1FeedbackPost } from "@/generated/atlas";
import {
  FeedbackSubmissionRequestCategory,
  type FeedbackSubmissionRequestCategory as FeedbackCategory,
} from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  analyticsControlAttributes,
  trackFeedbackOpened,
  trackFeedbackOutcomeViewed,
  trackFeedbackSubmitted,
  type FeedbackOutcome,
  type FeedbackTopic,
} from "@/lib/atlas-analytics";
import { useFeedbackPageContext } from "@/lib/feedback-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: {
  value: FeedbackCategory;
  label: string;
}[] = [
  { value: FeedbackSubmissionRequestCategory.data_issue, label: "Data issue" },
  { value: FeedbackSubmissionRequestCategory.usability, label: "Usability" },
  { value: FeedbackSubmissionRequestCategory.bug, label: "Bug" },
  {
    value: FeedbackSubmissionRequestCategory.feature_idea,
    label: "Feature idea",
  },
  { value: FeedbackSubmissionRequestCategory.general, label: "General" },
];

type FeedbackDraft = {
  submissionToken: string;
  category: FeedbackCategory;
  message: string;
  contactEmail: string;
};

type FeedbackPhase =
  | "form"
  | "success"
  | "unauthorized"
  | "conflict"
  | "throttled"
  | "unavailable";

type FeedbackController = {
  open: boolean;
  openFeedback: (options?: { category?: FeedbackCategory }) => void;
  closeFeedback: () => void;
};

const FeedbackControllerContext = createContext<FeedbackController | null>(
  null
);

function createSubmissionToken(): string {
  return crypto.randomUUID();
}

function createDraft(category?: FeedbackCategory): FeedbackDraft {
  return {
    submissionToken: createSubmissionToken(),
    category: category ?? FeedbackSubmissionRequestCategory.general,
    message: "",
    contactEmail: "",
  };
}

function validateContactEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 254) {
    return "Email must be 254 characters or fewer.";
  }
  if (/\s/.test(trimmed)) {
    return "Email cannot contain spaces.";
  }
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@") || at === trimmed.length - 1) {
    return "Enter a valid email address, or leave the field blank.";
  }
  return null;
}

function validateMessage(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) {
    return "Message must be at least 10 characters.";
  }
  if (trimmed.length > 2000) {
    return "Message must be 2,000 characters or fewer.";
  }
  return null;
}

function asFeedbackTopic(category: FeedbackCategory): FeedbackTopic {
  return category;
}

export function useFeedbackController(): FeedbackController {
  const value = useContext(FeedbackControllerContext);
  if (!value) {
    throw new Error("useFeedbackController requires FeedbackProvider");
  }
  return value;
}

export function useOptionalFeedbackController(): FeedbackController | null {
  return useContext(FeedbackControllerContext);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>(() => createDraft());
  const [phase, setPhase] = useState<FeedbackPhase>("form");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const { resolve: resolvePageContext } = useFeedbackPageContext();

  const emitOutcome = useCallback((outcome: FeedbackOutcome) => {
    trackFeedbackOutcomeViewed(outcome);
  }, []);

  const openFeedback = useCallback(
    (options?: { category?: FeedbackCategory }) => {
      setOpen(true);
      setValidationError(null);
      setStatusMessage(null);
      setRetryAfterSeconds(null);
      setCopied(false);

      if (phase === "success") {
        const fresh = createDraft(options?.category);
        setDraft(fresh);
        setFeedbackId(null);
        setPhase("form");
        trackFeedbackOpened(asFeedbackTopic(fresh.category));
        return;
      }

      const nextCategory = options?.category ?? draft.category;
      if (options?.category) {
        setDraft((current) => ({ ...current, category: options.category! }));
      }
      setPhase("form");
      trackFeedbackOpened(asFeedbackTopic(nextCategory));
    },
    [draft.category, phase]
  );

  const closeFeedback = useCallback(() => {
    setOpen(false);
  }, []);

  const controller = useMemo(
    () => ({ open, openFeedback, closeFeedback }),
    [closeFeedback, open, openFeedback]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await createClient().auth.getSession();
        if (!cancelled) {
          setSignedIn(Boolean(data.session?.access_token));
        }
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const discardDraft = () => {
    emitOutcome("dismissed");
    setDraft(createDraft());
    setPhase("form");
    setFeedbackId(null);
    setValidationError(null);
    setStatusMessage(null);
    setRetryAfterSeconds(null);
    setCopied(false);
    setOpen(false);
  };

  const submitDraft = async (submissionToken: string) => {
    if (submitting) return;

    const messageError = validateMessage(draft.message);
    const emailError = validateContactEmail(draft.contactEmail);
    if (messageError || emailError) {
      const message = messageError ?? emailError ?? "Check the form and retry.";
      setValidationError(message);
      setPhase("form");
      emitOutcome("validation_error");
      return;
    }

    setValidationError(null);
    setStatusMessage(null);
    setSubmitting(true);

    const trimmedEmail = draft.contactEmail.trim();
    const { routeId, context, appVersion } = resolvePageContext();
    const body = {
      submission_token: submissionToken,
      category: draft.category,
      message: draft.message.trim(),
      ...(trimmedEmail ? { contact_email: trimmedEmail } : {}),
      route_id: routeId,
      context,
      app_version: appVersion,
    };

    try {
      const result = await submitFeedbackV1FeedbackPost(body);
      if (result.status !== 200) {
        throw new AtlasApiError(
          "Feedback submission failed.",
          "/v1/feedback",
          result.status,
          null
        );
      }
      setFeedbackId(result.data.feedback_id);
      setDraft(createDraft(draft.category));
      setPhase("success");
      trackFeedbackSubmitted(asFeedbackTopic(draft.category), "success");
      emitOutcome("success");
    } catch (error) {
      if (error instanceof AtlasApiError) {
        if (error.status === 401) {
          setPhase("unauthorized");
          setStatusMessage(
            "Your session expired. Sign in again, then resubmit. Your draft is still here."
          );
          emitOutcome("unavailable");
          return;
        }
        if (error.status === 409) {
          setPhase("conflict");
          setStatusMessage(
            "This report token already matches a different submission. Keep your text, or submit it as a new report."
          );
          emitOutcome("unavailable");
          return;
        }
        if (error.status === 429) {
          setPhase("throttled");
          setRetryAfterSeconds(error.retryAfterSeconds);
          setStatusMessage(
            error.retryAfterSeconds == null
              ? "Too many feedback requests. Please wait a few minutes and try again."
              : `Too many feedback requests. Try again in about ${error.retryAfterSeconds} seconds.`
          );
          emitOutcome("throttled");
          return;
        }
        if (error.status >= 500 || error.status === 0) {
          setPhase("unavailable");
          setStatusMessage(
            "Atlas could not save your feedback right now. Your draft is kept—try again with the same report."
          );
          emitOutcome("unavailable");
          return;
        }
      }
      setPhase("unavailable");
      setStatusMessage(
        "Atlas could not save your feedback right now. Your draft is kept—try again with the same report."
      );
      emitOutcome("unavailable");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await submitDraft(draft.submissionToken);
  };

  const submitAsNewReport = () => {
    const nextToken = createSubmissionToken();
    setDraft((current) => ({
      ...current,
      submissionToken: nextToken,
    }));
    setPhase("form");
    setStatusMessage(null);
    setValidationError(null);
    void submitDraft(nextToken);
  };

  const copyFeedbackId = async () => {
    if (!feedbackId) return;
    try {
      await navigator.clipboard.writeText(feedbackId);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <FeedbackControllerContext.Provider value={controller}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !submitting) {
            setOpen(false);
          }
        }}
      >
        <DialogContent
          className="feedback-dialog z-[60] sm:max-w-lg"
          aria-labelledby="feedback-dialog-title"
        >
          <DialogHeader>
            <DialogTitle id="feedback-dialog-title">Send feedback</DialogTitle>
            <DialogDescription>
              Share a product or data note with Atlas. Optional contact email is
              only for follow-up on this report—not a support SLA.
            </DialogDescription>
          </DialogHeader>

          {phase === "success" && feedbackId ? (
            <div className="feedback-success" role="status">
              <p>Thanks. Your feedback was received.</p>
              <label
                className="block text-sm font-medium"
                htmlFor="feedback-id"
              >
                Reference id
              </label>
              <div className="feedback-id-row">
                <Input
                  id="feedback-id"
                  readOnly
                  value={feedbackId}
                  aria-label="Feedback reference id"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyFeedbackId}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closeFeedback}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="feedback-form space-y-4" onSubmit={submit}>
              <label
                className="block text-sm font-medium"
                htmlFor="feedback-category"
              >
                Category
                <Select
                  value={draft.category}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDraft((current) => ({
                      ...current,
                      category: value as FeedbackCategory,
                    }));
                  }}
                >
                  <SelectTrigger
                    id="feedback-category"
                    aria-label="Feedback category"
                    className="mt-2 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label
                className="block text-sm font-medium"
                htmlFor="feedback-message"
              >
                Message
                <textarea
                  id="feedback-message"
                  className="feedback-textarea mt-2"
                  value={draft.message}
                  maxLength={2000}
                  rows={5}
                  disabled={submitting}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  aria-invalid={Boolean(validationError)}
                  aria-describedby="feedback-phi-guidance feedback-message-count"
                />
              </label>
              <p
                id="feedback-phi-guidance"
                className="text-muted-foreground text-xs"
              >
                Do not include medical details or other sensitive personal
                information. Feedback is voluntary product input, not a clinical
                channel or a data-rights request.
              </p>
              <p
                id="feedback-message-count"
                className="text-muted-foreground text-xs"
              >
                {draft.message.trim().length}/2,000
              </p>

              <label
                className="block text-sm font-medium"
                htmlFor="feedback-email"
              >
                Contact email (optional)
                <Input
                  id="feedback-email"
                  className="mt-2"
                  type="email"
                  autoComplete="email"
                  value={draft.contactEmail}
                  disabled={submitting}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      contactEmail: event.target.value,
                    }))
                  }
                  placeholder="you@example.com"
                />
              </label>

              {signedIn ? (
                <p className="text-muted-foreground text-xs">
                  You are signed in. This report will be linked to your Atlas
                  account. Contact email is still optional and is never copied
                  from your profile.
                </p>
              ) : null}

              {validationError ? (
                <p role="alert" className="text-destructive text-sm">
                  {validationError}
                </p>
              ) : null}
              {statusMessage ? (
                <p role="alert" className="text-sm">
                  {statusMessage}
                  {phase === "throttled" && retryAfterSeconds != null
                    ? ` (Retry-After: ${retryAfterSeconds}s)`
                    : null}
                </p>
              ) : null}

              <DialogFooter className="feedback-actions">
                <Button
                  {...analyticsControlAttributes("feedback_discard")}
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={discardDraft}
                >
                  Discard
                </Button>
                {phase === "conflict" ? (
                  <Button
                    {...analyticsControlAttributes("feedback_retry")}
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={submitAsNewReport}
                  >
                    Submit as a new report
                  </Button>
                ) : null}
                <Button
                  {...analyticsControlAttributes(
                    phase === "throttled" || phase === "unavailable"
                      ? "feedback_retry"
                      : "feedback_submit"
                  )}
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Send feedback"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </FeedbackControllerContext.Provider>
  );
}

export function FeedbackTrigger({
  label = "Feedback",
  category,
  controlId = "feedback_open",
  className,
}: {
  label?: string;
  category?: FeedbackCategory;
  controlId?:
    | "feedback_open"
    | "feedback_report_data_issue"
    | "feedback_footer_open";
  className?: string;
}) {
  const controller = useOptionalFeedbackController();
  if (!controller) return null;
  const onClick = () =>
    controller.openFeedback(category ? { category } : undefined);

  if (controlId === "feedback_open") {
    return (
      <button
        {...analyticsControlAttributes(controlId)}
        type="button"
        className={cn("app-utility-link", className)}
        onClick={onClick}
      >
        <MessageSquare aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  if (controlId === "feedback_footer_open") {
    return (
      <button
        {...analyticsControlAttributes(controlId)}
        type="button"
        className={cn("footer-feedback", className)}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <Button
      {...analyticsControlAttributes(controlId)}
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
