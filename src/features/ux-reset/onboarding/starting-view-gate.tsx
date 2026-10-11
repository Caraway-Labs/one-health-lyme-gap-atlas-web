"use client";

import { useRouter } from "next/navigation";
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
  unavailable:
    "We couldn’t load your starting view. Nothing was changed. Try again.",
} as const;

/**
 * Incomplete accounts leave the workspace for setup. A read that is still in
 * flight keeps the requested workspace. A failed profile read stays
 * recoverable and does not open setup.
 */
export function StartingViewGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const profile = useSavedProfile();
  const complete = isStartingViewComplete(profile.data);

  useEffect(() => {
    if (profile.identity?.kind === "signed-out") {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(signInHrefForReturnPath(next));
      return;
    }
    if (profile.data && !complete) {
      router.replace(STARTING_VIEW_PATH);
    }
  }, [complete, profile.data, profile.identity, router]);

  if (profile.isError && !profile.sessionRejected) {
    return (
      <div className="app-content ux-reset-pro-main">
        <p role="alert">{COPY.unavailable}</p>
        <Button
          onClick={() => {
            void profile.refetch();
          }}
          type="button"
        >
          {COPY.retry}
        </Button>
      </div>
    );
  }

  // The shell already owns the main landmark. Keep an explicit destination
  // usable until a read proves the account is incomplete.
  if (profile.data && !complete) {
    return (
      <div className="app-content ux-reset-pro-main">
        <p aria-live="polite" role="status">
          {COPY.checking}
        </p>
      </div>
    );
  }

  return children;
}
