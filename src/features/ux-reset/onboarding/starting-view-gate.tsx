"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import {
  WorkspaceConnectingScreen,
  WorkspaceReadinessRecovery,
} from "@/features/ux-reset/workspace-connecting-screen";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";

import { useSavedProfile } from "../profile/use-saved-profile";
import {
  isStartingViewComplete,
  STARTING_VIEW_PATH,
} from "./starting-view-completion";

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
      <WorkspaceReadinessRecovery
        kind="session-rejected"
        signInHref={signInHrefForReturnPath(returnPath)}
      />
    );
  }

  if (profile.isError) {
    return (
      <WorkspaceReadinessRecovery
        kind="error"
        onRetry={() => {
          void profile.refetch();
        }}
      />
    );
  }

  if (!profile.data || !complete) {
    return <WorkspaceConnectingScreen />;
  }

  return children;
}
