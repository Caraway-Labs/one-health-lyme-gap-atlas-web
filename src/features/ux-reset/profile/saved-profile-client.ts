"use client";

import {
  getProfileV1MeProfileGet,
  saveProfileV1MeProfilePut,
} from "@/generated/atlas";
import type { UserProfileWrite } from "@/generated/models";
import { UserProfileResponse as UserProfileResponseSchema } from "@/generated/zod/userProfileResponse.zod";
import { UserProfileWrite as UserProfileWriteSchema } from "@/generated/zod/userProfileWrite.zod";
import { AtlasApiError } from "@/lib/api-mutator";

import {
  profileEchoMatchesWrite,
  savedProfileFromUserProfile,
  savedProfilesMatch,
  type SavedProfile,
} from "./default-jurisdiction-contract";
import {
  profileIdentityKey,
  profileSessionGeneration,
  readBoundProfileSession,
  readProfileSessionIdentity,
  resetProfileSessionGenerationForTests,
  sameProfileIdentity,
  type ProfileSessionIdentity,
} from "./profile-session";

export class SavedProfileClientError extends Error {
  readonly code: "read" | "superseded" | "unauthorized";

  constructor(code: "read" | "superseded" | "unauthorized") {
    super(savedProfileClientErrorMessage(code));
    this.name = "SavedProfileClientError";
    this.code = code;
  }
}

export type ProfileWriteOutcome =
  | { profile: SavedProfile; status: "confirmed" }
  | {
      message: string;
      profile: SavedProfile;
      status: "diverged";
    }
  | { message: string; status: "rejected" | "unconfirmed" | "uncertain" }
  | { status: "superseded" | "unauthorized" };

const UNCHANGED_SAVE_MESSAGE =
  "We could not confirm that save. Your edits are still here, and the saved default is unchanged.";
export const UNCERTAIN_SAVE_MESSAGE =
  "We could not confirm that save. Your edits are still here. The last confirmed default stays in place until Atlas can check it.";
const DIVERGED_SAVE_MESSAGE =
  "The profile service stored a different profile from this edit. Your edits are still here.";

type AccountWriteCoordination = {
  activeWrites: number;
  generation: number;
};

const accountCoordination = new Map<string, AccountWriteCoordination>();
let writeSerial = 0;
const latestWriteSerial = new Map<string, number>();
const writeTails = new Map<string, Promise<void>>();

function coordinationFor(accountKey: string): AccountWriteCoordination {
  const existing = accountCoordination.get(accountKey);
  if (existing) {
    return existing;
  }
  const created = { activeWrites: 0, generation: 0 };
  accountCoordination.set(accountKey, created);
  return created;
}

export function resetSavedProfileCoordinationForTests(): void {
  accountCoordination.clear();
  writeSerial = 0;
  latestWriteSerial.clear();
  writeTails.clear();
  resetProfileSessionGenerationForTests();
}

export function profileWriteEpoch(accountKey: string): number {
  return accountCoordination.get(accountKey)?.generation ?? 0;
}

export function accountHasPendingWrite(accountKey: string): boolean {
  return (accountCoordination.get(accountKey)?.activeWrites ?? 0) > 0;
}

export function waitForAccountWrites(accountKey: string): Promise<void> {
  return writeTails.get(accountKey) ?? Promise.resolve();
}

