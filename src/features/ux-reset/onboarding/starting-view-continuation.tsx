"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { SignInIdentity } from "@/app/auth/sign-in/sign-in-entrance";
import { Button } from "@/components/ui/button";
import { frontPorchHeroFont } from "@/features/front-porch/front-porch-font";
import { WorkspaceConnectingScreen } from "@/features/ux-reset/workspace-connecting-screen";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";
import { SIGN_IN_COPY } from "@/lib/auth/sign-in-recovery";
import { getDocsUrl } from "@/lib/docs-config";

import { useSavedProfile } from "../profile/use-saved-profile";
import {
  destinationAfterStartingView,
  isStartingViewComplete,
  STARTING_VIEW_CONTINUE_PATH,
  STARTING_VIEW_PATH,
} from "./starting-view-completion";

const COPY = {
  retry: "Try again",
  signIn: "Sign in",
  unavailable:
    "We couldn’t load your starting view. Nothing was changed. Try again.",
  unsigned:
    "Your session expired. Sign in again before continuing. Nothing was changed.",
} as const;

export function EntranceStatus({
  action,
  message,
  tone = "status",
}: {
  action?: ReactNode;
  message: string;
  tone?: "alert" | "status";
}) {
  return (
    <div className={`${frontPorchHeroFont.variable} auth-entrance`}>
      <SignInIdentity />
      <main className="auth-entrance-main">
        <section className="auth-entrance-form">
          <h1>Choose your starting view</h1>
          <p aria-live={tone === "alert" ? "assertive" : "polite"} role={tone}>
            {message}
          </p>
          {action}
        </section>
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

/** Post-authentication branch. A profile-read failure stays here and retries. */
export function StartingViewContinuation({
  requested,
}: {
  requested: string | null;
}) {
  const router = useRouter();
  const profile = useSavedProfile();

  useEffect(() => {
    if (profile.identity?.kind === "signed-out") {
      const next = requested
        ? `${STARTING_VIEW_CONTINUE_PATH}?next=${encodeURIComponent(requested)}`
        : STARTING_VIEW_CONTINUE_PATH;
      router.replace(signInHrefForReturnPath(next));
      return;
    }
    if (!profile.data) {
      return;
    }
    if (!isStartingViewComplete(profile.data)) {
      router.replace(STARTING_VIEW_PATH);
      return;
    }
    router.replace(destinationAfterStartingView(profile.data, requested));
  }, [profile.data, profile.identity, requested, router]);

  if (profile.sessionRejected) {
    const next = requested
      ? `${STARTING_VIEW_CONTINUE_PATH}?next=${encodeURIComponent(requested)}`
      : STARTING_VIEW_CONTINUE_PATH;
    return (
      <EntranceStatus
        action={
          <Link
            className="auth-entrance-primary"
            href={signInHrefForReturnPath(next)}
          >
            {COPY.signIn}
          </Link>
        }
        message={COPY.unsigned}
        tone="alert"
      />
    );
  }

  if (profile.isError) {
    return (
      <EntranceStatus
        action={
          <Button
            className="auth-entrance-primary"
            onClick={() => {
              void profile.refetch();
            }}
            type="button"
          >
            {COPY.retry}
          </Button>
        }
        message={COPY.unavailable}
        tone="alert"
      />
    );
  }

  return <WorkspaceConnectingScreen />;
}
