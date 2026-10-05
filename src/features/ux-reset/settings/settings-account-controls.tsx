"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountDataRights } from "@/components/account-data-rights";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SettingsAccountControls() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  async function signOut() {
    setNotice(null);
    try {
      await createClient().auth.signOut();
      router.push("/");
    } catch {
      setNotice(
        "Sign-out is unavailable in this session. Your saved profile was not changed."
      );
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
        <p className="type-small" role="status">
          {notice}
        </p>
      ) : null}
      <AccountDataRights />
    </section>
  );
}
