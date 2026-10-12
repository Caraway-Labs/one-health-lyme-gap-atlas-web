"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountDataRights } from "@/components/account-data-rights";
import { Button } from "@/components/ui/button";
import { endLocalAtlasSession } from "@/features/ux-reset/profile/end-local-session";

export function SettingsAccountControls() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  async function signOut() {
    setNotice(null);
    const result = await endLocalAtlasSession(queryClient);
    if (result.ok) {
      router.push("/");
      return;
    }
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
        className="mt-4"
        type="button"
        variant="secondary"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
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
