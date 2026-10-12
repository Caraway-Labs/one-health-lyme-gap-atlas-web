"use client";

import { MessageSquarePlus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
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
import { SidebarMenuAction, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  buildResetFeedbackSubmission,
  classifyFeedbackHttpStatus,
  createEmptyResetFeedbackDrafts,
  PROBLEM_KIND_OPTIONS,
  RESET_FEEDBACK_CATEGORIES,
  RESET_FEEDBACK_HEADING,
  RESET_FEEDBACK_INTRO,
  resetFeedbackDraftHasContent,
  resetFeedbackPage,
  serverFeedbackId,
  type DatasetFeedbackDraft,
  type ExpandFeedbackDraft,
  type FeedbackSubmitFailure,
  type IdeaFeedbackDraft,
  type ProblemFeedbackDraft,
  type ResetFeedbackCategoryId,
  type ResetFeedbackDrafts,
} from "@/features/ux-reset/feedback/reset-feedback-model";
import { submitFeedbackV1FeedbackPost } from "@/generated/atlas";
import { AtlasApiError } from "@/lib/api-mutator";
import {
  analyticsControlAttributes,
  trackFeedbackOpened,
  trackFeedbackOutcomeViewed,
  trackFeedbackSubmitted,
} from "@/lib/atlas-analytics";
import { createClient } from "@/lib/supabase/client";

type Panel =
  | { category: ResetFeedbackCategoryId; name: "form" }
  | { name: "choose" }
  | { name: "confirm" }
  | { feedbackId: string; name: "success" };

type ResetFeedbackController = {
  openFeedback: () => void;
};

type FeedbackRetryCooldown = {
  message: string;
  until: number;
};

function draftsAfterSuccessfulSubmit(
  drafts: ResetFeedbackDrafts,
  category: ResetFeedbackCategoryId
): ResetFeedbackDrafts {
  const empty = createEmptyResetFeedbackDrafts();
  return { ...drafts, [category]: empty[category] };
}

const ResetFeedbackContext = createContext<ResetFeedbackController | null>(
  null
);

function createSubmissionToken(): string {
  return crypto.randomUUID();
}

function feedbackReturnFocus(): HTMLElement | null {
  const trigger = document.querySelector<HTMLElement>(
    "[data-reset-feedback-trigger]"
  );
  if (isFocusable(trigger)) return trigger;
  const mobileTrigger = document.querySelector<HTMLElement>(
    ".app-mobile-nav-trigger"
  );
  if (isFocusable(mobileTrigger)) return mobileTrigger;
  return null;
}

function isFocusable(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected) return false;
  return !element.closest("[inert]");
}

