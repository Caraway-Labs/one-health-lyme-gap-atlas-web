"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useRef, useState } from "react";

import { SignInIdentity } from "@/app/auth/sign-in/sign-in-entrance";
import { Button } from "@/components/ui/button";
import { SIGN_IN_COPY } from "@/lib/auth/sign-in-recovery";
import { getDocsUrl } from "@/lib/docs-config";

import type { SavedProfile } from "../profile/default-jurisdiction-contract";
import { writeSavedProfile } from "../profile/saved-profile-client";
import { useSettingsStateOptions } from "../settings/use-settings-state-options";
import {
  buildStartingViewCompletionWrite,
  destinationAfterStartingView,
  startingViewCompletionConfirmed,
} from "./starting-view-completion";

const COPY = {
  checking: "Checking your starting view…",
  continue: "Continue to Review",
  explanation:
    "This sets where Review starts. You can explore any county and change your default later in Settings.",
  failure:
    "We couldn’t save your starting view. Your selection is still here. Try again.",
  heading: "Choose your starting view",
  missingChoice: "Choose United States or one state to continue.",
  missingState: "Select a state to continue.",
  national: "United States",
  prompt: "Where would you like Review to start?",
  saving: "Saving…",
  savingStatus: "Saving your starting view…",
  state: "One state",
  stateLabel: "State",
  statePlaceholder: "Select a state",
  statesUnavailable:
    "We couldn’t load the state list. Your selection is still here. Try again.",
} as const;

type Choice = "national" | "state" | null;

export function StartingViewScreen({
  profile,
}: {
  profile: SavedProfile | null;
}) {
  const router = useRouter();
  const states = useSettingsStateOptions();
  const explanationId = useId();
  const errorId = useId();
  const statusId = useId();
  const nationalRef = useRef<HTMLInputElement>(null);
  const stateSelectRef = useRef<HTMLSelectElement>(null);
  const [choice, setChoice] = useState<Choice>(null);
  const [stateCode, setStateCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function continueToReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (!choice) {
      setError(COPY.missingChoice);
      nationalRef.current?.focus();
      return;
    }
    if (choice === "state" && !stateCode) {
      setError(COPY.missingState);
      stateSelectRef.current?.focus();
      return;
    }
    if (choice === "state" && states.stateList.status !== "ready") {
      setError(COPY.statesUnavailable);
      return;
    }
    const jurisdiction = choice === "national" ? "national" : { stateCode };
    const built = buildStartingViewCompletionWrite(
      profile,
      jurisdiction,
      states.stateOptions
    );
    if (!built.ok) {
      setError(built.message);
      stateSelectRef.current?.focus();
      return;
    }
    setError(null);
    setPending(true);
    const requestedState = built.body.state_code ?? null;
    try {
      const outcome = await writeSavedProfile(built.body, undefined, profile);
      if (
        outcome.status === "confirmed" &&
        startingViewCompletionConfirmed(outcome.profile, requestedState)
      ) {
        router.replace(destinationAfterStartingView(outcome.profile, null));
        return;
      }
      setError(COPY.failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-entrance">
      <SignInIdentity />
      <main className="auth-entrance-main">
        <form className="auth-entrance-form" onSubmit={continueToReview}>
          <h1>{COPY.heading}</h1>
          <p className="auth-entrance-subtle" id={explanationId}>
            {COPY.explanation}
          </p>
          <fieldset aria-describedby={explanationId} disabled={pending}>
            <legend>{COPY.prompt}</legend>
            <label className="auth-entrance-choice">
              <input
                checked={choice === "national"}
                name="starting-view"
                onChange={() => {
                  setChoice("national");
                  setError(null);
                }}
                ref={nationalRef}
                type="radio"
                value="national"
              />
              {COPY.national}
            </label>
            <label className="auth-entrance-choice">
              <input
                checked={choice === "state"}
                name="starting-view"
                onChange={() => {
                  setChoice("state");
                  setError(null);
                }}
                type="radio"
                value="state"
              />
              {COPY.state}
            </label>
          </fieldset>
          {choice === "state" ? (
            <div>
              <label className="auth-entrance-label" htmlFor="atlas-state">
                {COPY.stateLabel}
              </label>
              <select
                className="auth-entrance-input"
                disabled={pending || states.stateList.status !== "ready"}
                id="atlas-state"
                onChange={(event) => {
                  setStateCode(event.target.value);
                  setError(null);
                }}
                ref={stateSelectRef}
                value={stateCode}
              >
                <option value="">{COPY.statePlaceholder}</option>
                {states.stateOptions.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {error ? (
            <p className="auth-entrance-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
          <p
            aria-live="polite"
            className="auth-entrance-status"
            hidden={!pending}
            id={statusId}
          >
            {COPY.savingStatus}
          </p>
          <Button
            aria-busy={pending || undefined}
            aria-describedby={error ? errorId : undefined}
            className="auth-entrance-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? COPY.saving : COPY.continue}
          </Button>
        </form>
      </main>
      <footer className="auth-entrance-footer">
        <Link href="/privacy">{SIGN_IN_COPY.privacy}</Link>
        <a href={getDocsUrl()} rel="noopener noreferrer" target="_blank">
          {SIGN_IN_COPY.help}
        </a>
      </footer>
    </div>
  );
}
