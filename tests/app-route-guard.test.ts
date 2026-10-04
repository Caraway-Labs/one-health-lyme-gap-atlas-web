import { describe, expect, it } from "vitest";

import {
  allowsUnauthenticatedProfessionalAppShell,
  isProfessionalAppPath,
  isSupabaseAuthConfigured,
  shouldRedirectUnauthenticatedAppRoute,
} from "@/lib/auth/app-route-guard";

describe("professional app route guard", () => {
  it("recognizes the /app namespace", () => {
    expect(isProfessionalAppPath("/app")).toBeTruthy();
    expect(isProfessionalAppPath("/app/explore")).toBeTruthy();
    expect(isProfessionalAppPath("/application")).toBeFalsy();
  });

  it("treats partial Supabase configuration as not configured", () => {
    expect(
      isSupabaseAuthConfigured("https://example.supabase.co", undefined)
    ).toBeFalsy();
    expect(isSupabaseAuthConfigured(undefined, "publishable-key")).toBeFalsy();
    expect(
      isSupabaseAuthConfigured("https://example.supabase.co", "publishable-key")
    ).toBeTruthy();
  });

  it("redirects unauthenticated users when auth can be enforced", () => {
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: false,
        nodeEnv: "production",
        pathname: "/app/review",
        supabaseConfigured: true,
        userPresent: false,
      })
    ).toBeTruthy();
  });

  it("fail-closes production even when ATLAS_E2E is set without Supabase", () => {
    expect(
      allowsUnauthenticatedProfessionalAppShell({
        atlasE2E: true,
        nodeEnv: "production",
        supabaseConfigured: false,
      })
    ).toBeFalsy();
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: true,
        nodeEnv: "production",
        pathname: "/app/investigate",
        supabaseConfigured: false,
        userPresent: false,
      })
    ).toBeTruthy();
  });

  it("fail-closes production when only the Supabase URL is present", () => {
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: true,
        nodeEnv: "production",
        pathname: "/app/investigate",
        supabaseConfigured: false,
        userPresent: false,
      })
    ).toBeTruthy();
  });

  it("allows Playwright shell coverage only in non-production without Supabase", () => {
    expect(
      allowsUnauthenticatedProfessionalAppShell({
        atlasE2E: true,
        nodeEnv: "development",
        supabaseConfigured: false,
      })
    ).toBeTruthy();
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: true,
        nodeEnv: "development",
        pathname: "/app/review",
        supabaseConfigured: false,
        userPresent: false,
      })
    ).toBeFalsy();
  });

  it("keeps signed-in users on professional routes", () => {
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: false,
        nodeEnv: "production",
        pathname: "/app/settings",
        supabaseConfigured: true,
        userPresent: true,
      })
    ).toBeFalsy();
  });
});
