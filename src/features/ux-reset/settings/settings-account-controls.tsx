"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { AccountDataRights } from "@/components/account-data-rights";
import { Button } from "@/components/ui/button";
import { endLocalAtlasSession } from "@/features/ux-reset/profile/end-local-session";
import { followWorkspaceHref } from "@/features/ux-reset/workspace-navigation";
import {
  abortWorkspaceSignOut,
  beginWorkspaceSignOut,
  completeWorkspaceSignOut,
} from "@/features/ux-reset/workspace-sign-out";

const SIGN_OUT_LABEL = "Sign out";
const SIGNING_OUT_LABEL = "Signing out";

export function SettingsAccountControls() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  async function signOut() {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    const epoch = beginWorkspaceSignOut();
    const result = await endLocalAtlasSession(queryClient);
    if (result.ok) {
      completeWorkspaceSignOut(epoch);
      followWorkspaceHref("/");
      return;
    }
    abortWorkspaceSignOut(epoch);
    pendingRef.current = false;
    setPending(false);
    setNotice(result.notice);
  }

  return (
    <section aria-label="Account" data-testid="settings-account-controls">
      <h2 className="type-card">Account</h2>
      <p className="type-body">
        Sign out of this session. Export and removal use the existing account
        data-rights actions.
      </p>
      <Button
        aria-busy={pending || undefined}
        className="mt-4"
        disabled={pending}
        type="button"
        variant="secondary"
        onClick={() => {
          void signOut();
        }}
      >
        {pending ? SIGNING_OUT_LABEL : SIGN_OUT_LABEL}
      </Button>
      {notice ? (
        <p
          className="type-small"
          data-testid="settings-sign-out-notice"
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <AccountDataRights returnPath="/app/settings" />
    </section>
  );
}