function savedProfileClientErrorMessage(
  code: "read" | "superseded" | "unauthorized"
): string {
  switch (code) {
    case "read": {
      return "Your profile is temporarily unavailable.";
    }
    case "superseded": {
      return "The profile read was superseded by a newer save.";
    }
    case "unauthorized": {
      return "Your session expired. Sign in again before changing this profile.";
    }
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

function referenceSuffix(error?: unknown): string {
  const reference =
    error instanceof AtlasApiError && error.requestId
      ? ` Reference: ${error.requestId}.`
      : "";
  return reference;
}

async function settleTail(tail: Promise<boolean>): Promise<void> {
  try {
    await tail;
  } catch {
    // A failed save still releases the next save for this account.
  }
}

async function enqueueAccountWrite(
  accountKey: string,
  operation: () => Promise<ProfileWriteOutcome>
): Promise<ProfileWriteOutcome> {
  const previous = writeTails.get(accountKey) ?? Promise.resolve();
  const tail = Promise.withResolvers<boolean>();
  writeTails.set(accountKey, settleTail(tail.promise));
  try {
    await previous;
    return await operation();
  } finally {
    tail.resolve(true);
  }
}

async function identityMatches(
  expected: ProfileSessionIdentity
): Promise<boolean> {
  const current = await readProfileSessionIdentity();
  return sameProfileIdentity(expected, current);
}

function readOverlapsWrite(
  accountKey: string,
  generationAtStart: number,
  startedDuringWrite: boolean
): boolean {
  const state = accountCoordination.get(accountKey);
  const activeWrites = state?.activeWrites ?? 0;
  const generation = state?.generation ?? 0;
  return (
    startedDuringWrite || activeWrites > 0 || generation !== generationAtStart
  );
}

function readIsStale(
  signal: AbortSignal | undefined,
  accountKey: string,
  generationAtStart: number,
  startedDuringWrite: boolean
): boolean {
  return (
    Boolean(signal?.aborted) ||
    readOverlapsWrite(accountKey, generationAtStart, startedDuringWrite)
  );
}

function authGenerationMoved(authGenerationAtStart: number): boolean {
  return profileSessionGeneration() !== authGenerationAtStart;
}

export async function readSavedProfile(
  signal?: AbortSignal,
  expectedIdentity?: ProfileSessionIdentity
): Promise<SavedProfile> {
  const bound = await readBoundProfileSession();
  if (
    expectedIdentity &&
    !sameProfileIdentity(expectedIdentity, bound.identity)
  ) {
    throw new SavedProfileClientError("superseded");
  }
  if (bound.identity.kind === "user" && !bound.accessToken) {
    throw new SavedProfileClientError("unauthorized");
  }
  const identityAtStart = expectedIdentity ?? bound.identity;
  const authGenerationAtStart = profileSessionGeneration();
  const accountKey = profileIdentityKey(identityAtStart);
  const generationAtStart =
    accountCoordination.get(accountKey)?.generation ?? 0;
  const startedDuringWrite = accountHasPendingWrite(accountKey);
  const publishIsStale = () =>
    authGenerationMoved(authGenerationAtStart) ||
    readIsStale(signal, accountKey, generationAtStart, startedDuringWrite);
  try {
    const result = bound.accessToken
      ? await getProfileV1MeProfileGet({
          ...(signal ? { signal } : {}),
          headers: { Authorization: `Bearer ${bound.accessToken}` },
        })
      : await getProfileV1MeProfileGet(signal ? { signal } : undefined);
    if (publishIsStale()) {
      throw new SavedProfileClientError("superseded");
    }
    const identityStillMatches = await identityMatches(identityAtStart);
    if (publishIsStale() || !identityStillMatches) {
      throw new SavedProfileClientError("superseded");
    }
    if (result.status !== 200) {
      throw new SavedProfileClientError("read");
    }
    const parsed = UserProfileResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      throw new SavedProfileClientError("read");
    }
    return savedProfileFromUserProfile(parsed.data.profile);
  } catch (error) {
    if (error instanceof SavedProfileClientError) {
      throw error;
    }
    if (error instanceof AtlasApiError && error.status === 401) {
      if (authGenerationMoved(authGenerationAtStart)) {
        throw new SavedProfileClientError("superseded");
      }
      const identityStillMatches = await identityMatches(identityAtStart);
      if (authGenerationMoved(authGenerationAtStart) || !identityStillMatches) {
        throw new SavedProfileClientError("superseded");
      }
      throw new SavedProfileClientError("unauthorized");
    }
    if (publishIsStale()) {
      throw new SavedProfileClientError("superseded");
    }
    throw new SavedProfileClientError("read");
  }
}

async function reconcileUncertainWrite(
  body: UserProfileWrite,
  identity: ProfileSessionIdentity,
  error?: unknown
): Promise<ProfileWriteOutcome> {
  try {
    const saved = await readSavedProfile(undefined, identity);
    if (profileEchoMatchesWrite(body, saved)) {
      return { profile: saved, status: "confirmed" };
    }
    // A read of the previous profile cannot prove this attempt will not
    // commit later. The API has no version or idempotency key.
    return {
      message: `${UNCERTAIN_SAVE_MESSAGE}${referenceSuffix(error)}`,
      status: "uncertain",
    };
  } catch (reconcileError) {
    if (
      reconcileError instanceof SavedProfileClientError &&
      reconcileError.code === "unauthorized"
    ) {
      const current = await readBoundProfileSession();
      if (!sameProfileIdentity(identity, current.identity)) {
        return { status: "superseded" };
      }
      return { status: "unauthorized" };
    }
    return {
      message: `${UNCERTAIN_SAVE_MESSAGE}${referenceSuffix(error)}`,
      status: "uncertain",
    };
  }
}

async function performProfileWrite(
  body: UserProfileWrite,
  identity: ProfileSessionIdentity,
  accountKey: string,
  serial: number,
  lastConfirmed: SavedProfile | null
): Promise<ProfileWriteOutcome> {
  if (latestWriteSerial.get(accountKey) !== serial) {
    return { status: "superseded" };
  }
  const bound = await readBoundProfileSession();
  if (!sameProfileIdentity(identity, bound.identity)) {
    return { status: "superseded" };
  }
  if (bound.identity.kind === "user" && !bound.accessToken) {
    return { status: "unauthorized" };
  }
  if (latestWriteSerial.get(accountKey) !== serial) {
    return { status: "superseded" };
  }

  const coordination = coordinationFor(accountKey);
  coordination.activeWrites += 1;
  coordination.generation += 1;
  let uncertainError: unknown;
  let parsedEcho: SavedProfile | null = null;
  let echoChecked = false;
  try {
    const result = bound.accessToken
      ? await saveProfileV1MeProfilePut(body, {
          headers: { Authorization: `Bearer ${bound.accessToken}` },
        })
      : await saveProfileV1MeProfilePut(body);
    if (
      latestWriteSerial.get(accountKey) !== serial ||
      !(await identityMatches(identity))
    ) {
      return { status: "superseded" };
    }
    if (result.status === 200) {
      const parsed = UserProfileResponseSchema.safeParse(result.data);
      if (parsed.success) {
        parsedEcho = savedProfileFromUserProfile(parsed.data.profile);
        echoChecked = true;
      } else {
        uncertainError = new Error("Profile save response was not readable.");
      }
    } else {
      uncertainError = new AtlasApiError(
        "Profile save was not confirmed.",
        "/v1/me/profile",
        result.status,
        null
      );
    }
  } catch (error) {
    if (error instanceof AtlasApiError && error.status === 401) {
      const current = await readBoundProfileSession();
      if (!sameProfileIdentity(identity, current.identity)) {
        return { status: "superseded" };
      }
      return { status: "unauthorized" };
    }
    if (
      latestWriteSerial.get(accountKey) !== serial ||
      !(await identityMatches(identity))
    ) {
      return { status: "superseded" };
    }
    uncertainError = error;
  } finally {
    coordination.activeWrites -= 1;
  }

  if (latestWriteSerial.get(accountKey) !== serial) {
    return { status: "superseded" };
  }
  if (echoChecked && parsedEcho) {
    if (profileEchoMatchesWrite(body, parsedEcho)) {
      return { profile: parsedEcho, status: "confirmed" };
    }
    if (lastConfirmed && savedProfilesMatch(parsedEcho, lastConfirmed)) {
      return { message: UNCHANGED_SAVE_MESSAGE, status: "unconfirmed" };
    }
    return {
      message: DIVERGED_SAVE_MESSAGE,
      profile: parsedEcho,
      status: "diverged",
    };
  }
  if (uncertainError !== undefined || !echoChecked) {
    return reconcileUncertainWrite(body, identity, uncertainError);
  }
  return {
    message: UNCERTAIN_SAVE_MESSAGE,
    status: "uncertain",
  };
}

export async function writeSavedProfile(
  body: UserProfileWrite,
  expectedIdentity?: ProfileSessionIdentity,
  lastConfirmed: SavedProfile | null = null
): Promise<ProfileWriteOutcome> {
  const parsedBody = UserProfileWriteSchema.safeParse(body);
  if (!parsedBody.success) {
    return {
      message:
        "Profile details are not valid. Your edits are still here, and the saved default is unchanged.",
      status: "rejected",
    };
  }
  const identity = expectedIdentity ?? (await readProfileSessionIdentity());
  if (identity.kind === "signed-out") {
    return { status: "unauthorized" };
  }
  const accountKey = profileIdentityKey(identity);
  writeSerial += 1;
  const serial = writeSerial;
  latestWriteSerial.set(accountKey, serial);
  return enqueueAccountWrite(accountKey, () =>
    performProfileWrite(
      parsedBody.data,
      identity,
      accountKey,
      serial,
      lastConfirmed
    )
  );
}
