"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type ProfileSessionIdentity =
  | { kind: "signed-out" }
  | { kind: "unconfigured" }
  | { kind: "user"; userId: string };

export function profileIdentityKey(identity: ProfileSessionIdentity): string {
  switch (identity.kind) {
    case "signed-out": {
      return "signed-out";
    }
    case "unconfigured": {
      return "unconfigured";
    }
    case "user": {
      return identity.userId;
    }
    default: {
      const exhaustive: never = identity;
      return exhaustive;
    }
  }
}

export function sameProfileIdentity(
  left: ProfileSessionIdentity,
  right: ProfileSessionIdentity
): boolean {
  return profileIdentityKey(left) === profileIdentityKey(right);
}

export async function readProfileSessionIdentity(): Promise<ProfileSessionIdentity> {
  try {
    const { data, error } = await createClient().auth.getSession();
    if (error || !data.session?.user.id) {
      return { kind: "signed-out" };
    }
    return { kind: "user", userId: data.session.user.id };
  } catch {
    return { kind: "unconfigured" };
  }
}

function identityFromSession(
  session: {
    user: { id: string };
  } | null
): ProfileSessionIdentity {
  const userId = session?.user.id;
  return userId ? { kind: "user", userId } : { kind: "signed-out" };
}

function browserProfileClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export function useProfileSessionIdentity(): ProfileSessionIdentity | null {
  const [client] = useState(browserProfileClient);
  const [identity, setIdentity] = useState<ProfileSessionIdentity | null>(
    client ? null : { kind: "unconfigured" }
  );

  useEffect(() => {
    if (!client) {
      return;
    }
    let cancelled = false;
    let listenerFired = false;
    const { data } = client.auth.onAuthStateChange(
      (_event: string, session: { user: { id: string } } | null) => {
        listenerFired = true;
        if (!cancelled) {
          setIdentity(identityFromSession(session));
        }
      }
    );
    const loadSession = async () => {
      const { data: sessionData, error } = await client.auth.getSession();
      if (cancelled || listenerFired) {
        return;
      }
      if (error) {
        setIdentity({ kind: "signed-out" });
        return;
      }
      setIdentity(identityFromSession(sessionData.session));
    };
    void loadSession();
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return identity;
}
