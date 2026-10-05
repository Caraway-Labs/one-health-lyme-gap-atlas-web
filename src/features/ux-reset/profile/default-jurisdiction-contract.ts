import type { UserProfile, UserProfileWrite } from "@/generated/models";
import type { UserProfileRole } from "@/generated/models/userProfileRole";
import type { UserProfileWriteRole } from "@/generated/models/userProfileWriteRole";
import {
  userProfileWriteJobTitleOneMax,
  userProfileWriteOrganizationOneMax,
} from "@/generated/zod/userProfileWrite.zod";
import {
  type AtlasStateOption,
  isAtlasStateCode,
} from "@/lib/atlas-state-geography";

/**
 * Approved mapping for GET/PUT `/v1/me/profile`.
 * See docs/ux-reset-profile-default-jurisdiction.md.
 * `null` profile is unselected. A profile object with null or omitted
 * `state_code` is an explicit national default. There is no national sentinel
 * and no separate completion field in the generated schema.
 */
export type DefaultJurisdiction =
  | { kind: "unselected" }
  | { kind: "national" }
  | { kind: "state"; stateCode: string }
  | { kind: "unrecognized"; stateCode: string };

export type DefaultJurisdictionCompletion =
  | {
      jurisdiction: Extract<
        DefaultJurisdiction,
        { kind: "national" | "state" }
      >;
      status: "complete";
    }
  | { reason: "unselected" | "unrecognized"; status: "incomplete" };

export type SavedProfile = {
  completion: DefaultJurisdictionCompletion;
  jobTitle: string | null;
  organization: string | null;
  role: UserProfileRole | null;
  selection: DefaultJurisdiction;
};

export type ProfileDraftInput = {
  jobTitle: string;
  jurisdiction: "unset" | "national" | { stateCode: string };
  organization: string;
  role: UserProfileWriteRole | null;
};

export type ProfileWriteBuild =
  | { body: UserProfileWrite; message?: undefined; ok: true }
  | { body?: undefined; message: string; ok: false };

const POSTAL_STATE_CODE = /^[A-Z]{2}$/;

export function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function mapDefaultJurisdiction(
  profile: UserProfile | null
): DefaultJurisdiction {
  if (profile === null) {
    return { kind: "unselected" };
  }
  if (profile.state_code == null) {
    return { kind: "national" };
  }
  const code = profile.state_code.trim().toUpperCase();
  if (POSTAL_STATE_CODE.test(code)) {
    return { kind: "state", stateCode: code };
  }
  return { kind: "unrecognized", stateCode: profile.state_code };
}

export function completionForSelection(
  selection: DefaultJurisdiction
): DefaultJurisdictionCompletion {
  switch (selection.kind) {
    case "national": {
      return { jurisdiction: selection, status: "complete" };
    }
    case "state": {
      return { jurisdiction: selection, status: "complete" };
    }
    case "unselected": {
      return { reason: "unselected", status: "incomplete" };
    }
    case "unrecognized": {
      return { reason: "unrecognized", status: "incomplete" };
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
}

export function savedProfileFromUserProfile(
  profile: UserProfile | null
): SavedProfile {
  const selection = mapDefaultJurisdiction(profile);
  return {
    completion: completionForSelection(selection),
    jobTitle: normalizeOptionalText(profile?.job_title),
    organization: normalizeOptionalText(profile?.organization),
    role: profile?.role ?? null,
    selection,
  };
}

export type ReviewStartSource = "confirmed-default" | "national-fallback";

export function reviewStartForSelection(
  selection: DefaultJurisdiction,
  stateOptions: readonly AtlasStateOption[] | null
): { scope: "ALL" | string; source: ReviewStartSource } {
  switch (selection.kind) {
    case "national": {
      return { scope: "ALL", source: "confirmed-default" };
    }
    case "state": {
      if (
        stateOptions === null ||
        stateOptions.length === 0 ||
        isAtlasStateCode(selection.stateCode, stateOptions)
      ) {
        return { scope: selection.stateCode, source: "confirmed-default" };
      }
      return { scope: "ALL", source: "national-fallback" };
    }
    case "unselected":
    case "unrecognized": {
      return { scope: "ALL", source: "national-fallback" };
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
}

function stateCodeForDraft(
  jurisdiction: ProfileDraftInput["jurisdiction"],
  stateOptions: readonly AtlasStateOption[]
): { message: string; ok: false } | { ok: true; stateCode: string | null } {
  if (jurisdiction === "unset") {
    return {
      message:
        "Choose United States or a state before saving. Optional role, organization, and job title can stay empty. Nothing was saved.",
      ok: false,
    };
  }
  if (jurisdiction === "national") {
    return { ok: true, stateCode: null };
  }
  const code = jurisdiction.stateCode.trim().toUpperCase();
  if (!isAtlasStateCode(code, stateOptions)) {
    return {
      message:
        "Choose a state from the current Atlas list, or United States. Nothing was saved.",
      ok: false,
    };
  }
  return { ok: true, stateCode: code };
}

function optionalTextWithinLimit(
  value: string,
  maxLength: number,
  label: string
): string | null {
  const normalized = normalizeOptionalText(value);
  if (normalized && normalized.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer. Nothing was saved.`;
  }
  return null;
}

export function buildProfileWrite(
  draft: ProfileDraftInput,
  stateOptions: readonly AtlasStateOption[]
): ProfileWriteBuild {
  const organizationError = optionalTextWithinLimit(
    draft.organization,
    userProfileWriteOrganizationOneMax,
    "Organization"
  );
  if (organizationError) {
    return { message: organizationError, ok: false };
  }
  const jobTitleError = optionalTextWithinLimit(
    draft.jobTitle,
    userProfileWriteJobTitleOneMax,
    "Job title"
  );
  if (jobTitleError) {
    return { message: jobTitleError, ok: false };
  }

  const stateCodeResult = stateCodeForDraft(draft.jurisdiction, stateOptions);
  if (!stateCodeResult.ok) {
    return stateCodeResult;
  }
  const { stateCode } = stateCodeResult;

  return {
    body: {
      job_title: normalizeOptionalText(draft.jobTitle),
      organization: normalizeOptionalText(draft.organization),
      role: draft.role,
      state_code: stateCode,
    },
    ok: true,
  };
}

export function profileEchoMatchesWrite(
  body: UserProfileWrite,
  saved: SavedProfile
): boolean {
  const requested = mapDefaultJurisdiction({
    job_title: body.job_title,
    organization: body.organization,
    role: body.role,
    state_code: body.state_code ?? null,
  });
  const selectionMatches =
    (requested.kind === "national" && saved.selection.kind === "national") ||
    (requested.kind === "state" &&
      saved.selection.kind === "state" &&
      saved.selection.stateCode === requested.stateCode);
  return (
    selectionMatches &&
    (saved.role ?? null) === (body.role ?? null) &&
    saved.organization === normalizeOptionalText(body.organization) &&
    saved.jobTitle === normalizeOptionalText(body.job_title)
  );
}
