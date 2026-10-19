"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

import { useSavedProfile } from "../profile/use-saved-profile";
import {
  isStartingViewComplete,
  STARTING_VIEW_PATH,
} from "./starting-view-completion";

const COPY = {
  checking: "Checking your starting view…",
  retry: "Try again",
  signIn: "Sign in",
  unavailable:
    "We couldn’t load your starting view. Nothing was changed. Try again.",
  unsigned:
    "Your session expired. Sign in again before continuing. Nothing was changed.",
} as const;

/**
 * The requested URL stays in place until a profile read classifies the
 * account. Workspace actions render only after that read proves completion.
 * An incomplete account is sent to setup. A failed read stays recoverable.
 * A rejected session gets sign-in rather than the workspace.
 */
export function StartingViewGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useSavedProfile();
  const complete = isStartingViewComplete(profile.data);
  const search = searchParams.toString();
  const returnPath = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (profile.identity?.kind === "signed-out") {
      router.replace(signInHrefForReturnPath(returnPath));
      return;
    }
    if (profile.data && !complete) {
      router.replace(STARTING_VIEW_PATH);
    }
  }, [complete, profile.data, profile.identity, returnPath, router]);

  if (profile.sessionRejected) {
    return (
      <main className="app-content ux-reset-pro-main">
        <p role="alert">{COPY.unsigned}</p>
        <Link href={signInHrefForReturnPath(returnPath)}>{COPY.signIn}</Link>
      </main>
    );
  }

  if (profile.isError) {
    return (
      <main className="app-content ux-reset-pro-main">
        <p role="alert">{COPY.unavailable}</p>
        <Button
          onClick={() => {
            void profile.refetch();
          }}
          type="button"
        >
          {COPY.retry}
        </Button>
      </main>
    );
  }

  if (!profile.data || !complete) {
    return (
      <main className="app-content ux-reset-pro-main">
        <p aria-live="polite" role="status">
          {COPY.checking}
        </p>
      </main>
    );
  }

  return children;
}
