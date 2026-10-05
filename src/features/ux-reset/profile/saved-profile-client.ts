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
  type SavedProfile,
} from "./default-jurisdiction-contract";

export class SavedProfileClientError extends Error {
  readonly code: "read" | "superseded";

  constructor(code: "read" | "superseded") {
    super(savedProfileClientErrorMessage(code));
    this.name = "SavedProfileClientError";
    this.code = code;
  }
}

export type ProfileWriteOutcome =
  | { profile: SavedProfile; status: "confirmed" }
  | { message: string; status: "rejected" | "unconfirmed" }
  | { status: "superseded" };

function savedProfileClientErrorMessage(code: "read" | "superseded"): string {
  switch (code) {
    case "read": {
      return "Your profile is temporarily unavailable.";
    }
    case "superseded": {
      return "The profile read was superseded by a newer save.";
    }
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

const UNCONFIRMED_SAVE_MESSAGE =
  "We could not save your profile. Your edits are still here, and the saved default is unchanged.";

let writeEpoch = 0;

export function resetSavedProfileCoordinationForTests(): void {
  writeEpoch = 0;
}

export function profileWriteEpoch(): number {
  return writeEpoch;
}

function saveFailureMessage(error?: unknown): string {
  const reference =
    error instanceof AtlasApiError && error.requestId
      ? ` Reference: ${error.requestId}.`
      : "";
  return `${UNCONFIRMED_SAVE_MESSAGE}${reference}`;
}

export async function readSavedProfile(
  signal?: AbortSignal
): Promise<SavedProfile> {
  const epochAtStart = writeEpoch;
  try {
    const result = await getProfileV1MeProfileGet(
      signal ? { signal } : undefined
    );
    if (signal?.aborted || writeEpoch !== epochAtStart) {
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
    if (signal?.aborted || writeEpoch !== epochAtStart) {
      throw new SavedProfileClientError("superseded");
    }
    throw new SavedProfileClientError("read");
  }
}

export async function writeSavedProfile(
  body: UserProfileWrite
): Promise<ProfileWriteOutcome> {
  const parsedBody = UserProfileWriteSchema.safeParse(body);
  if (!parsedBody.success) {
    return {
      message:
        "Profile details are not valid. Your edits are still here, and the saved default is unchanged.",
      status: "rejected",
    };
  }
  writeEpoch += 1;
  const epoch = writeEpoch;
  try {
    const result = await saveProfileV1MeProfilePut(parsedBody.data);
    if (epoch !== writeEpoch) {
      return { status: "superseded" };
    }
    if (result.status !== 200) {
      return { message: saveFailureMessage(), status: "unconfirmed" };
    }
    const parsed = UserProfileResponseSchema.safeParse(result.data);
    if (!parsed.success) {
      return {
        message:
          "The profile service did not confirm that save. Your edits are still here, and the saved default is unchanged.",
        status: "unconfirmed",
      };
    }
    const saved = savedProfileFromUserProfile(parsed.data.profile);
    if (!profileEchoMatchesWrite(parsedBody.data, saved)) {
      return {
        message:
          "The profile service did not confirm that save. Your edits are still here, and the saved default is unchanged.",
        status: "unconfirmed",
      };
    }
    return { profile: saved, status: "confirmed" };
  } catch (error) {
    if (epoch !== writeEpoch) {
      return { status: "superseded" };
    }
    return { message: saveFailureMessage(error), status: "unconfirmed" };
  }
}
