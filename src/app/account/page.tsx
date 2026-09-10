"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProfileV1MeProfileGet,
  saveProfileV1MeProfilePut,
} from "@/generated/atlas";
import type {
  UserProfileWrite,
  UserProfileWriteRole,
} from "@/generated/models";
import { AtlasApiError } from "@/lib/api-mutator";
import { createClient } from "@/lib/supabase/client";

const roles: { value: Exclude<UserProfileWriteRole, null>; label: string }[] = [
  { value: "general_public_citizen", label: "General public citizen" },
  {
    value: "district_level_epidemiologist",
    label: "District-level epidemiologist",
  },
  { value: "state_level_epidemiologist", label: "State-level epidemiologist" },
  {
    value: "state_director_level_epidemiologist",
    label: "State director-level epidemiologist",
  },
  {
    value: "national_level_epidemiologist",
    label: "National-level epidemiologist",
  },
];

const states = [
  "",
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "IA",
  "ID",
  "IL",
  "IN",
  "KS",
  "KY",
  "LA",
  "MA",
  "MD",
  "ME",
  "MI",
  "MN",
  "MO",
  "MS",
  "MT",
  "NC",
  "ND",
  "NE",
  "NH",
  "NJ",
  "NM",
  "NV",
  "NY",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VA",
  "VT",
  "WA",
  "WI",
  "WV",
  "WY",
];

export default function AccountPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [form, setForm] = useState<UserProfileWrite>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAccount() {
      try {
        const session = await createClient().auth.getUser();
        if (!session.data.user) return setSignedIn(false);
        setSignedIn(true);
        setLoadingProfile(true);
        const result = await getProfileV1MeProfileGet();
        if (result.status === 200 && result.data.profile)
          setForm(result.data.profile);
      } catch {
        // A missing or unavailable Auth service must not strand public users on
        // the loading state. The account feature is optional; fall back to the
        // signed-out view and keep Atlas available.
        setSignedIn(false);
        setNotice(
          "Your profile is temporarily unavailable. You can continue exploring Atlas."
        );
      } finally {
        setLoadingProfile(false);
      }
    }
    void loadAccount();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveProfileV1MeProfilePut({
        role: form.role ?? null,
        state_code: form.state_code || null,
        organization: form.organization?.trim() || null,
        job_title: form.job_title?.trim() || null,
      });
      if (result.status !== 200)
        throw new Error("Profile save was not accepted.");
      setForm(result.data.profile ?? {});
      setNotice("Profile saved.");
    } catch (error) {
      const reference =
        error instanceof AtlasApiError && error.requestId
          ? ` Reference: ${error.requestId}.`
          : "";
      setNotice(
        `We could not save your profile. Please try again later.${reference}`
      );
    } finally {
      setSaving(false);
    }
  }

  if (signedIn === null)
    return <main className="container py-12">Checking account session…</main>;
  if (!signedIn)
    return (
      <main className="container py-12">
        <h1 className="text-3xl font-semibold">Your account</h1>
        <p className="text-muted-foreground mt-2">
          Sign in to manage your optional Atlas profile.
        </p>
        {notice ? (
          <p className="mt-4" role="status">
            {notice}
          </p>
        ) : null}
        <Link
          className={buttonVariants({ className: "mt-6" })}
          href="/auth/sign-in?next=%2Faccount"
        >
          Sign in
        </Link>
      </main>
    );
  const isPublic = form.role === "general_public_citizen";
  return (
    <main className="container py-12">
      <section className="mx-auto max-w-xl">
        <p className="eyebrow">Optional account</p>
        <h1 className="text-3xl font-semibold">Your profile</h1>
        <p className="text-muted-foreground mt-2">
          All fields are optional. Profile details do not change Atlas evidence,
          scores, or access.
        </p>
        {loadingProfile ? (
          <p className="mt-6" role="status">
            Loading profile…
          </p>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={saveProfile}>
            <label className="block text-sm font-medium" htmlFor="role">
              Role
              <select
                id="role"
                className="bg-background mt-2 w-full rounded-md border p-2"
                value={form.role ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: (event.target.value as UserProfileWriteRole) || null,
                  })
                }
              >
                <option value="">Prefer not to say</option>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium" htmlFor="state">
              State
              <select
                id="state"
                className="bg-background mt-2 w-full rounded-md border p-2"
                value={form.state_code ?? ""}
                onChange={(event) =>
                  setForm({ ...form, state_code: event.target.value || null })
                }
              >
                {states.map((state) => (
                  <option key={state} value={state}>
                    {state || "No state selected"}
                  </option>
                ))}
              </select>
            </label>
            {!isPublic && (
              <>
                <label
                  className="block text-sm font-medium"
                  htmlFor="organization"
                >
                  Organization
                  <Input
                    id="organization"
                    maxLength={120}
                    value={form.organization ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, organization: event.target.value })
                    }
                  />
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="job-title"
                >
                  Job title
                  <Input
                    id="job-title"
                    maxLength={120}
                    value={form.job_title ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, job_title: event.target.value })
                    }
                  />
                </label>
              </>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving profile…" : "Save profile"}
            </Button>
          </form>
        )}
        {notice && (
          <p
            className="text-muted-foreground mt-4 text-sm"
            role="status"
            aria-live="polite"
          >
            {notice}
          </p>
        )}
        <Button
          className="mt-6"
          variant="secondary"
          onClick={async () => {
            await createClient().auth.signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
