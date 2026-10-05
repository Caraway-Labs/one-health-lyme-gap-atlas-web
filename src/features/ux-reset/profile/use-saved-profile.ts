"use client";

import {
  CancelledError,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { SavedProfile } from "@/features/ux-reset/profile/default-jurisdiction-contract";
import {
  profileIdentityKey,
  sameProfileIdentity,
  useProfileSessionIdentity,
  type ProfileSessionIdentity,
} from "@/features/ux-reset/profile/profile-session";
import {
  accountHasPendingWrite,
  readSavedProfile,
  SavedProfileClientError,
  waitForAccountWrites,
} from "@/features/ux-reset/profile/saved-profile-client";

const savedProfileKeyRoot = "ux-reset-saved-profile";

export function savedProfileQueryKey(identity: ProfileSessionIdentity) {
  return [savedProfileKeyRoot, profileIdentityKey(identity)] as const;
}

export function savedProfileQueryRoot(): readonly [string] {
  return [savedProfileKeyRoot];
}

function isSupersededRead(error: unknown): boolean {
  return (
    error instanceof SavedProfileClientError && error.code === "superseded"
  );
}

async function readOrResumeSavedProfile(
  signal: AbortSignal,
  identity: ProfileSessionIdentity,
  queryClient: QueryClient
): Promise<SavedProfile> {
  const accountKey = profileIdentityKey(identity);
  try {
    return await readSavedProfile(signal, identity);
  } catch (error) {
    if (!isSupersededRead(error) || signal.aborted) {
      if (isSupersededRead(error)) {
        throw new CancelledError({ revert: true });
      }
      throw error;
    }
    if (queryClient.getQueryData(savedProfileQueryKey(identity))) {
      throw new CancelledError({ revert: true });
    }
    if (accountHasPendingWrite(accountKey)) {
      await waitForAccountWrites(accountKey);
    }
    if (signal.aborted) {
      throw new CancelledError({ revert: true });
    }
    try {
      return await readSavedProfile(signal, identity);
    } catch (retryError) {
      if (isSupersededRead(retryError)) {
        throw new CancelledError({ revert: true });
      }
      throw retryError;
    }
  }
}

export function useSavedProfile(): UseQueryResult<SavedProfile> & {
  identity: ProfileSessionIdentity | null;
  sessionRejected: boolean;
} {
  const identity = useProfileSessionIdentity();
  const queryClient = useQueryClient();
  const previousIdentity = useRef<ProfileSessionIdentity | null>(null);
  const [blockedKey, setBlockedKey] = useState<string | null>(null);
  const identityKey = identity ? profileIdentityKey(identity) : null;

  if (blockedKey && identityKey !== blockedKey) {
    setBlockedKey(null);
  }

  useEffect(() => {
    if (!identity) {
      return;
    }
    const previous = previousIdentity.current;
    previousIdentity.current = identity;
    if (previous && !sameProfileIdentity(previous, identity)) {
      const previousKey = savedProfileQueryKey(previous);
      void queryClient.cancelQueries({ queryKey: previousKey });
      queryClient.removeQueries({ queryKey: previousKey });
    }
  }, [identity, queryClient]);

  const sessionEnabled =
    identity?.kind === "user" || identity?.kind === "unconfigured";
  const query = useQuery({
    enabled: sessionEnabled && blockedKey !== identityKey,
    queryFn: async ({ signal }) => {
      if (!identity || identity.kind === "signed-out") {
        throw new CancelledError({ revert: true });
      }
      return await readOrResumeSavedProfile(signal, identity, queryClient);
    },
    queryKey: savedProfileQueryKey(identity ?? { kind: "signed-out" }),
    retry: false,
    staleTime: 60_000,
  });

  const unauthorized =
    query.error instanceof SavedProfileClientError &&
    query.error.code === "unauthorized";
  if (unauthorized && identityKey && blockedKey !== identityKey) {
    setBlockedKey(identityKey);
  }

  useEffect(() => {
    if (!identity || blockedKey !== profileIdentityKey(identity)) {
      return;
    }
    queryClient.removeQueries({ queryKey: savedProfileQueryKey(identity) });
  }, [blockedKey, identity, queryClient]);

  return {
    ...query,
    identity,
    sessionRejected: Boolean(identityKey) && blockedKey === identityKey,
  };
}
