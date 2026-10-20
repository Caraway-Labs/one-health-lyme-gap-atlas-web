"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assessSavedProfile,
  buildProfileWrite,
  profileEchoMatchesWrite,
  savedProfileFromUserProfile,
  savedProfilesMatch,
  type ProfileAssessment,
  type ProfileDraftInput,
  type SavedProfile,
} from "@/features/ux-reset/profile/default-jurisdiction-contract";
import {
  profileIdentityKey,
  profileSessionGeneration,
  type ProfileSessionIdentity,
} from "@/features/ux-reset/profile/profile-session";
import {
  UNCERTAIN_SAVE_MESSAGE,
  writeSavedProfile,
} from "@/features/ux-reset/profile/saved-profile-client";
import {
  savedProfileQueryKey,
  useSavedProfile,
} from "@/features/ux-reset/profile/use-saved-profile";
import { useSettingsStateOptions } from "@/features/ux-reset/settings/use-settings-state-options";
import type { UserProfileWrite } from "@/generated/models/userProfileWrite";
import type { UserProfileWriteRole } from "@/generated/models/userProfileWriteRole";
import {
  userProfileWriteJobTitleMax,
  userProfileWriteOrganizationMax,
} from "@/generated/zod/userProfileWrite.zod";
import {
  type AtlasStateOption,
  reviewScopeLabel,
} from "@/lib/atlas-state-geography";

const ROLE_UNSET = "unspecified";

const PROFILE_ROLES: {
  label: string;
  value: Exclude<UserProfileWriteRole, null>;
}[] = [
  { label: "General public citizen", value: "general_public_citizen" },
  {
    label: "District-level epidemiologist",
    value: "district_level_epidemiologist",
  },
  { label: "State-level epidemiologist", value: "state_level_epidemiologist" },
  {
    label: "State director-level epidemiologist",
    value: "state_director_level_epidemiologist",
  },
  {
    label: "National-level epidemiologist",
    value: "national_level_epidemiologist",
  },
];

type SaveNotice = { text: string; tone: "error" | "success" };

type UnresolvedSave = { body: UserProfileWrite; message: string };

function sameProfileWrite(
  left: UserProfileWrite,
  right: UserProfileWrite
): boolean {
  return profileEchoMatchesWrite(
    left,
    savedProfileFromUserProfile({
      job_title: right.job_title ?? null,
      organization: right.organization ?? null,
      role: right.role ?? null,
      state_code: right.state_code ?? null,
    })
  );
}

function writeFromSaved(profile: SavedProfile): UserProfileWrite {
  switch (profile.selection.kind) {
    case "national":
    case "unselected": {
      return {
        job_title: profile.jobTitle,
        organization: profile.organization,
        role: profile.role,
        state_code: null,
      };
    }
    case "state":
    case "unrecognized": {
      return {
        job_title: profile.jobTitle,
        organization: profile.organization,
        role: profile.role,
        state_code: profile.selection.stateCode,
      };
    }
    default: {
      const exhaustive: never = profile.selection;
      return exhaustive;
    }
  }
}

function governedAssessmentKey(assessment: ProfileAssessment): string {
  switch (assessment.selection.kind) {
    case "national":
    case "unselected": {
      return `${assessment.summary}:${assessment.selection.kind}`;
    }
    case "state":
    case "unrecognized": {
      return `${assessment.summary}:${assessment.selection.kind}:${assessment.selection.stateCode}`;
    }
    default: {
      const exhaustive: never = assessment.selection;
      return exhaustive;
    }
  }
}

function formValuesFromAssessment(
  profile: SavedProfile,
  assessment: ProfileAssessment
): ProfileDraftInput {
  if (
    assessment.summary === "confirmed" &&
    assessment.selection.kind === "state"
  ) {
    return draftFromSelection(profile, {
      stateCode: assessment.selection.stateCode,
    });
  }
  if (assessment.selection.kind === "national") {
    return draftFromSelection(profile, "national");
  }
  return draftFromSelection(profile, "unset");
}

function formValuesFromSavedProfile(
  profile: SavedProfile,
  stateOptions: readonly AtlasStateOption[]
): ProfileDraftInput {
  return formValuesFromAssessment(
    profile,
    assessSavedProfile(profile, { options: stateOptions, status: "ready" })
  );
}

function draftFromSelection(
  profile: SavedProfile,
  jurisdiction: ProfileDraftInput["jurisdiction"]
): ProfileDraftInput {
  return {
    jobTitle: profile.jobTitle ?? "",
    jurisdiction,
    organization: profile.organization ?? "",
    role: profile.role,
  };
}

