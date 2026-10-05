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

export type BoundProfileSession = {
  accessToken: string | null;
  identity: ProfileSessionIdentity;
};

let observedIdentityKey = "";
let sessionGeneration = 0;

function noteProfileSessionIdentity(identity: ProfileSessionIdentity): void {
  const key = profileIdentityKey(identity);
  if (key === observedIdentityKey) {
    return;
  }
  observedIdentityKey = key;
  sessionGeneration += 1;
}

export function profileSessionGeneration(): number {
  return sessionGeneration;
}

export function resetProfileSessionGenerationForTests(): void {
  observedIdentityKey = "";
  sessionGeneration = 0;
}

export async function readBoundProfileSession(): Promise<BoundProfileSession> {
  try {
    const { data, error } = await createClient().auth.getSession();
    if (error || !data.session?.user.id) {
      return { accessToken: null, identity: { kind: "signed-out" } };
    }
    return {
      accessToken: data.session.access_token || null,
      identity: { kind: "user", userId: data.session.user.id },
    };
  } catch {
    return { accessToken: null, identity: { kind: "unconfigured" } };
  }
}

export async function readProfileSessionIdentity(): Promise<ProfileSessionIdentity> {
  const bound = await readBoundProfileSession();
  return bound.identity;
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
        const next = identityFromSession(session);
        noteProfileSessionIdentity(next);
        if (!cancelled) {
          setIdentity(next);
        }
      }
    );
    const loadSession = async () => {
      const { data: sessionData, error } = await client.auth.getSession();
      if (cancelled || listenerFired) {
        return;
      }
      const next = error
        ? { kind: "signed-out" as const }
        : identityFromSession(sessionData.session);
      noteProfileSessionIdentity(next);
      setIdentity(next);
    };
    void loadSession();
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return identity;
}