export function ResetFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>({ name: "choose" });
  const [returnPanel, setReturnPanel] = useState<Panel>({ name: "choose" });
  const [drafts, setDrafts] = useState<ResetFeedbackDrafts>(
    createEmptyResetFeedbackDrafts
  );
  const [submissionToken, setSubmissionToken] = useState(createSubmissionToken);
  const [failure, setFailure] = useState<FeedbackSubmitFailure | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState<FeedbackRetryCooldown | null>(null);
  const [retryLocked, setRetryLocked] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const submittingRef = useRef(false);
  const page = resetFeedbackPage(pathname);

  const resetComposer = useCallback(() => {
    setDrafts(createEmptyResetFeedbackDrafts());
    setSubmissionToken(createSubmissionToken());
    setPanel({ name: "choose" });
    setReturnPanel({ name: "choose" });
    setFailure(null);
    setValidationError(null);
    setCopied(false);
  }, []);

  const openFeedback = useCallback(() => {
    setOpen(true);
    setFailure(null);
    setValidationError(null);
    setCopied(false);
    setPanel((current) =>
      current.name === "success" ? { name: "choose" } : current
    );
  }, []);

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

  useEffect(() => {
    if (!cooldown) return;
    const remaining = cooldown.until - Date.now();
    const timer = window.setTimeout(
      () => {
        setCooldown(null);
        setRetryLocked(false);
        setFailure((current) =>
          current?.kind === "throttled" ? null : current
        );
      },
      Math.max(0, remaining)
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldown]);

  const closeDialog = (afterSuccess: boolean) => {
    setOpen(false);
    if (afterSuccess) {
      setPanel({ name: "choose" });
      setReturnPanel({ name: "choose" });
      setFailure(null);
      setValidationError(null);
      setCopied(false);
      return;
    }
    trackFeedbackOutcomeViewed("dismissed");
    resetComposer();
  };

  const rememberThrottle = (nextFailure: FeedbackSubmitFailure) => {
    setFailure(nextFailure);
    const seconds = nextFailure.retryAfterSeconds ?? 0;
    if (nextFailure.kind !== "throttled" || seconds <= 0) return;
    setRetryLocked(true);
    setCooldown({
      message: nextFailure.message,
      until: Date.now() + seconds * 1000,
    });
  };

  const submitWith = async (token: string) => {
    if (submittingRef.current || panel.name !== "form") return;
    const category = panel.category;
    submittingRef.current = true;
    setSubmitting(true);
    setValidationError(null);
    setFailure(null);

    const built = buildResetFeedbackSubmission({
      category,
      drafts,
      pathname,
      searchParams,
      submissionToken: token,
    });
    if (!built.ok) {
      setValidationError(built.error);
      trackFeedbackOutcomeViewed("validation_error");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitFeedbackV1FeedbackPost(built.request);
      if (result.status !== 200) {
        const nextFailure = classifyFeedbackHttpStatus(result.status, null);
        rememberThrottle(nextFailure);
        trackFeedbackOutcomeViewed(
          nextFailure.kind === "throttled" ? "throttled" : "unavailable"
        );
        return;
      }
      const feedbackId = serverFeedbackId(result.data.feedback_id);
      if (!feedbackId) {
        setFailure(classifyFeedbackHttpStatus(0, null));
        trackFeedbackOutcomeViewed("unavailable");
        return;
      }
      setDrafts((current) => draftsAfterSuccessfulSubmit(current, category));
      setSubmissionToken(createSubmissionToken());
      setPanel({ feedbackId, name: "success" });
      trackFeedbackSubmitted(built.topic, "success");
      trackFeedbackOutcomeViewed("success");
    } catch (error) {
      const status = error instanceof AtlasApiError ? error.status : 0;
      const retryAfterSeconds =
        error instanceof AtlasApiError ? error.retryAfterSeconds : null;
      const nextFailure = classifyFeedbackHttpStatus(status, retryAfterSeconds);
      rememberThrottle(nextFailure);
      if (nextFailure.kind === "rejected") {
        trackFeedbackOutcomeViewed("validation_error");
      } else if (nextFailure.kind === "throttled") {
        trackFeedbackOutcomeViewed("throttled");
      } else {
        trackFeedbackOutcomeViewed("unavailable");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (retryLocked) return;
    void submitWith(submissionToken);
  };

  const submitAsNewReport = () => {
    const nextToken = createSubmissionToken();
    setSubmissionToken(nextToken);
    setFailure(null);
    void submitWith(nextToken);
  };

  const chooseCategory = (category: ResetFeedbackCategoryId) => {
    setPanel({ category, name: "form" });
    setValidationError(null);
    setFailure(null);
    if (category === "dataset") {
      trackFeedbackOpened("general");
    } else if (category === "idea" || category === "expand") {
      trackFeedbackOpened("feature_idea");
    }
  };

  const discardDraft = () => {
    trackFeedbackOutcomeViewed("dismissed");
    resetComposer();
    setOpen(false);
  };

  const controller = useMemo(() => ({ openFeedback }), [openFeedback]);

  return (
    <ResetFeedbackContext.Provider value={controller}>
      {children}
      <Dialog
        onOpenChange={(nextOpen, details) => {
          if (nextOpen) {
            setOpen(true);
            return;
          }
          if (submittingRef.current) {
            details.cancel();
            return;
          }
          if (panel.name === "confirm") {
            details.cancel();
            setPanel(returnPanel);
            return;
          }
          if (
            panel.name !== "success" &&
            resetFeedbackDraftHasContent(drafts)
          ) {
            details.cancel();
            setReturnPanel(panel);
            setPanel({ name: "confirm" });
            return;
          }
          closeDialog(panel.name === "success");
        }}
        open={open}
      >
        <DialogContent
          className="feedback-dialog z-[60] sm:max-w-lg"
          finalFocus={feedbackReturnFocus}
        >
          <DialogHeader>
            <DialogTitle>{RESET_FEEDBACK_HEADING}</DialogTitle>
            <DialogDescription>{RESET_FEEDBACK_INTRO}</DialogDescription>
          </DialogHeader>
          <AccountNotice signedIn={signedIn} />
          {panel.name === "success" ? (
            <SuccessPanel
              copied={copied}
              feedbackId={panel.feedbackId}
              onCopy={async () => {
                try {
                  await navigator.clipboard.writeText(panel.feedbackId);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              onDone={() => closeDialog(true)}
            />
          ) : null}
          {panel.name === "confirm" ? (
            <DiscardPanel
              onDiscard={discardDraft}
              onKeep={() => setPanel(returnPanel)}
            />
          ) : null}
          {panel.name === "choose" ? (
            <CategoryChooser
              onChoose={chooseCategory}
              pageLabel={page.pageLabel}
            />
          ) : null}
          {panel.name === "form" ? (
            <form
              className="feedback-form space-y-4"
              noValidate
              onSubmit={submit}
            >
              <CategoryForm
                category={panel.category}
                disabled={submitting}
                drafts={drafts}
                onDrafts={setDrafts}
                onProblemKind={(kind) => {
                  if (kind) trackFeedbackOpened(kind);
                }}
              />
              <p className="text-muted-foreground text-xs">
                Atlas will include the {page.pageLabel} page and any selected
                county, state, or release already in the address bar. It will
                not include search text, cookies, or your account email.
              </p>
              <p className="text-muted-foreground text-xs">
                Do not include medical details, patient information, or other
                private personal information. Feedback is voluntary product
                input, not a clinical channel or a data-rights request.
              </p>
              {validationError ? (
                <p className="text-destructive text-sm" role="alert">
                  {validationError}
                </p>
              ) : null}
              {failure ? (
                <p className="text-sm" role="alert">
                  {failure.message}
                </p>
              ) : retryLocked && cooldown ? (
                <p className="text-sm" role="alert">
                  {cooldown.message}
                </p>
              ) : null}
              <DialogFooter className="feedback-actions">
                <Button
                  {...analyticsControlAttributes("feedback_discard")}
                  className="min-h-11"
                  disabled={submitting}
                  onClick={() => {
                    if (resetFeedbackDraftHasContent(drafts)) {
                      setReturnPanel(panel);
                      setPanel({ name: "confirm" });
                      return;
                    }
                    closeDialog(false);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  className="min-h-11"
                  disabled={submitting}
                  onClick={() => {
                    setPanel({ name: "choose" });
                    setValidationError(null);
                    setFailure(null);
                  }}
                  type="button"
                  variant="secondary"
                >
                  Back
                </Button>
                {failure?.kind === "conflict" ? (
                  <Button
                    {...analyticsControlAttributes("feedback_retry")}
                    className="min-h-11"
                    disabled={submitting}
                    onClick={submitAsNewReport}
                    type="button"
                    variant="secondary"
                  >
                    Submit as a new report
                  </Button>
                ) : null}
                <Button
                  {...analyticsControlAttributes(
                    failure?.kind === "throttled" ||
                      failure?.kind === "unavailable" ||
                      retryLocked
                      ? "feedback_retry"
                      : "feedback_submit"
                  )}
                  className="min-h-11"
                  disabled={submitting || retryLocked}
                  type="submit"
                >
                  {submitting ? "Sending…" : "Send feedback"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </ResetFeedbackContext.Provider>
  );
}

export function ResetFeedbackTrigger({
  onActivate,
}: {
  onActivate?: () => void;
}) {
  const controller = useContext(ResetFeedbackContext);
  if (!controller) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuAction
        aria-label="Give feedback"
        data-reset-feedback-trigger=""
        onClick={() => {
          onActivate?.();
          controller.openFeedback();
        }}
        tooltip="Give feedback"
        {...analyticsControlAttributes("feedback_open")}
      >
        <MessageSquarePlus aria-hidden="true" />
        <span className="sidebar-item-label">Give feedback</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  );
}

function AccountNotice({ signedIn }: { signedIn: boolean | null }) {
  if (signedIn === true) {
    return (
      <p className="text-muted-foreground text-xs">
        You are signed in. This note will be linked to your Atlas account.
        Contact email is still optional and is never copied from your profile.
      </p>
    );
  }
  if (signedIn === false) {
    return (
      <p className="text-muted-foreground text-xs">
        You can send this without signing in. It stays anonymous unless you
        enter an email.
      </p>
    );
  }
  return null;
}

function CategoryChooser({
  onChoose,
  pageLabel,
}: {
  onChoose: (category: ResetFeedbackCategoryId) => void;
  pageLabel: string;
}) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {RESET_FEEDBACK_CATEGORIES.map((category) => (
          <li key={category.id}>
            <button
              className="bg-card text-card-foreground ring-foreground/10 hover:bg-muted focus-visible:ring-ring min-h-11 w-full cursor-pointer rounded-xl border-0 px-3 py-3 text-left font-[inherit] ring-1 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onChoose(category.id)}
              type="button"
            >
              <span className="block font-medium">{category.label}</span>
              <span className="text-muted-foreground block text-sm">
                {category.description}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        You are on {pageLabel}. Choosing a category keeps this page, county, and
        filters in place.
      </p>
    </div>
  );
}

function CategoryForm({
  category,
  disabled,
  drafts,
  onDrafts,
  onProblemKind,
}: {
  category: ResetFeedbackCategoryId;
  disabled: boolean;
  drafts: ResetFeedbackDrafts;
  onDrafts: (next: ResetFeedbackDrafts) => void;
  onProblemKind: (kind: ProblemFeedbackDraft["kind"]) => void;
}) {
  switch (category) {
    case "dataset": {
      return (
        <DatasetFields
          disabled={disabled}
          draft={drafts.dataset}
          onChange={(dataset) => onDrafts({ ...drafts, dataset })}
        />
      );
    }
    case "idea": {
      return (
        <IdeaFields
          disabled={disabled}
          draft={drafts.idea}
          onChange={(idea) => onDrafts({ ...drafts, idea })}
        />
      );
    }
    case "expand": {
      return (
        <ExpandFields
          disabled={disabled}
          draft={drafts.expand}
          onChange={(expand) => onDrafts({ ...drafts, expand })}
        />
      );
    }
    case "problem": {
      return (
        <ProblemFields
          disabled={disabled}
          draft={drafts.problem}
          onChange={(problem) => onDrafts({ ...drafts, problem })}
          onKind={onProblemKind}
        />
      );
    }
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

function DatasetFields({
  disabled,
  draft,
  onChange,
}: {
  disabled: boolean;
  draft: DatasetFeedbackDraft;
  onChange: (draft: DatasetFeedbackDraft) => void;
}) {
  const referenceId = useId();
  const usefulnessId = useId();
  return (
    <div className="space-y-4">
      <p className="text-sm">
        A person reviews dataset suggestions. Atlas will not add or publish a
        dataset from this form.
      </p>
      <FieldLabel htmlFor={referenceId} label="Dataset name or URL">
        <Input
          disabled={disabled}
          id={referenceId}
          maxLength={300}
          onChange={(event) =>
            onChange({ ...draft, reference: event.target.value })
          }
          value={draft.reference}
        />
      </FieldLabel>
      <FieldLabel htmlFor={usefulnessId} label="Why would this be useful?">
        <FeedbackTextarea
          disabled={disabled}
          id={usefulnessId}
          maxLength={800}
          onChange={(value) => onChange({ ...draft, usefulness: value })}
          value={draft.usefulness}
        />
      </FieldLabel>
      <OptionalDetails>
        <OptionalText
          disabled={disabled}
          label="Source or publisher"
          onChange={(source) => onChange({ ...draft, source })}
          value={draft.source}
        />
        <OptionalText
          disabled={disabled}
          label="Geographic coverage"
          onChange={(geography) => onChange({ ...draft, geography })}
          value={draft.geography}
        />
        <p className="text-muted-foreground text-xs">
          Lower 48 states and Washington, DC only.
        </p>
        <OptionalText
          disabled={disabled}
          label="Update frequency"
          onChange={(frequency) => onChange({ ...draft, frequency })}
          value={draft.frequency}
        />
        <OptionalNote
          disabled={disabled}
          label="Notes"
          onChange={(notes) => onChange({ ...draft, notes })}
          value={draft.notes}
        />
        <ContactField
          disabled={disabled}
          onChange={(contact) => onChange({ ...draft, contact })}
          value={draft.contact}
        />
      </OptionalDetails>
    </div>
  );
}

function IdeaFields({
  disabled,
  draft,
  onChange,
}: {
  disabled: boolean;
  draft: IdeaFeedbackDraft;
  onChange: (draft: IdeaFeedbackDraft) => void;
}) {
  const improvementId = useId();
  const outcomeId = useId();
  return (
    <div className="space-y-4">
      <p className="text-sm">Sharing an idea does not add it to a roadmap.</p>
      <FieldLabel htmlFor={improvementId} label="What should we improve?">
        <FeedbackTextarea
          disabled={disabled}
          id={improvementId}
          maxLength={800}
          onChange={(improvement) => onChange({ ...draft, improvement })}
          value={draft.improvement}
        />
      </FieldLabel>
      <FieldLabel
        htmlFor={outcomeId}
        label="What problem or outcome would that address?"
      >
        <FeedbackTextarea
          disabled={disabled}
          id={outcomeId}
          maxLength={800}
          onChange={(outcome) => onChange({ ...draft, outcome })}
          value={draft.outcome}
        />
      </FieldLabel>
      <OptionalDetails>
        <OptionalNote
          disabled={disabled}
          label="Details"
          onChange={(details) => onChange({ ...draft, details })}
          value={draft.details}
        />
        <ContactField
          disabled={disabled}
          onChange={(contact) => onChange({ ...draft, contact })}
          value={draft.contact}
        />
      </OptionalDetails>
    </div>
  );
}

function ExpandFields({
  disabled,
  draft,
  onChange,
}: {
  disabled: boolean;
  draft: ExpandFeedbackDraft;
  onChange: (draft: ExpandFeedbackDraft) => void;
}) {
  const topicId = useId();
  const outcomeId = useId();
  const urlId = useId();
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Naming a disease, vector, or topic here does not mean Atlas already
        includes it. A person reviews the suggestion. Nothing is added
        automatically, and patient-level details do not belong here.
      </p>
      <FieldLabel htmlFor={topicId} label="What should Atlas cover?">
        <FeedbackTextarea
          disabled={disabled}
          id={topicId}
          maxLength={800}
          onChange={(topic) => onChange({ ...draft, topic })}
          value={draft.topic}
        />
      </FieldLabel>
      <FieldLabel
        htmlFor={outcomeId}
        label="What problem or outcome would that address?"
      >
        <FeedbackTextarea
          disabled={disabled}
          id={outcomeId}
          maxLength={800}
          onChange={(outcome) => onChange({ ...draft, outcome })}
          value={draft.outcome}
        />
      </FieldLabel>
      <OptionalDetails>
        <FieldLabel htmlFor={urlId} label="Public URL (optional)">
          <Input
            disabled={disabled}
            id={urlId}
            inputMode="url"
            maxLength={300}
            onChange={(event) =>
              onChange({ ...draft, sourceUrl: event.target.value })
            }
            value={draft.sourceUrl}
          />
        </FieldLabel>
        <OptionalNote
          disabled={disabled}
          label="Details"
          onChange={(details) => onChange({ ...draft, details })}
          value={draft.details}
        />
        <ContactField
          disabled={disabled}
          onChange={(contact) => onChange({ ...draft, contact })}
          value={draft.contact}
        />
      </OptionalDetails>
    </div>
  );
}

function ProblemFields({
  disabled,
  draft,
  onChange,
  onKind,
}: {
  disabled: boolean;
  draft: ProblemFeedbackDraft;
  onChange: (draft: ProblemFeedbackDraft) => void;
  onKind: (kind: ProblemFeedbackDraft["kind"]) => void;
}) {
  const happenedId = useId();
  const expectedId = useId();
  const legendId = useId();
  return (
    <div className="space-y-4">
      <fieldset aria-labelledby={legendId} className="space-y-2">
        <legend className="text-sm font-medium" id={legendId}>
          What kind of problem is this?
        </legend>
        {PROBLEM_KIND_OPTIONS.map((option) => (
          <label
            className="flex min-h-11 items-center gap-2 text-sm"
            key={option.value}
          >
            <input
              checked={draft.kind === option.value}
              disabled={disabled}
              name="reset-feedback-problem-kind"
              onChange={() => {
                onChange({ ...draft, kind: option.value });
                onKind(option.value);
              }}
              type="radio"
              value={option.value}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <FieldLabel htmlFor={happenedId} label="What happened?">
        <FeedbackTextarea
          disabled={disabled}
          id={happenedId}
          maxLength={800}
          onChange={(happened) => onChange({ ...draft, happened })}
          value={draft.happened}
        />
      </FieldLabel>
      <FieldLabel htmlFor={expectedId} label="What did you expect?">
        <FeedbackTextarea
          disabled={disabled}
          id={expectedId}
          maxLength={800}
          onChange={(expected) => onChange({ ...draft, expected })}
          value={draft.expected}
        />
      </FieldLabel>
      <OptionalDetails>
        <OptionalNote
          disabled={disabled}
          label="Details"
          onChange={(details) => onChange({ ...draft, details })}
          value={draft.details}
        />
        <ContactField
          disabled={disabled}
          onChange={(contact) => onChange({ ...draft, contact })}
          value={draft.contact}
        />
      </OptionalDetails>
    </div>
  );
}

function SuccessPanel({
  copied,
  feedbackId,
  onCopy,
  onDone,
}: {
  copied: boolean;
  feedbackId: string;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-3" role="status">
      <p>
        Thank you. We received your note and a person will review it. This does
        not add a dataset, open a GitHub issue, or promise a reply.
      </p>
      <label className="block text-sm font-medium" htmlFor="reset-feedback-id">
        Reference id
      </label>
      <div className="feedback-id-row">
        <Input
          aria-label="Feedback reference id"
          id="reset-feedback-id"
          readOnly
          value={feedbackId}
        />
        <Button onClick={onCopy} type="button" variant="secondary">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <DialogFooter>
        <Button className="min-h-11" onClick={onDone} type="button">
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}

function DiscardPanel({
  onDiscard,
  onKeep,
}: {
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-medium">Discard this feedback?</p>
      <p className="text-muted-foreground text-sm">
        What you typed will be cleared. It is not saved on this device.
      </p>
      <DialogFooter>
        <Button
          className="min-h-11"
          onClick={onKeep}
          type="button"
          variant="secondary"
        >
          Keep editing
        </Button>
        <Button
          {...analyticsControlAttributes("feedback_discard")}
          className="min-h-11"
          onClick={onDiscard}
          type="button"
          variant="destructive"
        >
          Discard
        </Button>
      </DialogFooter>
    </div>
  );
}

function OptionalDetails({ children }: { children: ReactNode }) {
  return (
    <details className="bg-muted/40 rounded-xl px-3 py-2">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">
        Additional details (optional)
      </summary>
      <div className="space-y-4 pb-2">{children}</div>
    </details>
  );
}

function ContactField({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const helpId = useId();
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium" htmlFor={id}>
        Contact (optional)
      </label>
      <Input
        aria-describedby={helpId}
        autoComplete="off"
        disabled={disabled}
        id={id}
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Name, email, or organization"
        value={value}
      />
      <p className="text-muted-foreground text-xs" id={helpId}>
        An email lets us ask a follow-up question. This is optional and is not a
        support promise. Do not include health or patient information. Atlas can
        store an email today. A name or organization is kept in this draft until
        you enter only an email or clear the field.
      </p>
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium" htmlFor={htmlFor}>
      {label}
      <span className="mt-2 block font-normal">{children}</span>
    </label>
  );
}

function OptionalText({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  return (
    <FieldLabel htmlFor={id} label={label}>
      <Input
        disabled={disabled}
        id={id}
        maxLength={200}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </FieldLabel>
  );
}

function OptionalNote({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  return (
    <FieldLabel htmlFor={id} label={label}>
      <FeedbackTextarea
        disabled={disabled}
        id={id}
        maxLength={400}
        onChange={onChange}
        value={value}
      />
    </FieldLabel>
  );
}

function FeedbackTextarea({
  disabled,
  id,
  maxLength,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  maxLength: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <textarea
      className="feedback-textarea mt-2"
      disabled={disabled}
      id={id}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      value={value}
    />
  );
}
