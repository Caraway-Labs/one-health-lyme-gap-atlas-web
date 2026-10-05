"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountDataRights } from "@/components/account-data-rights";
import { Button } from "@/components/ui/button";
import { readProfileSessionIdentity } from "@/features/ux-reset/profile/profile-session";
import { savedProfileQueryRoot } from "@/features/ux-reset/profile/use-saved-profile";
import { createClient } from "@/lib/supabase/client";

const SIGN_OUT_STILL_ACTIVE =
  "Sign-out did not finish. This session is still active, and your saved profile was not changed.";

export function SettingsAccountControls() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  async function finishSignOut() {
    const identity = await readProfileSessionIdentity();
    if (identity.kind === "user") {
      setNotice(SIGN_OUT_STILL_ACTIVE);
      return;
    }
    queryClient.removeQueries({ queryKey: savedProfileQueryRoot() });
    router.push("/");
  }

  async function signOut() {
    setNotice(null);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) {
        await finishSignOut();
        return;
      }
      queryClient.removeQueries({ queryKey: savedProfileQueryRoot() });
      router.push("/");
    } catch {
      try {
        await finishSignOut();
      } catch {
        setNotice(
          "Sign-out is unavailable in this session. Your saved profile was not changed."
        );
      }
    }
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
