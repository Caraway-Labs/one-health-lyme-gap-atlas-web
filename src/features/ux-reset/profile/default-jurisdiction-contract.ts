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

export type StateListStatus =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; options: readonly AtlasStateOption[] };

export type ReviewStartSource =
  | "confirmed-default"
  | "national-fallback"
  | "pending";

export type ProfileAssessment = {
  completion: "complete" | "incomplete" | "unavailable";
  dataAttribute: string;
  reviewStart: { scope: "ALL" | string; source: ReviewStartSource };
  selection: DefaultJurisdiction;
  summary:
    | "confirmed"
    | "fallback"
    | "loading"
    | "metadata-unavailable"
    | "unsupported"
    | "unselected";
};

export function completionForSelection(
  selection: DefaultJurisdiction,
  stateList: StateListStatus
): DefaultJurisdictionCompletion {
  const assessed = assessSelection(selection, stateList);
  switch (assessed.completion) {
    case "complete": {
      if (
        assessed.selection.kind === "national" ||
        assessed.selection.kind === "state"
      ) {
        return { jurisdiction: assessed.selection, status: "complete" };
      }
      return { reason: "unrecognized", status: "incomplete" };
    }
    case "unavailable":
    case "incomplete": {
      return {
        reason:
          assessed.summary === "unselected" ? "unselected" : "unrecognized",
        status: "incomplete",
      };
    }
    default: {
      const exhaustive: never = assessed.completion;
      return exhaustive;
    }
  }
}

function nationalAssessment(): ProfileAssessment {
  return {
    completion: "complete",
    dataAttribute: "ALL",
    reviewStart: { scope: "ALL", source: "confirmed-default" },
    selection: { kind: "national" },
    summary: "confirmed",
  };
}

function assessStateSelection(
  stateCode: string,
  stateList: StateListStatus
): ProfileAssessment {
  switch (stateList.status) {
    case "loading": {
      return {
        completion: "unavailable",
        dataAttribute: "pending",
        reviewStart: { scope: "ALL", source: "pending" },
        selection: { kind: "state", stateCode },
        summary: "loading",
      };
    }
    case "unavailable": {
      return {
        completion: "unavailable",
        dataAttribute: "unverified",
        reviewStart: { scope: "ALL", source: "national-fallback" },
        selection: { kind: "state", stateCode },
        summary: "metadata-unavailable",
      };
    }
    case "ready": {
      if (isAtlasStateCode(stateCode, stateList.options)) {
        return {
          completion: "complete",
          dataAttribute: stateCode,
          reviewStart: { scope: stateCode, source: "confirmed-default" },
          selection: { kind: "state", stateCode },
          summary: "confirmed",
        };
      }
      return {
        completion: "incomplete",
        dataAttribute: "unrecognized",
        reviewStart: { scope: "ALL", source: "national-fallback" },
        selection: { kind: "unrecognized", stateCode },
        summary: "unsupported",
      };
    }
    default: {
      const exhaustive: never = stateList;
      return exhaustive;
    }
  }
}

export function assessSelection(
  selection: DefaultJurisdiction,
  stateList: StateListStatus
): ProfileAssessment {
  switch (selection.kind) {
    case "national": {
      return nationalAssessment();
    }
    case "state": {
      return assessStateSelection(selection.stateCode, stateList);
    }
    case "unselected": {
      return {
        completion: "incomplete",
        dataAttribute: "unselected",
        reviewStart: { scope: "ALL", source: "national-fallback" },
        selection,
        summary: "unselected",
      };
    }
    case "unrecognized": {
      return {
        completion: "incomplete",
        dataAttribute: "unrecognized",
        reviewStart: { scope: "ALL", source: "national-fallback" },
        selection,
        summary: "unsupported",
      };
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
}

export function assessSavedProfile(
  profile: SavedProfile,
  stateList: StateListStatus
): ProfileAssessment {
  return assessSelection(profile.selection, stateList);
}

export function savedProfileFromUserProfile(
  profile: UserProfile | null
): SavedProfile {
  const selection = mapDefaultJurisdiction(profile);
  return {
    completion: completionForSelection(selection, { status: "loading" }),
    jobTitle: normalizeOptionalText(profile?.job_title),
    organization: normalizeOptionalText(profile?.organization),
    role: profile?.role ?? null,
    selection,
  };
}

export function reviewStartForSelection(
  selection: DefaultJurisdiction,
  stateList: StateListStatus
): ProfileAssessment["reviewStart"] {
  return assessSelection(selection, stateList).reviewStart;
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

export function savedProfilesMatch(
  left: SavedProfile,
  right: SavedProfile
): boolean {
  return profileEchoMatchesWrite(
    {
      job_title: left.jobTitle,
      organization: left.organization,
      role: left.role,
      state_code: stateCodeFromSelection(left.selection),
    },
    right
  );
}

function stateCodeFromSelection(selection: DefaultJurisdiction): string | null {
  switch (selection.kind) {
    case "national":
    case "unselected": {
      return null;
    }
    case "state":
    case "unrecognized": {
      return selection.stateCode;
    }
    default: {
      const exhaustive: never = selection;
      return exhaustive;
    }
  }
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
