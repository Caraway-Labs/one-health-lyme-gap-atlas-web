import { afterEach, describe, expect, it } from "vitest";

import {
  accessTokenIssuedAtMs,
  claimPrivacyReauthChallenge,
  clearPrivacyReauthChallenge,
  previousIssuedAtForReauth,
  PRIVACY_REAUTH_CLOCK_SKEW_MS,
  PRIVACY_REAUTH_MAX_AGE_MS,
  PRIVACY_REAUTH_STORAGE_KEY,
  privacyReauthChallengeExpired,
  privacyReauthSatisfied,
  readPrivacyReauthChallenge,
  resetPrivacyReauthResumeForTests,
  savePrivacyReauthChallenge,
  type PrivacyReauthChallenge,
} from "../src/lib/auth/privacy-reauth";

const NOW = 1_800_000_000_000;

function challenge(
  overrides: Partial<PrivacyReauthChallenge> = {}
): PrivacyReauthChallenge {
  return {
    action: "export",
    challengedAtMs: NOW - 60_000,
    nonce: "11111111-1111-4111-8111-111111111111",
    previousIssuedAtMs: NOW - 120_000,
    ...overrides,
  };
}

function token(issuedAtMs: number): string {
  const payload = btoa(JSON.stringify({ iat: issuedAtMs / 1000 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${payload}.sig`;
}

describe("privacy reauthentication", () => {
  afterEach(() => {
    localStorage.clear();
    resetPrivacyReauthResumeForTests();
  });

  it("reads an access-token issued-at and rejects malformed tokens", () => {
    expect(accessTokenIssuedAtMs(token(NOW))).toBe(NOW);
    expect(accessTokenIssuedAtMs("not-a-jwt")).toBeNull();
    expect(accessTokenIssuedAtMs(token(Number.NaN))).toBeNull();
  });

  it("accepts a newer sign-in inside the 15-minute API window", () => {
    const issuedAtMs = NOW - PRIVACY_REAUTH_MAX_AGE_MS;
    const current = challenge({
      challengedAtMs: issuedAtMs,
      previousIssuedAtMs: issuedAtMs - 1000,
    });
    expect(privacyReauthSatisfied(current, NOW - 5000, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, issuedAtMs, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, issuedAtMs - 1000, NOW)).toBeFalsy();
  });

  it("rejects the same token, a stale token, and an expired challenge", () => {
    const current = challenge();
    expect(
      privacyReauthSatisfied(current, current.previousIssuedAtMs, NOW)
    ).toBeFalsy();
    expect(
      privacyReauthSatisfied(
        current,
        NOW - PRIVACY_REAUTH_MAX_AGE_MS - 1000,
        NOW
      )
    ).toBeFalsy();
    const expired = challenge({
      challengedAtMs: NOW - PRIVACY_REAUTH_MAX_AGE_MS - 1,
    });
    expect(privacyReauthChallengeExpired(expired, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(expired, NOW - 5000, NOW)).toBeFalsy();
  });

  it("allows a small clock skew but not an older sign-in", () => {
    const withinSkew = NOW - PRIVACY_REAUTH_CLOCK_SKEW_MS;
    const current = challenge({
      challengedAtMs: NOW,
      previousIssuedAtMs: withinSkew - 60_000,
    });
    expect(privacyReauthSatisfied(current, withinSkew, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, withinSkew - 1000, NOW)).toBeFalsy();
  });

  it("records a missing session as no prior issued-at", () => {
    expect(
      previousIssuedAtForReauth({ issuedAtMs: null, present: false }, NOW)
    ).toBe(0);
    expect(
      previousIssuedAtForReauth({ issuedAtMs: NOW - 1000, present: true }, NOW)
    ).toBe(NOW - 1000);
    expect(
      previousIssuedAtForReauth({ issuedAtMs: null, present: true }, NOW)
    ).toBe(NOW);
  });

  it("claims only the stored challenge for this attempt", () => {
    const current = challenge();
    savePrivacyReauthChallenge(current);
    expect(readPrivacyReauthChallenge()).toStrictEqual(current);
    expect(claimPrivacyReauthChallenge("someone-else")).toBeNull();
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toContain(
      "export"
    );
    expect(claimPrivacyReauthChallenge(current.nonce)).toStrictEqual(current);
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
  });

  it("ignores malformed stored challenges", () => {
    localStorage.setItem(PRIVACY_REAUTH_STORAGE_KEY, "{");
    expect(readPrivacyReauthChallenge()).toBeNull();
    localStorage.setItem(
      PRIVACY_REAUTH_STORAGE_KEY,
      JSON.stringify({ action: "export" })
    );
    expect(readPrivacyReauthChallenge()).toBeNull();
    clearPrivacyReauthChallenge();
  });
});
