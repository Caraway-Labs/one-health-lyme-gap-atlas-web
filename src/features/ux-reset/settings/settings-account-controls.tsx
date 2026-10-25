"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";

import { AccountDataRights } from "@/components/account-data-rights";
import { Button } from "@/components/ui/button";
import { followWorkspaceHref } from "@/features/ux-reset/workspace-navigation";
import {
  runWorkspaceSignOut,
  subscribeWorkspaceSignOut,
  workspaceSignOutPending,
} from "@/features/ux-reset/workspace-sign-out";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";

const SIGN_OUT_LABEL = "Sign out";
const SIGNING_OUT_LABEL = "Signing out";

export function SettingsAccountControls() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useSyncExternalStore(
    subscribeWorkspaceSignOut,
    workspaceSignOutPending,
    () => false
  );

  async function signOut() {
    const result = await runWorkspaceSignOut(queryClient);
    if (result === null) {
      return;
    }
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setNotice(null);
    followWorkspaceHref("/");
  }

  return (
    <section aria-label="Account" data-testid="settings-account-controls">
      <h2 className="type-card">Account</h2>
      <p className="type-body">
        Sign out of this session. Export and removal use the existing account
        data-rights actions.
      </p>
      <Button
        {...analyticsControlAttributes("workspace_sign_out")}
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
