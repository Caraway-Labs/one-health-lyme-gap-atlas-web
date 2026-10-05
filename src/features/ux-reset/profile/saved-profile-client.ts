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
  readProfileSessionIdentity,
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
const UNCERTAIN_SAVE_MESSAGE =
  "We could not confirm that save. Your edits are still here. The last confirmed default stays in place until Atlas can check it.";
const DIVERGED_SAVE_MESSAGE =
  "The profile service stored a different profile from this edit. Your edits are still here.";

let activeWrites = 0;
let writeGeneration = 0;
let writeSerial = 0;
const latestWriteSerial = new Map<string, number>();
const writeTails = new Map<string, Promise<void>>();

export function resetSavedProfileCoordinationForTests(): void {
  activeWrites = 0;
  writeGeneration = 0;
  writeSerial = 0;
  latestWriteSerial.clear();
  writeTails.clear();
}

export function profileWriteEpoch(): number {
  return writeGeneration;
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
  generationAtStart: number,
  startedDuringWrite: boolean
): boolean {
  return (
    startedDuringWrite ||
    activeWrites > 0 ||
    writeGeneration !== generationAtStart
  );
}

export async function readSavedProfile(
  signal?: AbortSignal,
  expectedIdentity?: ProfileSessionIdentity
): Promise<SavedProfile> {
  const identityAtStart =
    expectedIdentity ?? (await readProfileSessionIdentity());
  const generationAtStart = writeGeneration;
  const startedDuringWrite = activeWrites > 0;
  try {
    const result = await getProfileV1MeProfileGet(
      signal ? { signal } : undefined
    );
    if (
      signal?.aborted ||
      readOverlapsWrite(generationAtStart, startedDuringWrite) ||
      !(await identityMatches(identityAtStart))
    ) {
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
      throw new SavedProfileClientError("unauthorized");
    }
    if (
      signal?.aborted ||
      readOverlapsWrite(generationAtStart, startedDuringWrite)
    ) {
      throw new SavedProfileClientError("superseded");
    }
    throw new SavedProfileClientError("read");
  }
}

async function reconcileUncertainWrite(
  body: UserProfileWrite,
  identity: ProfileSessionIdentity,
  lastConfirmed: SavedProfile | null,
  error?: unknown
): Promise<ProfileWriteOutcome> {
  try {
    const saved = await readSavedProfile(undefined, identity);
    if (profileEchoMatchesWrite(body, saved)) {
      return { profile: saved, status: "confirmed" };
    }
    if (lastConfirmed && savedProfilesMatch(saved, lastConfirmed)) {
      return {
        message: `${UNCHANGED_SAVE_MESSAGE}${referenceSuffix(error)}`,
        status: "unconfirmed",
      };
    }
    return {
      message: `${DIVERGED_SAVE_MESSAGE}${referenceSuffix(error)}`,
      profile: saved,
      status: "diverged",
    };
  } catch (reconcileError) {
    if (
      reconcileError instanceof SavedProfileClientError &&
      reconcileError.code === "unauthorized"
    ) {
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
  if (!(await identityMatches(identity))) {
    return { status: "superseded" };
  }
  if (latestWriteSerial.get(accountKey) !== serial) {
    return { status: "superseded" };
  }

  activeWrites += 1;
  writeGeneration += 1;
  let uncertainError: unknown;
  let parsedEcho: SavedProfile | null = null;
  let echoChecked = false;
  try {
    const result = await saveProfileV1MeProfilePut(body);
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
    activeWrites -= 1;
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
    return reconcileUncertainWrite(
      body,
      identity,
      lastConfirmed,
      uncertainError
    );
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
