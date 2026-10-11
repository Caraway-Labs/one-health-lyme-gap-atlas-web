"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { frontPorchHeroFont } from "@/features/front-porch/front-porch-font";
import { safeReturnPath } from "@/lib/auth/return-path";
import {
  SIGN_IN_COPY,
  emailConfirmRedirect,
  googleCallbackRedirect,
  signInCallbackErrorMessage,
  signInDeliveryErrorMessage,
  type AuthProviderFailure,
} from "@/lib/auth/sign-in-recovery";
import { getDocsUrl } from "@/lib/docs-config";
import { createClient } from "@/lib/supabase/client";

type AuthView = "request" | "confirmation";

function providerFailure(error: unknown): AuthProviderFailure {
  if (!error || typeof error !== "object") return {};
  const candidate = error as AuthProviderFailure;
  return {
    code: candidate.code,
    message: candidate.message,
    status: candidate.status,
  };
}

export function SignInIdentity() {
  return (
    <header className="auth-entrance-header">
      <span className="auth-entrance-brand atlas-sign-in-brand">
        <BrandMark size={28} />
        <span>{SIGN_IN_COPY.brand}</span>
      </span>
    </header>
  );
}

export function SignInEntrance() {
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));
  const callbackError = signInCallbackErrorMessage(searchParams.get("error"));
  const emailFieldId = useId();
  const explanationId = useId();
  const hintId = useId();
  const requestErrorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusToEmail = useRef(false);
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [view, setView] = useState<AuthView>("request");
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null
  );
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(
    null
  );
  const [statusVersion, setStatusVersion] = useState(0);

  useEffect(() => {
    if (view === "confirmation") {
      confirmationHeadingRef.current?.focus();
      return;
    }
    if (!returnFocusToEmail.current) return;
    returnFocusToEmail.current = false;
    emailRef.current?.focus();
  }, [view]);

  async function requestSignInLink(
    target: AuthView,
    address: string
  ): Promise<boolean> {
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: emailConfirmRedirect(window.location.origin, next),
      },
    });
    if (error) {
      const message = signInDeliveryErrorMessage(providerFailure(error));
      if (target === "confirmation") setConfirmationError(message);
      else setRequestError(message);
      return false;
    }
    return true;
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    setBusy(true);
    setRequestError(null);
    try {
      const sent = await requestSignInLink("request", address);
      if (!sent) return;
      setSubmittedEmail(address);
      setEmail(address);
      setConfirmationError(null);
      setConfirmationStatus(null);
      setView("confirmation");
    } catch {
      setRequestError(SIGN_IN_COPY.notConfigured);
    } finally {
      setBusy(false);
    }
  }

  async function resendLink() {
    if (!submittedEmail) return;
    setBusy(true);
    setConfirmationError(null);
    setConfirmationStatus(null);
    try {
      const sent = await requestSignInLink("confirmation", submittedEmail);
      if (!sent) return;
      setConfirmationStatus(SIGN_IN_COPY.confirmationBody);
      setStatusVersion((version) => version + 1);
    } catch {
      setConfirmationError(SIGN_IN_COPY.notConfigured);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setRequestError(null);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        options: {
          redirectTo: googleCallbackRedirect(window.location.origin, next),
        },
        provider: "google",
      });
      if (error) {
        const failure = providerFailure(error);
        setRequestError(
          failure.message === SIGN_IN_COPY.notConfigured
            ? SIGN_IN_COPY.notConfigured
            : SIGN_IN_COPY.googleUnavailable
        );
      }
    } catch {
      setRequestError(SIGN_IN_COPY.notConfigured);
    } finally {
      setBusy(false);
    }
  }

  function useDifferentEmail() {
    if (submittedEmail) setEmail(submittedEmail);
    returnFocusToEmail.current = true;
    setConfirmationError(null);
    setConfirmationStatus(null);
    setView("request");
  }

  const describedBy = [
    explanationId,
    hintId,
    requestError ? requestErrorId : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${frontPorchHeroFont.variable} auth-entrance`}>
      <SignInIdentity />
      <main className="auth-entrance-main">
        {view === "request" ? (
          <form className="auth-entrance-form" onSubmit={sendMagicLink}>
            <h1>{SIGN_IN_COPY.heading}</h1>
            <p className="auth-entrance-subtle">{SIGN_IN_COPY.purpose}</p>
            <label className="auth-entrance-label" htmlFor={emailFieldId}>
              {SIGN_IN_COPY.emailLabel}
            </label>
            <Input
              aria-describedby={describedBy}
              aria-invalid={requestError ? true : undefined}
              autoComplete="email"
              className="auth-entrance-input"
              id={emailFieldId}
              name="email"
              disabled={busy}
              onChange={(event) => {
                if (busy) return;
                setEmail(event.target.value);
              }}
              placeholder={SIGN_IN_COPY.emailPlaceholder}
              ref={emailRef}
              required
              type="email"
              value={email}
            />
            <p className="auth-entrance-subtle" id={explanationId}>
              {SIGN_IN_COPY.explanation}
            </p>
            <Button
              aria-busy={busy || undefined}
              className="auth-entrance-primary"
              disabled={busy}
              type="submit"
            >
              {busy ? SIGN_IN_COPY.sending : SIGN_IN_COPY.submit}
            </Button>
            <p className="auth-entrance-hint" id={hintId}>
              {SIGN_IN_COPY.passwordHint}
            </p>
            {requestError ? (
              <p
                className="auth-entrance-error"
                id={requestErrorId}
                role="alert"
              >
                {requestError}
              </p>
            ) : null}
            {callbackError ? (
              <p className="auth-entrance-error" role="alert">
                {callbackError}
              </p>
            ) : null}
            <div className="auth-entrance-separator">
              {SIGN_IN_COPY.separator}
            </div>
            <Button
              className="auth-entrance-google"
              disabled={busy}
              onClick={signInWithGoogle}
              type="button"
            >
              <Image
                alt=""
                className="auth-entrance-google-logo"
                height={20}
                src="/auth/google-g.svg"
                unoptimized
                width={20}
              />
              {SIGN_IN_COPY.google}
            </Button>
          </form>
        ) : (
          <section className="auth-entrance-form">
            <h1 ref={confirmationHeadingRef} tabIndex={-1}>
              {SIGN_IN_COPY.confirmationHeading}
            </h1>
            <p>{SIGN_IN_COPY.confirmationBody}</p>
            <div className="auth-entrance-actions">
              <Button
                aria-busy={busy || undefined}
                className="auth-entrance-secondary"
                disabled={busy}
                onClick={resendLink}
                type="button"
              >
                {busy ? SIGN_IN_COPY.sending : SIGN_IN_COPY.resend}
              </Button>
              <Button
                className="auth-entrance-quiet"
                disabled={busy}
                onClick={useDifferentEmail}
                type="button"
              >
                {SIGN_IN_COPY.changeEmail}
              </Button>
            </div>
            {confirmationError ? (
              <p className="auth-entrance-error" role="alert">
                {confirmationError}
              </p>
            ) : null}
            {confirmationStatus ? (
              <p
                aria-live="polite"
                className="auth-entrance-status"
                key={statusVersion}
                role="status"
              >
                {confirmationStatus}
              </p>
            ) : null}
          </section>
        )}
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
