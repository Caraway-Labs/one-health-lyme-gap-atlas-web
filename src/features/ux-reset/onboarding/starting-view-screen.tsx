"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { SignInIdentity } from "@/app/auth/sign-in/sign-in-entrance";
import { Button } from "@/components/ui/button";
import { frontPorchHeroFont } from "@/features/front-porch/front-porch-font";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";
import { SIGN_IN_COPY } from "@/lib/auth/sign-in-recovery";
import { getDocsUrl } from "@/lib/docs-config";

import type { SavedProfile } from "../profile/default-jurisdiction-contract";
import {
  profileIdentityKey,
  profileSessionGeneration,
  sameProfileIdentity,
  useProfileSessionIdentity,
} from "../profile/profile-session";
import { writeSavedProfile } from "../profile/saved-profile-client";
import { savedProfileQueryKey } from "../profile/use-saved-profile";
import { useSettingsStateOptions } from "../settings/use-settings-state-options";
import {
  buildStartingViewCompletionWrite,
  destinationAfterStartingView,
  STARTING_VIEW_PATH,
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
  loadingStates: "Loading the state list…",
  national: "United States",
  noStates: "No supported states are available. Nothing was saved.",
  prompt: "Where would you like Review to start?",
  saving: "Saving…",
  savingStatus: "Saving your starting view…",
  state: "One state",
  stateLabel: "State",
  statePlaceholder: "Select a state",
  retryStates: "Try loading states again",
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
  const queryClient = useQueryClient();
  const identity = useProfileSessionIdentity();
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
  const identityRef = useRef(identity);
  const mountedRef = useRef(true);
  identityRef.current = identity;
  const identityKey = identity ? profileIdentityKey(identity) : "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setChoice(null);
    setStateCode("");
    setError(null);
  }, [identityKey]);

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
    if (choice === "state" && states.stateList.status === "loading") {
      setError(COPY.loadingStates);
      return;
    }
    if (choice === "state" && states.stateList.status === "unavailable") {
      setError(COPY.statesUnavailable);
      return;
    }
    if (
      choice === "state" &&
      states.stateList.status === "ready" &&
      states.stateOptions.length === 0
    ) {
      setError(COPY.noStates);
      return;
    }
    if (choice === "state" && !stateCode) {
      setError(COPY.missingState);
      stateSelectRef.current?.focus();
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
    if (!identity || identity.kind === "signed-out") {
      router.replace(signInHrefForReturnPath(STARTING_VIEW_PATH));
      return;
    }
    setError(null);
    setPending(true);
    const requestedState = built.body.state_code ?? null;
    const boundIdentity = identity;
    const generation = profileSessionGeneration();
    try {
      const outcome = await writeSavedProfile(
        built.body,
        boundIdentity,
        profile
      );
      const sameAccount =
        mountedRef.current &&
        profileSessionGeneration() === generation &&
        identityRef.current !== null &&
        sameProfileIdentity(boundIdentity, identityRef.current);
      if (!sameAccount || outcome.status === "superseded") {
        return;
      }
      if (outcome.status === "unauthorized") {
        router.replace(signInHrefForReturnPath(STARTING_VIEW_PATH));
        return;
      }
      if (
        outcome.status === "confirmed" &&
        startingViewCompletionConfirmed(outcome.profile, requestedState)
      ) {
        queryClient.setQueryData(
          savedProfileQueryKey(boundIdentity),
          outcome.profile
        );
        router.replace(destinationAfterStartingView(outcome.profile, null));
        return;
      }
      setError(COPY.failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`${frontPorchHeroFont.variable} auth-entrance`}>
      <SignInIdentity />
      <main className="auth-entrance-main">
        <form className="auth-entrance-form" onSubmit={continueToReview}>
          <h1>{COPY.heading}</h1>
          <p className="auth-entrance-subtle" id={explanationId}>
            {COPY.explanation}
          </p>
          <fieldset
            aria-describedby={explanationId}
            disabled={pending || !identity}
          >
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
          {choice === "state" && states.stateList.status === "unavailable" ? (
            <Button
              className="auth-entrance-secondary"
              onClick={() => {
                void states.refetch();
              }}
              type="button"
            >
              {COPY.retryStates}
            </Button>
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