function jurisdictionLabel(
  jurisdiction: ProfileDraftInput["jurisdiction"],
  stateOptions: readonly AtlasStateOption[]
): string | null {
  if (jurisdiction === "unset") {
    return null;
  }
  if (jurisdiction === "national") {
    return "United States";
  }
  return reviewScopeLabel(jurisdiction.stateCode, stateOptions);
}

function jurisdictionFromSelectValue(
  value: string
): ProfileDraftInput["jurisdiction"] {
  if (value === "ALL") {
    return "national";
  }
  return { stateCode: value };
}

function roleFromSelectValue(value: string): UserProfileWriteRole | null {
  const match = PROFILE_ROLES.find((role) => role.value === value);
  return match ? match.value : null;
}

function roleLabel(role: UserProfileWriteRole | null): string {
  const match = PROFILE_ROLES.find((option) => option.value === role);
  return match ? match.label : "Prefer not to say";
}

const STARTING_VIEW_SAVED =
  "Starting view saved. It will apply the next time you open Atlas Explorer without a specific view.";

const STARTING_VIEW_OPTION_CLASS =
  "border-input has-[:checked]:border-ring has-[:checked]:bg-accent flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm font-medium";

export function SettingsProfileForm() {
  const profileQuery = useSavedProfile();
  const metadataQuery = useSettingsStateOptions();
  const queryClient = useQueryClient();
  const profile = profileQuery.data;
  const identity = profileQuery.identity;
  const identityKey = identity ? profileIdentityKey(identity) : null;
  const [draft, setDraft] = useState<ProfileDraftInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [synced, setSynced] = useState<SavedProfile | null>(null);
  const [syncedAssessmentKey, setSyncedAssessmentKey] = useState<string | null>(
    null
  );
  const [boundKey, setBoundKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [jurisdictionInvalid, setJurisdictionInvalid] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [unresolvedSave, setUnresolvedSave] = useState<UnresolvedSave | null>(
    null
  );
  const [announcedProfile, setAnnouncedProfile] = useState<SavedProfile | null>(
    null
  );
  const requestIdRef = useRef(0);
  const [rememberedStateCode, setRememberedStateCode] = useState("");
  const [draftIdentityKey, setDraftIdentityKey] = useState<string | null>(null);

  if (identityKey && identityKey !== boundKey) {
    setRememberedStateCode("");
    setBoundKey(identityKey);
    setDraft(null);
    setDirty(false);
    setSynced(null);
    setSyncedAssessmentKey(null);
    setNotice(null);
    setSaving(false);
    setSessionExpired(false);
    setUnresolvedSave(null);
    setAnnouncedProfile(null);
    setDraftIdentityKey(null);
    return null;
  }

  if (
    announcedProfile &&
    profile &&
    !savedProfilesMatch(announcedProfile, profile)
  ) {
    setAnnouncedProfile(null);
    setDirty(true);
    if (!unresolvedSave) {
      setUnresolvedSave({
        body: writeFromSaved(announcedProfile),
        message: UNCERTAIN_SAVE_MESSAGE,
      });
    }
    setNotice({ text: UNCERTAIN_SAVE_MESSAGE, tone: "error" });
    return null;
  }

  if (profileQuery.sessionRejected || sessionExpired) {
    if (draft || dirty || rememberedStateCode) {
      setRememberedStateCode("");
      setDraft(null);
      setDirty(false);
      setSynced(null);
    }
    return (
      <p data-testid="settings-session-expired" role="alert">
        Your session expired. Sign in again before changing this profile.
      </p>
    );
  }

  const stateList = metadataQuery.stateList;
  const waitingForStateList =
    stateList.status === "loading" && profile?.selection.kind === "state";
  const assessment =
    profile && !waitingForStateList
      ? assessSavedProfile(profile, stateList)
      : null;
  const assessmentKey = assessment ? governedAssessmentKey(assessment) : null;
  if (
    assessment &&
    profile &&
    identityKey &&
    assessmentKey &&
    !dirty &&
    (profile !== synced || assessmentKey !== syncedAssessmentKey)
  ) {
    setSynced(profile);
    setSyncedAssessmentKey(assessmentKey);
    setDraft(formValuesFromAssessment(profile, assessment));
    setDraftIdentityKey(identityKey);
  }

  if (!profile || !draft || !identity || waitingForStateList) {
    return null;
  }

  const confirmed = profile;
  const currentDraft = draft;
  const stateOptions = metadataQuery.stateOptions;
  const selectOptions = stateOptions;

  function listedStateCode(code: string): string {
    return selectOptions.some((state) => state.code === code) ? code : "";
  }

  function stateCodeForOneStateChoice(): string {
    const remembered = listedStateCode(rememberedStateCode);
    if (remembered) {
      return remembered;
    }
    if (confirmed.selection.kind === "state") {
      return listedStateCode(confirmed.selection.stateCode);
    }
    return "";
  }

  function updateDraft(next: ProfileDraftInput) {
    setDirty(true);
    if (!unresolvedSave) {
      setNotice(null);
    }
    setJurisdictionInvalid(false);
    setDraft(next);
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!identity || draftIdentityKey !== identityKey) {
      setNotice({
        text: "This profile changed sessions. Nothing was saved.",
        tone: "error",
      });
      return;
    }
    const built = buildProfileWrite(currentDraft, stateOptions);
    if (!built.ok) {
      const missingState =
        typeof currentDraft.jurisdiction === "object" &&
        currentDraft.jurisdiction.stateCode.trim() === "";
      setJurisdictionInvalid(
        currentDraft.jurisdiction === "unset" || missingState
      );
      setNotice({ text: built.message, tone: "error" });
      return;
    }
    void saveDraft(built.body, requestId, identity, confirmed);
  };

  const saveDraft = async (
    body: Parameters<typeof writeSavedProfile>[0],
    requestId: number,
    saveIdentity: ProfileSessionIdentity,
    lastConfirmed: SavedProfile
  ) => {
    const generationAtSave = profileSessionGeneration();
    setSaving(true);
    if (!unresolvedSave) {
      setNotice(null);
    }
    await queryClient.cancelQueries({
      queryKey: savedProfileQueryKey(saveIdentity),
    });
    const outcome = await writeSavedProfile(body, saveIdentity, lastConfirmed);
    if (requestId !== requestIdRef.current) {
      return;
    }
    if (generationAtSave !== profileSessionGeneration()) {
      setSaving(false);
      return;
    }
    setSaving(false);
    const retrySettlesUnresolved =
      unresolvedSave === null || sameProfileWrite(unresolvedSave.body, body);
    switch (outcome.status) {
      case "confirmed": {
        if (!retrySettlesUnresolved) {
          setNotice({
            text: unresolvedSave?.message ?? UNCERTAIN_SAVE_MESSAGE,
            tone: "error",
          });
          break;
        }
        setUnresolvedSave(null);
        setAnnouncedProfile(outcome.profile);
        setDirty(false);
        setSynced(outcome.profile);
        setDraft(formValuesFromSavedProfile(outcome.profile, stateOptions));
        queryClient.setQueryData(
          savedProfileQueryKey(saveIdentity),
          outcome.profile
        );
        setNotice({
          text: STARTING_VIEW_SAVED,
          tone: "success",
        });
        break;
      }
      case "diverged": {
        if (!retrySettlesUnresolved) {
          setNotice({
            text: unresolvedSave?.message ?? UNCERTAIN_SAVE_MESSAGE,
            tone: "error",
          });
          break;
        }
        setUnresolvedSave(null);
        setSynced(outcome.profile);
        queryClient.setQueryData(
          savedProfileQueryKey(saveIdentity),
          outcome.profile
        );
        setNotice({ text: outcome.message, tone: "error" });
        break;
      }
      case "superseded": {
        break;
      }
      case "unauthorized": {
        setDraft(null);
        setDirty(false);
        setSynced(null);
        setUnresolvedSave(null);
        setAnnouncedProfile(null);
        setSessionExpired(true);
        queryClient.removeQueries({
          queryKey: savedProfileQueryKey(saveIdentity),
        });
        break;
      }
      case "rejected": {
        setNotice({ text: outcome.message, tone: "error" });
        break;
      }
      case "unconfirmed": {
        if (!retrySettlesUnresolved) {
          setNotice({
            text: unresolvedSave?.message ?? UNCERTAIN_SAVE_MESSAGE,
            tone: "error",
          });
          break;
        }
        setUnresolvedSave(null);
        setNotice({ text: outcome.message, tone: "error" });
        break;
      }
      case "uncertain": {
        const retained = unresolvedSave ?? {
          body,
          message: outcome.message,
        };
        if (!unresolvedSave) {
          setUnresolvedSave(retained);
        }
        setNotice({ text: retained.message, tone: "error" });
        break;
      }
      default: {
        const exhaustive: never = outcome;
        throw new Error(
          `Unexpected profile save outcome: ${String(exhaustive)}`
        );
      }
    }
  };

  return (
    <form data-testid="settings-profile-form" onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <h2 className="type-card">Edit profile</h2>
          <CardDescription>
            Starting view is required. Role, organization, and job title are
            optional. Leaving them empty does not block Review or the rest of
            the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          {metadataQuery.isError ? (
            <p className="type-small" role="status">
              The state list is temporarily unavailable. You can still save
              United States. A state default can be saved again after the list
              returns.
            </p>
          ) : null}
          <fieldset
            aria-describedby="starting-view-hint"
            aria-invalid={
              jurisdictionInvalid && currentDraft.jurisdiction === "unset"
                ? true
                : undefined
            }
            className="grid gap-3"
            disabled={saving}
          >
            <legend className="text-sm font-medium">Starting view</legend>
            <div className="grid gap-2">
              <label className={STARTING_VIEW_OPTION_CLASS}>
                <input
                  checked={currentDraft.jurisdiction === "national"}
                  className="accent-primary size-4 shrink-0"
                  name="starting-view"
                  onChange={() => {
                    updateDraft({ ...draft, jurisdiction: "national" });
                  }}
                  type="radio"
                  value="national"
                />
                United States
              </label>
              <label className={STARTING_VIEW_OPTION_CLASS}>
                <input
                  checked={typeof currentDraft.jurisdiction === "object"}
                  className="accent-primary size-4 shrink-0"
                  name="starting-view"
                  onChange={() => {
                    if (typeof currentDraft.jurisdiction === "object") {
                      return;
                    }
                    updateDraft({
                      ...draft,
                      jurisdiction: {
                        stateCode: stateCodeForOneStateChoice(),
                      },
                    });
                  }}
                  type="radio"
                  value="state"
                />
                One state
              </label>
            </div>
            {typeof currentDraft.jurisdiction === "object" ? (
              <label
                className="grid gap-2 text-sm font-medium"
                htmlFor="starting-view-state"
              >
                State
                <Select
                  disabled={saving}
                  value={currentDraft.jurisdiction.stateCode || null}
                  onValueChange={(value) => {
                    if (!value) {
                      return;
                    }
                    setRememberedStateCode(value);
                    updateDraft({
                      ...draft,
                      jurisdiction: jurisdictionFromSelectValue(value),
                    });
                  }}
                >
                  <SelectTrigger
                    aria-invalid={jurisdictionInvalid || undefined}
                    aria-label="State"
                    className="h-11 w-full"
                    data-testid="settings-jurisdiction-select"
                    id="starting-view-state"
                  >
                    <SelectValue placeholder="Select a state">
                      {currentDraft.jurisdiction.stateCode
                        ? jurisdictionLabel(
                            currentDraft.jurisdiction,
                            selectOptions
                          )
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {selectOptions.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
          </fieldset>
          <p
            className="type-small text-muted-foreground"
            id="starting-view-hint"
          >
            This applies the next time you open Atlas Explorer without a
            specific view.
          </p>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="settings-role"
          >
            Role
            <Select
              disabled={saving}
              value={draft.role ?? ROLE_UNSET}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }
                updateDraft({ ...draft, role: roleFromSelectValue(value) });
              }}
            >
              <SelectTrigger
                aria-label="Role"
                className="h-11 w-full"
                id="settings-role"
              >
                <SelectValue>{roleLabel(currentDraft.role)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROLE_UNSET}>Prefer not to say</SelectItem>
                {PROFILE_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="settings-organization"
          >
            Organization
            <Input
              data-testid="settings-organization"
              disabled={saving}
              id="settings-organization"
              maxLength={userProfileWriteOrganizationMax}
              value={draft.organization}
              onChange={(event) =>
                updateDraft({ ...draft, organization: event.target.value })
              }
            />
          </label>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="settings-job-title"
          >
            Job title
            <Input
              data-testid="settings-job-title"
              disabled={saving}
              id="settings-job-title"
              maxLength={userProfileWriteJobTitleMax}
              value={draft.jobTitle}
              onChange={(event) =>
                updateDraft({ ...draft, jobTitle: event.target.value })
              }
            />
          </label>
          <Button
            data-testid="settings-save-profile"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving…" : "Save starting view"}
          </Button>
          {notice ? (
            <p
              aria-live={notice.tone === "error" ? "assertive" : "polite"}
              data-testid="settings-save-notice"
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}
