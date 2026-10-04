import { describe, expect, it } from "vitest";

import {
  isProfessionalAppPath,
  shouldRedirectUnauthenticatedAppRoute,
} from "@/lib/auth/app-route-guard";

describe("professional app route guard", () => {
  it("recognizes the /app namespace", () => {
    expect(isProfessionalAppPath("/app")).toBeTruthy();
    expect(isProfessionalAppPath("/app/explore")).toBeTruthy();
    expect(isProfessionalAppPath("/application")).toBeFalsy();
  });

  it("redirects unauthenticated users when auth can be enforced", () => {
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: false,
        pathname: "/app/review",
        supabaseConfigured: true,
        userPresent: false,
      })
    ).toBeTruthy();
  });

  it("allows Playwright shell coverage when auth is not configured", () => {
    expect(
      shouldRedirectUnauthenticatedAppRoute({
        atlasE2E: true,
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
        pathname: "/app/settings",
        supabaseConfigured: true,
        userPresent: true,
      })
    ).toBeFalsy();
  });
});
